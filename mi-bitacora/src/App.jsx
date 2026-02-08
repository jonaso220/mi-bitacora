import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc,
  doc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Car, 
  Wrench, 
  Calendar, 
  Plus, 
  History, 
  CheckCircle2, 
  Trash2, 
  ChevronRight,
  Gauge,
  TrendingUp,
  Clock,
  AlertTriangle,
  X,
  ChevronDown,
  Activity
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAw4ikfjaGQrDl_L-XNOkBTrWVTD1A-Ih0",
  authDomain: "mi-bitacora-auto.firebaseapp.com",
  projectId: "mi-bitacora-auto",
  storageBucket: "mi-bitacora-auto.firebasestorage.app",
  messagingSenderId: "670073950302",
  appId: "1:670073950302:web:10398465889e7fd5a164cf"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);
const dataCollectionId = "mi-bitacora-v1";

// --- Componente Principal ---
export default function App() {
  const [user, setUser] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [view, setView] = useState('dashboard'); 
  const [authLoading, setAuthLoading] = useState(true);

  const [newVehicle, setNewVehicle] = useState({ alias: '', make: '', model: '', year: new Date().getFullYear(), initialKm: '' });
  const [newLog, setNewLog] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Preventivo',
    detail: '',
    mileage: '',
    nextMileage: '',
    notes: ''
  });

  // --- Autenticación ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error de login:", error);
      alert("Error al iniciar sesión. Intenta de nuevo.");
    }
  };

  const handleLogout = async () => {
    if (window.confirm("¿Cerrar sesión?")) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Error al cerrar sesión:", error);
      }
    }
  };

  // --- Carga de Datos ---
  useEffect(() => {
    if (!user) return;

    const vehiclesRef = collection(db, 'artifacts', dataCollectionId, 'users', user.uid, 'vehicles');
    const unsubVehicles = onSnapshot(vehiclesRef, (snapshot) => {
      const vList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVehicles(vList);
      if (vList.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(vList[0].id);
      }
    }, (error) => console.error("Error cargando vehículos:", error));

    const logsRef = collection(db, 'artifacts', dataCollectionId, 'users', user.uid, 'maintenance_logs');
    const unsubLogs = onSnapshot(logsRef, (snapshot) => {
      const lList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      lList.sort((a, b) => new Date(b.date) - new Date(a.date));
      setLogs(lList);
    }, (error) => console.error("Error cargando registros:", error));

    return () => {
      unsubVehicles();
      unsubLogs();
    };
  }, [user]);

  // --- Cálculos ---
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
    const futureLogs = vehicleLogs.filter(l => l.nextMileage && Number(l.nextMileage) > latestMileage);
    if (futureLogs.length === 0) return null;
    futureLogs.sort((a, b) => Number(a.nextMileage) - Number(b.nextMileage));
    return futureLogs[0];
  }, [vehicleLogs, latestMileage]);

  const stats = useMemo(() => {
    const totalServices = vehicleLogs.length;
    const preventivos = vehicleLogs.filter(l => l.type === 'Preventivo').length;
    const correctivos = vehicleLogs.filter(l => l.type === 'Correctivo').length;
    const kmRecorridos = latestMileage - (selectedVehicle?.initialKm || 0);
    
    return { totalServices, preventivos, correctivos, kmRecorridos };
  }, [vehicleLogs, latestMileage, selectedVehicle]);

  // --- Funciones ---
  const handleAddVehicle = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, 'artifacts', dataCollectionId, 'users', user.uid, 'vehicles'), {
        ...newVehicle,
        createdAt: serverTimestamp()
      });
      setSelectedVehicleId(docRef.id);
      setNewVehicle({ alias: '', make: '', model: '', year: new Date().getFullYear(), initialKm: '' });
      setView('dashboard');
    } catch (err) {
      console.error("Error agregando vehículo:", err);
      alert("Error al guardar. Revisa tu conexión.");
    }
  };

  const handleAddLog = async (e) => {
    e.preventDefault();
    if (!user || !selectedVehicleId) return;
    try {
      await addDoc(collection(db, 'artifacts', dataCollectionId, 'users', user.uid, 'maintenance_logs'), {
        vehicleId: selectedVehicleId,
        ...newLog,
        createdAt: serverTimestamp()
      });
      setNewLog({
        date: new Date().toISOString().split('T')[0],
        type: 'Preventivo',
        detail: '',
        mileage: '',
        nextMileage: '',
        notes: ''
      });
      setView('dashboard');
    } catch (err) {
      console.error("Error agregando registro:", err);
      alert("Error al guardar. Revisa tu conexión.");
    }
  };

  const handleDeleteVehicle = async (id) => {
    if (!user) return;
    if (window.confirm("¿Estás seguro de eliminar este vehículo y todo su historial?")) {
      try {
        const logsToDelete = logs.filter(log => log.vehicleId === id);
        const deletePromises = logsToDelete.map(log => 
          deleteDoc(doc(db, 'artifacts', dataCollectionId, 'users', user.uid, 'maintenance_logs', log.id))
        );
        await Promise.all(deletePromises);
        await deleteDoc(doc(db, 'artifacts', dataCollectionId, 'users', user.uid, 'vehicles', id));
        if (selectedVehicleId === id) setSelectedVehicleId(null);
      } catch (err) {
        console.error("Error borrando vehículo", err);
      }
    }
  };

  const handleDeleteLog = async (id) => {
    if (!user) return;
    if (window.confirm("¿Eliminar este registro?")) {
      try {
        await deleteDoc(doc(db, 'artifacts', dataCollectionId, 'users', user.uid, 'maintenance_logs', id));
      } catch (err) {
        console.error("Error borrando log", err);
      }
    }
  };

  // --- Componentes UI ---
  
  const StatCard = ({ icon: Icon, label, value, color = "cyan" }) => (
    <div className={`stat-card stat-${color}`}>
      <div className="stat-icon">
        <Icon size={18} />
      </div>
      <div className="stat-content">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  );

  const ProgressRing = ({ progress, size = 140 }) => {
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;
    
    return (
      <svg width={size} height={size} className="progress-ring">
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <circle
          className="progress-ring-bg"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="progress-ring-fill"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          stroke="url(#progressGradient)"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset
          }}
        />
      </svg>
    );
  };

  // --- Vistas ---

  const renderAddVehicle = () => (
    <div className="modal-overlay" onClick={() => setView('dashboard')}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon cyan">
            <Car size={24} />
          </div>
          <h2>Nuevo Vehículo</h2>
          <button onClick={() => setView('dashboard')} className="modal-close">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleAddVehicle} className="modal-form">
          <div className="form-group">
            <label>Alias</label>
            <input 
              required
              type="text" 
              value={newVehicle.alias}
              onChange={e => setNewVehicle({...newVehicle, alias: e.target.value})}
              placeholder="Ej: Mi Auto, El Rojo..."
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Marca</label>
              <input 
                required
                type="text" 
                value={newVehicle.make}
                onChange={e => setNewVehicle({...newVehicle, make: e.target.value})}
                placeholder="Toyota"
              />
            </div>
            <div className="form-group">
              <label>Modelo</label>
              <input 
                required
                type="text" 
                value={newVehicle.model}
                onChange={e => setNewVehicle({...newVehicle, model: e.target.value})}
                placeholder="Corolla"
              />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Año</label>
              <input 
                required
                type="number" 
                value={newVehicle.year}
                onChange={e => setNewVehicle({...newVehicle, year: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Km Inicial</label>
              <input 
                required
                type="number" 
                value={newVehicle.initialKm}
                onChange={e => setNewVehicle({...newVehicle, initialKm: e.target.value})}
                placeholder="0"
              />
            </div>
          </div>
          
          <div className="form-actions">
            <button type="button" onClick={() => setView('dashboard')} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              <Plus size={18} /> Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderAddLog = () => (
    <div className="modal-overlay" onClick={() => setView('dashboard')}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon emerald">
            <Wrench size={24} />
          </div>
          <h2>Registrar Servicio</h2>
          <button onClick={() => setView('dashboard')} className="modal-close">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleAddLog} className="modal-form">
          <div className="form-group">
            <label>Fecha</label>
            <input 
              required
              type="date" 
              value={newLog.date}
              onChange={e => setNewLog({...newLog, date: e.target.value})}
            />
          </div>
          
          <div className="form-group">
            <label>Detalle del Servicio</label>
            <input 
              required
              type="text" 
              value={newLog.detail}
              onChange={e => setNewLog({...newLog, detail: e.target.value})}
              placeholder="Cambio de aceite, Filtros..."
            />
          </div>
          
          <div className="form-group">
            <label>Tipo de Mantenimiento</label>
            <div className="type-selector">
              {['Preventivo', 'Correctivo', 'Programado'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setNewLog({...newLog, type})}
                  className={`type-btn ${newLog.type === type ? 'active' : ''} type-${type.toLowerCase()}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Km Actual</label>
              <input 
                required
                type="number" 
                value={newLog.mileage}
                onChange={e => setNewLog({...newLog, mileage: e.target.value})}
                placeholder="10500"
              />
            </div>
            <div className="form-group">
              <label>Próximo Km (opcional)</label>
              <input 
                type="number" 
                value={newLog.nextMileage}
                onChange={e => setNewLog({...newLog, nextMileage: e.target.value})}
                placeholder="15500"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Notas Adicionales</label>
            <textarea 
              rows="3"
              value={newLog.notes}
              onChange={e => setNewLog({...newLog, notes: e.target.value})}
              placeholder="Marca de aceite, costo, observaciones..."
            />
          </div>
          
          <div className="form-actions">
            <button type="button" onClick={() => setView('dashboard')} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary btn-emerald">
              <CheckCircle2 size={18} /> Registrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderDashboard = () => {
    if (vehicles.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">
            <Car size={48} />
          </div>
          <h2>Bienvenido a tu Bitácora</h2>
          <p>Comienza registrando tu primer vehículo para llevar el control de sus mantenimientos.</p>
          <button onClick={() => setView('add-vehicle')} className="btn-primary btn-lg">
            <Plus size={20} /> Agregar Vehículo
          </button>
        </div>
      );
    }

    if (!selectedVehicle) return null;

    const kmToNext = nextMaintenance ? Number(nextMaintenance.nextMileage) - latestMileage : 0;
    const progressToNext = nextMaintenance ? Math.max(0, Math.min(100, 100 - (kmToNext / 5000 * 100))) : 0;

    return (
      <div className="dashboard">
        {/* Vehicle Header */}
        <div className="vehicle-header">
          <div className="vehicle-info">
            <h1>{selectedVehicle.alias}</h1>
            <p>{selectedVehicle.make} {selectedVehicle.model} • {selectedVehicle.year}</p>
          </div>
          <button onClick={() => setView('vehicle-list')} className="vehicle-switch">
            Cambiar <ChevronDown size={16} />
          </button>
        </div>

        {/* Main Stats */}
        <div className="main-stats">
          <div className="odometer-card">
            <div className="odometer-visual">
              <ProgressRing progress={progressToNext} />
              <div className="odometer-center">
                <Gauge className="odometer-icon" size={28} />
                <span className="odometer-number">{Number(latestMileage).toLocaleString()}</span>
                <span className="odometer-unit">km</span>
              </div>
            </div>
            <div className="odometer-label">Kilometraje Actual</div>
          </div>

          <div className="next-service-card">
            {nextMaintenance ? (
              <>
                <div className="next-header">
                  <Calendar size={18} />
                  <span>Próximo Servicio</span>
                </div>
                <div className="next-value">
                  {Number(nextMaintenance.nextMileage).toLocaleString()} km
                </div>
                <div className={`next-remaining ${kmToNext < 500 ? 'urgent' : kmToNext < 1000 ? 'warning' : ''}`}>
                  {kmToNext > 0 ? `Faltan ${kmToNext.toLocaleString()} km` : '¡Servicio pendiente!'}
                </div>
                <div className="next-detail">{nextMaintenance.detail}</div>
              </>
            ) : (
              <>
                <div className="next-header ok">
                  <CheckCircle2 size={18} />
                  <span>Todo al día</span>
                </div>
                <p className="next-empty">Sin servicios pendientes</p>
              </>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="stats-grid">
          <StatCard icon={Activity} label="Total" value={stats.totalServices} color="cyan" />
          <StatCard icon={CheckCircle2} label="Preventivos" value={stats.preventivos} color="emerald" />
          <StatCard icon={AlertTriangle} label="Correctivos" value={stats.correctivos} color="red" />
          <StatCard icon={TrendingUp} label="Km" value={stats.kmRecorridos.toLocaleString()} color="violet" />
        </div>

        {/* FAB */}
        <button onClick={() => setView('add-log')} className="fab">
          <Plus size={24} />
        </button>

        {/* History */}
        <div className="history-section">
          <div className="history-header">
            <History size={18} />
            <h3>Historial</h3>
            <span className="history-count">{vehicleLogs.length}</span>
          </div>
          
          {vehicleLogs.length === 0 ? (
            <div className="history-empty">
              <Clock size={32} />
              <p>No hay registros aún</p>
            </div>
          ) : (
            <div className="history-list">
              {vehicleLogs.map((log) => (
                <div key={log.id} className="history-item">
                  <div className="history-item-left">
                    <span className={`history-type type-${log.type.toLowerCase()}`}>
                      {log.type.charAt(0)}
                    </span>
                  </div>
                  <div className="history-item-content">
                    <div className="history-item-top">
                      <h4>{log.detail}</h4>
                      <button onClick={() => handleDeleteLog(log.id)} className="history-delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="history-item-meta">
                      <span className="history-date">{log.date}</span>
                      <span className="history-km">{Number(log.mileage).toLocaleString()} km</span>
                      {log.nextMileage && (
                        <span className="history-next">→ {Number(log.nextMileage).toLocaleString()}</span>
                      )}
                    </div>
                    {log.notes && <p className="history-notes">{log.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderVehicleList = () => (
    <div className="modal-overlay" onClick={() => setView('dashboard')}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon violet">
            <Car size={24} />
          </div>
          <h2>Mis Vehículos</h2>
          <button onClick={() => setView('dashboard')} className="modal-close">
            <X size={20} />
          </button>
        </div>
        
        <div className="vehicle-list">
          {vehicles.map(v => (
            <div 
              key={v.id}
              onClick={() => {
                setSelectedVehicleId(v.id);
                setView('dashboard');
              }}
              className={`vehicle-item ${selectedVehicleId === v.id ? 'active' : ''}`}
            >
              <div className="vehicle-item-icon">
                <Car size={20} />
              </div>
              <div className="vehicle-item-info">
                <h4>{v.alias}</h4>
                <p>{v.make} {v.model} • {v.year}</p>
              </div>
              {selectedVehicleId === v.id && (
                <CheckCircle2 className="vehicle-item-check" size={20} />
              )}
            </div>
          ))}
        </div>
        
        <button onClick={() => setView('add-vehicle')} className="btn-add-vehicle">
          <Plus size={18} /> Agregar vehículo
        </button>
        
        {selectedVehicleId && (
          <button onClick={() => handleDeleteVehicle(selectedVehicleId)} className="btn-delete-vehicle">
            <Trash2 size={14} /> Eliminar seleccionado
          </button>
        )}
      </div>
    </div>
  );

  const renderLogin = () => (
    <div className="login-screen">
      <div className="login-content">
        <div className="login-logo">
          <Car size={40} />
        </div>
        <h1>Bitácora</h1>
        <p>Tu historial de mantenimiento vehicular</p>
        
        <button onClick={handleGoogleLogin} className="btn-google">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuar con Google
        </button>
        
        <p className="login-hint">Tus datos se sincronizarán en todos tus dispositivos</p>
      </div>
    </div>
  );

  // --- Render Principal ---

  if (authLoading) return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-icon">
          <Car size={36} />
        </div>
        <p>Conectando...</p>
      </div>
    </div>
  );

  if (!user) return renderLogin();

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <div className="header-logo">
            <Car size={18} />
          </div>
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
        {view === 'dashboard' && renderDashboard()}
      </main>

      {view === 'add-vehicle' && renderAddVehicle()}
      {view === 'add-log' && renderAddLog()}
      {view === 'vehicle-list' && renderVehicleList()}
    </div>
  );
}
