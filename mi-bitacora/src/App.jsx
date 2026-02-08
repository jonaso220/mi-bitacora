import { useState, useEffect, useMemo } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { Car } from 'lucide-react';
import { auth, googleProvider, db, DATA_COLLECTION } from './firebase';
import { useToast } from './components/Toast';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import VehicleForm from './components/VehicleForm';
import LogForm from './components/LogForm';
import VehicleList from './components/VehicleList';

// --- Componente Principal ---
export default function App() {
  const { toast, confirm } = useToast();

  // --- State ---
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [view, setView] = useState('dashboard');

  const emptyVehicle = { alias: '', make: '', model: '', year: new Date().getFullYear(), initialKm: '' };
  const [vehicleForm, setVehicleForm] = useState(emptyVehicle);
  const [editingVehicleId, setEditingVehicleId] = useState(null);

  const emptyLog = {
    date: new Date().toISOString().split('T')[0],
    type: 'Preventivo',
    detail: '',
    mileage: '',
    nextMileage: '',
    notes: '',
    cost: ''
  };
  const [logForm, setLogForm] = useState(emptyLog);
  const [editingLogId, setEditingLogId] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortConfig, setSortConfig] = useState('date-desc');

  // --- Auth ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error de login:", error);
      toast("Error al iniciar sesión. Intenta de nuevo.", "error");
    }
  };

  const handleLogout = async () => {
    const ok = await confirm("¿Cerrar sesión?");
    if (ok) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Error al cerrar sesión:", error);
      }
    }
  };

  // --- Data Loading ---
  useEffect(() => {
    if (!user) return;

    const vehiclesRef = collection(db, 'artifacts', DATA_COLLECTION, 'users', user.uid, 'vehicles');
    const unsubVehicles = onSnapshot(vehiclesRef, (snapshot) => {
      const vList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setVehicles(vList);
      if (vList.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(vList[0].id);
      }
    }, (error) => console.error("Error cargando vehículos:", error));

    const logsRef = collection(db, 'artifacts', DATA_COLLECTION, 'users', user.uid, 'maintenance_logs');
    const unsubLogs = onSnapshot(logsRef, (snapshot) => {
      const lList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      lList.sort((a, b) => new Date(b.date) - new Date(a.date));
      setLogs(lList);
    }, (error) => console.error("Error cargando registros:", error));

    return () => {
      unsubVehicles();
      unsubLogs();
    };
  }, [user]);

  // --- Computed Values ---
  const selectedVehicle = useMemo(() =>
    vehicles.find(v => v.id === selectedVehicleId),
    [vehicles, selectedVehicleId]);

  const vehicleLogs = useMemo(() =>
    logs.filter(log => log.vehicleId === selectedVehicleId),
    [logs, selectedVehicleId]);

  const latestMileage = useMemo(() => {
    if (vehicleLogs.length === 0) return selectedVehicle?.initialKm || 0;
    return Math.max(...vehicleLogs.map(l => Number(l.mileage)), Number(selectedVehicle?.initialKm || 0));
  }, [vehicleLogs, selectedVehicle]);

  const nextMaintenance = useMemo(() => {
    if (vehicleLogs.length === 0) return null;
    const future = vehicleLogs.filter(l => l.nextMileage && Number(l.nextMileage) > latestMileage);
    if (future.length === 0) return null;
    future.sort((a, b) => Number(a.nextMileage) - Number(b.nextMileage));
    return future[0];
  }, [vehicleLogs, latestMileage]);

  const stats = useMemo(() => {
    const totalServices = vehicleLogs.length;
    const preventivos = vehicleLogs.filter(l => l.type === 'Preventivo').length;
    const correctivos = vehicleLogs.filter(l => l.type === 'Correctivo').length;
    const kmRecorridos = latestMileage - (selectedVehicle?.initialKm || 0);
    const totalCost = vehicleLogs.reduce((sum, l) => sum + (Number(l.cost) || 0), 0);
    return { totalServices, preventivos, correctivos, kmRecorridos, totalCost };
  }, [vehicleLogs, latestMileage, selectedVehicle]);

  const filteredLogs = useMemo(() => {
    let result = [...vehicleLogs];
    if (filterType !== 'all') {
      result = result.filter(l => l.type === filterType);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.detail?.toLowerCase().includes(q) ||
        l.notes?.toLowerCase().includes(q) ||
        l.type?.toLowerCase().includes(q)
      );
    }
    const [field, dir] = sortConfig.split('-');
    result.sort((a, b) => {
      let valA, valB;
      if (field === 'date') { valA = new Date(a.date); valB = new Date(b.date); }
      else if (field === 'mileage') { valA = Number(a.mileage) || 0; valB = Number(b.mileage) || 0; }
      else if (field === 'cost') { valA = Number(a.cost) || 0; valB = Number(b.cost) || 0; }
      return dir === 'desc' ? valB - valA : valA - valB;
    });
    return result;
  }, [vehicleLogs, filterType, searchQuery, sortConfig]);

  // --- Vehicle Handlers ---
  const openAddVehicle = () => {
    setVehicleForm(emptyVehicle);
    setEditingVehicleId(null);
    setView('vehicle-form');
  };

  const openEditVehicle = (vehicle) => {
    setVehicleForm({
      alias: vehicle.alias || '',
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year || new Date().getFullYear(),
      initialKm: vehicle.initialKm || ''
    });
    setEditingVehicleId(vehicle.id);
    setView('vehicle-form');
  };

  const handleSaveVehicle = async () => {
    if (!user) return;
    try {
      if (editingVehicleId) {
        await updateDoc(
          doc(db, 'artifacts', DATA_COLLECTION, 'users', user.uid, 'vehicles', editingVehicleId),
          { ...vehicleForm }
        );
        toast("Vehículo actualizado");
      } else {
        const docRef = await addDoc(
          collection(db, 'artifacts', DATA_COLLECTION, 'users', user.uid, 'vehicles'),
          { ...vehicleForm, createdAt: serverTimestamp() }
        );
        setSelectedVehicleId(docRef.id);
        toast("Vehículo registrado");
      }
      setVehicleForm(emptyVehicle);
      setEditingVehicleId(null);
      setView('dashboard');
    } catch (err) {
      console.error("Error guardando vehículo:", err);
      toast("Error al guardar. Revisa tu conexión.", "error");
    }
  };

  const handleDeleteVehicle = async (id) => {
    if (!user) return;
    const ok = await confirm("¿Eliminar este vehículo y todo su historial?");
    if (!ok) return;
    try {
      const logsToDelete = logs.filter(log => log.vehicleId === id);
      for (const log of logsToDelete) {
        await deleteDoc(doc(db, 'artifacts', DATA_COLLECTION, 'users', user.uid, 'maintenance_logs', log.id));
      }
      await deleteDoc(doc(db, 'artifacts', DATA_COLLECTION, 'users', user.uid, 'vehicles', id));
      if (selectedVehicleId === id) setSelectedVehicleId(null);
      toast("Vehículo eliminado");
      setView('dashboard');
    } catch (err) {
      console.error("Error borrando vehículo:", err);
      toast("Error al eliminar", "error");
    }
  };

  // --- Log Handlers ---
  const openAddLog = () => {
    setLogForm(emptyLog);
    setEditingLogId(null);
    setView('log-form');
  };

  const openEditLog = (log) => {
    setLogForm({
      date: log.date || '',
      type: log.type || 'Preventivo',
      detail: log.detail || '',
      mileage: log.mileage || '',
      nextMileage: log.nextMileage || '',
      notes: log.notes || '',
      cost: log.cost || ''
    });
    setEditingLogId(log.id);
    setView('log-form');
  };

  const handleSaveLog = async () => {
    if (!user || !selectedVehicleId) return;
    try {
      const logData = { vehicleId: selectedVehicleId, ...logForm };
      if (editingLogId) {
        await updateDoc(
          doc(db, 'artifacts', DATA_COLLECTION, 'users', user.uid, 'maintenance_logs', editingLogId),
          logData
        );
        toast("Registro actualizado");
      } else {
        logData.createdAt = serverTimestamp();
        await addDoc(
          collection(db, 'artifacts', DATA_COLLECTION, 'users', user.uid, 'maintenance_logs'),
          logData
        );
        toast("Servicio registrado");
      }
      setLogForm(emptyLog);
      setEditingLogId(null);
      setView('dashboard');
    } catch (err) {
      console.error("Error guardando registro:", err);
      toast("Error al guardar. Revisa tu conexión.", "error");
    }
  };

  const handleDeleteLog = async (log) => {
    if (!user) return;
    const ok = await confirm("¿Eliminar este registro?");
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'artifacts', DATA_COLLECTION, 'users', user.uid, 'maintenance_logs', log.id));
      toast("Registro eliminado");
    } catch (err) {
      console.error("Error borrando registro:", err);
      toast("Error al eliminar", "error");
    }
  };

  const closeModal = () => setView('dashboard');

  // --- Render ---
  if (authLoading) return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-icon"><Car size={36} /></div>
        <p>Conectando...</p>
      </div>
    </div>
  );

  if (!user) return <LoginScreen onLogin={handleGoogleLogin} />;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <div className="header-logo"><Car size={18} /></div>
          <span>Bitácora</span>
        </div>
        <div className="header-user" onClick={handleLogout}>
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="header-avatar" />
          ) : (
            <div className="header-avatar-placeholder">
              {user.displayName?.charAt(0) || user.email?.charAt(0) || '?'}
            </div>
          )}
        </div>
      </header>

      <main className="app-content">
        {view === 'dashboard' && (
          <Dashboard
            vehicles={vehicles}
            selectedVehicle={selectedVehicle}
            vehicleLogs={vehicleLogs}
            filteredLogs={filteredLogs}
            stats={stats}
            latestMileage={latestMileage}
            nextMaintenance={nextMaintenance}
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            filterType={filterType} setFilterType={setFilterType}
            sortConfig={sortConfig} setSortConfig={setSortConfig}
            onAddVehicle={openAddVehicle}
            onAddLog={openAddLog}
            onEditLog={openEditLog}
            onDeleteLog={handleDeleteLog}
            onSwitchVehicle={() => setView('vehicle-list')}
          />
        )}
      </main>

      {view === 'vehicle-form' && (
        <VehicleForm
          form={vehicleForm}
          setForm={setVehicleForm}
          isEditing={!!editingVehicleId}
          onSave={handleSaveVehicle}
          onCancel={closeModal}
        />
      )}

      {view === 'log-form' && (
        <LogForm
          form={logForm}
          setForm={setLogForm}
          isEditing={!!editingLogId}
          onSave={handleSaveLog}
          onCancel={closeModal}
          vehicleInitialKm={selectedVehicle?.initialKm}
        />
      )}

      {view === 'vehicle-list' && (
        <VehicleList
          vehicles={vehicles}
          selectedId={selectedVehicleId}
          onSelect={(id) => { setSelectedVehicleId(id); setView('dashboard'); }}
          onEdit={openEditVehicle}
          onDelete={handleDeleteVehicle}
          onAdd={openAddVehicle}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
