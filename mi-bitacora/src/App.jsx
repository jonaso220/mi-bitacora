import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { auth, googleProvider, db, storage, DATA_COLLECTION } from './firebase';
import { useToast } from './components/Toast';
import {
  Car,
  Wrench,
  Calendar,
  Plus,
  History,
  CheckCircle2,
  Trash2,
  Gauge,
  TrendingUp,
  Clock,
  AlertTriangle,
  X,
  ChevronDown,
  Activity,
  Pencil,
  Search,
  SortAsc,
  Camera,
  DollarSign,
  ImageIcon,
  ArrowUpDown
} from 'lucide-react';

// --- Componente Principal ---
export default function App() {
  const { toast, confirm } = useToast();

  // --- Auth ---
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // --- Data ---
  const [vehicles, setVehicles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);

  // --- View ---
  const [view, setView] = useState('dashboard');

  // --- Vehicle Form ---
  const emptyVehicle = { alias: '', make: '', model: '', year: new Date().getFullYear(), initialKm: '' };
  const [vehicleForm, setVehicleForm] = useState(emptyVehicle);
  const [editingVehicleId, setEditingVehicleId] = useState(null);

  // --- Log Form ---
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

  // --- Photos ---
  const [photoFiles, setPhotoFiles] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [photosToDelete, setPhotosToDelete] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const fileInputRef = useRef(null);

  // --- Search / Filter / Sort ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortConfig, setSortConfig] = useState('date-desc');

  // ============================================
  // AUTH
  // ============================================

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

  // ============================================
  // DATA LOADING
  // ============================================

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

  // ============================================
  // COMPUTED VALUES
  // ============================================

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

  // Filtered + sorted logs
  const filteredLogs = useMemo(() => {
    let result = [...vehicleLogs];

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter(l => l.type === filterType);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.detail?.toLowerCase().includes(q) ||
        l.notes?.toLowerCase().includes(q) ||
        l.type?.toLowerCase().includes(q)
      );
    }

    // Sort
    const [field, dir] = sortConfig.split('-');
    result.sort((a, b) => {
      let valA, valB;
      if (field === 'date') {
        valA = new Date(a.date);
        valB = new Date(b.date);
      } else if (field === 'mileage') {
        valA = Number(a.mileage) || 0;
        valB = Number(b.mileage) || 0;
      } else if (field === 'cost') {
        valA = Number(a.cost) || 0;
        valB = Number(b.cost) || 0;
      }
      return dir === 'desc' ? valB - valA : valA - valB;
    });

    return result;
  }, [vehicleLogs, filterType, searchQuery, sortConfig]);

  // ============================================
  // PHOTO HELPERS
  // ============================================

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setPhotoFiles(prev => [...prev, ...files]);
  };

  const removeNewPhoto = (index) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
  };

  const markExistingPhotoForDeletion = (photo) => {
    setExistingPhotos(prev => prev.filter(p => p.url !== photo.url));
    setPhotosToDelete(prev => [...prev, photo]);
  };

  const uploadPhotos = async (logId) => {
    if (photoFiles.length === 0) return [];
    const urls = [];
    for (const file of photoFiles) {
      const timestamp = Date.now();
      const storageRef = ref(storage, `users/${user.uid}/photos/${logId}_${timestamp}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      urls.push({ url, name: file.name, path: storageRef.fullPath });
    }
    return urls;
  };

  const deletePhotosFromStorage = async (photos) => {
    for (const photo of photos) {
      try {
        if (photo.path) {
          await deleteObject(ref(storage, photo.path));
        }
      } catch (err) {
        console.error("Error borrando foto:", err);
      }
    }
  };

  // ============================================
  // VEHICLE HANDLERS
  // ============================================

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

  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      if (editingVehicleId) {
        const docRef = doc(db, 'artifacts', DATA_COLLECTION, 'users', user.uid, 'vehicles', editingVehicleId);
        await updateDoc(docRef, { ...vehicleForm });
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
        if (log.photos?.length) await deletePhotosFromStorage(log.photos);
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

  // ============================================
  // LOG HANDLERS
  // ============================================

  const openAddLog = () => {
    setLogForm(emptyLog);
    setEditingLogId(null);
    setPhotoFiles([]);
    setExistingPhotos([]);
    setPhotosToDelete([]);
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
    setPhotoFiles([]);
    setExistingPhotos(log.photos || []);
    setPhotosToDelete([]);
    setView('log-form');
  };

  const handleSaveLog = async (e) => {
    e.preventDefault();
    if (!user || !selectedVehicleId) return;
    setUploading(true);
    try {
      const logData = {
        vehicleId: selectedVehicleId,
        ...logForm
      };

      if (editingLogId) {
        // Upload new photos
        const newPhotoUrls = await uploadPhotos(editingLogId);
        // Delete removed photos
        await deletePhotosFromStorage(photosToDelete);
        // Merge photos
        logData.photos = [...existingPhotos, ...newPhotoUrls];
        const docRef = doc(db, 'artifacts', DATA_COLLECTION, 'users', user.uid, 'maintenance_logs', editingLogId);
        await updateDoc(docRef, logData);
        toast("Registro actualizado");
      } else {
        logData.createdAt = serverTimestamp();
        logData.photos = [];
        const docRef = await addDoc(
          collection(db, 'artifacts', DATA_COLLECTION, 'users', user.uid, 'maintenance_logs'),
          logData
        );
        // Upload photos with the new doc ID
        if (photoFiles.length > 0) {
          const photoUrls = await uploadPhotos(docRef.id);
          await updateDoc(doc(db, 'artifacts', DATA_COLLECTION, 'users', user.uid, 'maintenance_logs', docRef.id), {
            photos: photoUrls
          });
        }
        toast("Servicio registrado");
      }

      setLogForm(emptyLog);
      setEditingLogId(null);
      setPhotoFiles([]);
      setExistingPhotos([]);
      setPhotosToDelete([]);
      setView('dashboard');
    } catch (err) {
      console.error("Error guardando registro:", err);
      toast("Error al guardar. Revisa tu conexión.", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteLog = async (log) => {
    if (!user) return;
    const ok = await confirm("¿Eliminar este registro?");
    if (!ok) return;
    try {
      if (log.photos?.length) await deletePhotosFromStorage(log.photos);
      await deleteDoc(doc(db, 'artifacts', DATA_COLLECTION, 'users', user.uid, 'maintenance_logs', log.id));
      toast("Registro eliminado");
    } catch (err) {
      console.error("Error borrando registro:", err);
      toast("Error al eliminar", "error");
    }
  };

  // ============================================
  // UI COMPONENTS
  // ============================================

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

  // ============================================
  // VIEWS
  // ============================================

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

  // --- Vehicle Form (Add / Edit) ---
  const renderVehicleForm = () => (
    <div className="modal-overlay" onClick={() => setView('dashboard')}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon cyan">
            <Car size={24} />
          </div>
          <h2>{editingVehicleId ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h2>
          <button onClick={() => setView('dashboard')} className="modal-close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSaveVehicle} className="modal-form">
          <div className="form-group">
            <label>Alias</label>
            <input
              required
              type="text"
              value={vehicleForm.alias}
              onChange={e => setVehicleForm({ ...vehicleForm, alias: e.target.value })}
              placeholder="Ej: Mi Auto, El Rojo..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Marca</label>
              <input
                required
                type="text"
                value={vehicleForm.make}
                onChange={e => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                placeholder="Toyota"
              />
            </div>
            <div className="form-group">
              <label>Modelo</label>
              <input
                required
                type="text"
                value={vehicleForm.model}
                onChange={e => setVehicleForm({ ...vehicleForm, model: e.target.value })}
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
                value={vehicleForm.year}
                onChange={e => setVehicleForm({ ...vehicleForm, year: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Km Inicial</label>
              <input
                required
                type="number"
                value={vehicleForm.initialKm}
                onChange={e => setVehicleForm({ ...vehicleForm, initialKm: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={() => setView('dashboard')} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              <CheckCircle2 size={18} /> {editingVehicleId ? 'Guardar' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // --- Log Form (Add / Edit) ---
  const renderLogForm = () => (
    <div className="modal-overlay" onClick={() => setView('dashboard')}>
      <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon emerald">
            <Wrench size={24} />
          </div>
          <h2>{editingLogId ? 'Editar Registro' : 'Registrar Servicio'}</h2>
          <button onClick={() => setView('dashboard')} className="modal-close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSaveLog} className="modal-form">
          <div className="form-group">
            <label>Fecha</label>
            <input
              required
              type="date"
              value={logForm.date}
              onChange={e => setLogForm({ ...logForm, date: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Detalle del Servicio</label>
            <input
              required
              type="text"
              value={logForm.detail}
              onChange={e => setLogForm({ ...logForm, detail: e.target.value })}
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
                  onClick={() => setLogForm({ ...logForm, type })}
                  className={`type-btn ${logForm.type === type ? 'active' : ''} type-${type.toLowerCase()}`}
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
                value={logForm.mileage}
                onChange={e => setLogForm({ ...logForm, mileage: e.target.value })}
                placeholder="10500"
              />
            </div>
            <div className="form-group">
              <label>Próximo Km (opcional)</label>
              <input
                type="number"
                value={logForm.nextMileage}
                onChange={e => setLogForm({ ...logForm, nextMileage: e.target.value })}
                placeholder="15500"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Costo</label>
            <div className="input-with-icon">
              <DollarSign size={16} className="input-icon" />
              <input
                type="number"
                step="0.01"
                min="0"
                value={logForm.cost}
                onChange={e => setLogForm({ ...logForm, cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Notas Adicionales</label>
            <textarea
              rows="3"
              value={logForm.notes}
              onChange={e => setLogForm({ ...logForm, notes: e.target.value })}
              placeholder="Marca de aceite, observaciones..."
            />
          </div>

          {/* Photos */}
          <div className="form-group">
            <label>Fotos</label>
            <div className="photo-upload-area" onClick={() => fileInputRef.current?.click()}>
              <Camera size={24} />
              <span>Agregar fotos</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoSelect}
                style={{ display: 'none' }}
              />
            </div>

            {(existingPhotos.length > 0 || photoFiles.length > 0) && (
              <div className="photo-preview-grid">
                {existingPhotos.map((photo, i) => (
                  <div key={`existing-${i}`} className="photo-preview-item">
                    <img src={photo.url} alt={photo.name} onClick={() => setLightboxPhoto(photo.url)} />
                    <button
                      type="button"
                      className="photo-remove-btn"
                      onClick={() => markExistingPhotoForDeletion(photo)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {photoFiles.map((file, i) => (
                  <div key={`new-${i}`} className="photo-preview-item">
                    <img src={URL.createObjectURL(file)} alt={file.name} />
                    <button
                      type="button"
                      className="photo-remove-btn"
                      onClick={() => removeNewPhoto(i)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="button" onClick={() => setView('dashboard')} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary btn-emerald" disabled={uploading}>
              {uploading ? (
                <><Clock size={18} /> Subiendo...</>
              ) : (
                <><CheckCircle2 size={18} /> {editingLogId ? 'Guardar' : 'Registrar'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // --- Vehicle List ---
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
              className={`vehicle-item ${selectedVehicleId === v.id ? 'active' : ''}`}
            >
              <div
                className="vehicle-item-main"
                onClick={() => {
                  setSelectedVehicleId(v.id);
                  setView('dashboard');
                }}
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
              <div className="vehicle-item-actions">
                <button onClick={() => openEditVehicle(v)} className="btn-icon" title="Editar">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDeleteVehicle(v.id)} className="btn-icon btn-icon-danger" title="Eliminar">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button onClick={openAddVehicle} className="btn-add-vehicle">
          <Plus size={18} /> Agregar vehículo
        </button>
      </div>
    </div>
  );

  // --- Dashboard ---
  const renderDashboard = () => {
    if (vehicles.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">
            <Car size={48} />
          </div>
          <h2>Bienvenido a tu Bitácora</h2>
          <p>Comienza registrando tu primer vehículo para llevar el control de sus mantenimientos.</p>
          <div className="onboarding-steps">
            <div className="onboarding-step active">
              <div className="step-number">1</div>
              <span>Registra tu vehículo</span>
            </div>
            <div className="onboarding-step">
              <div className="step-number">2</div>
              <span>Agrega un servicio</span>
            </div>
            <div className="onboarding-step">
              <div className="step-number">3</div>
              <span>Controla tu historial</span>
            </div>
          </div>
          <button onClick={openAddVehicle} className="btn-primary btn-lg">
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

        {/* Onboarding hint for first log */}
        {vehicleLogs.length === 0 && (
          <div className="onboarding-hint">
            <div className="onboarding-steps">
              <div className="onboarding-step completed">
                <div className="step-number"><CheckCircle2 size={14} /></div>
                <span>Vehículo registrado</span>
              </div>
              <div className="onboarding-step active">
                <div className="step-number">2</div>
                <span>Agrega tu primer servicio</span>
              </div>
              <div className="onboarding-step">
                <div className="step-number">3</div>
                <span>Controla tu historial</span>
              </div>
            </div>
          </div>
        )}

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
          {stats.totalCost > 0 && (
            <StatCard icon={DollarSign} label="Gastado" value={`$${stats.totalCost.toLocaleString()}`} color="amber" />
          )}
        </div>

        {/* FAB */}
        <button onClick={openAddLog} className="fab">
          <Plus size={24} />
        </button>

        {/* History */}
        <div className="history-section">
          <div className="history-header">
            <History size={18} />
            <h3>Historial</h3>
            <span className="history-count">{filteredLogs.length}</span>
          </div>

          {/* Search & Filter Bar */}
          {vehicleLogs.length > 0 && (
            <div className="search-filter-bar">
              <div className="search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar servicio..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button className="search-clear" onClick={() => setSearchQuery('')}>
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="filter-pills">
                {[
                  { key: 'all', label: 'Todos' },
                  { key: 'Preventivo', label: 'Preventivo' },
                  { key: 'Correctivo', label: 'Correctivo' },
                  { key: 'Programado', label: 'Programado' }
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilterType(f.key)}
                    className={`filter-pill ${filterType === f.key ? 'active' : ''} ${f.key !== 'all' ? `pill-${f.key.toLowerCase()}` : ''}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="sort-control">
                <ArrowUpDown size={14} />
                <select
                  value={sortConfig}
                  onChange={e => setSortConfig(e.target.value)}
                  className="sort-select"
                >
                  <option value="date-desc">Más reciente</option>
                  <option value="date-asc">Más antiguo</option>
                  <option value="mileage-desc">Mayor km</option>
                  <option value="mileage-asc">Menor km</option>
                  <option value="cost-desc">Mayor costo</option>
                  <option value="cost-asc">Menor costo</option>
                </select>
              </div>
            </div>
          )}

          {filteredLogs.length === 0 ? (
            <div className="history-empty">
              <Clock size={32} />
              <p>{vehicleLogs.length === 0 ? 'No hay registros aún' : 'Sin resultados'}</p>
            </div>
          ) : (
            <div className="history-list">
              {filteredLogs.map((log) => (
                <div key={log.id} className="history-item">
                  <div className="history-item-left">
                    <span className={`history-type type-${log.type.toLowerCase()}`}>
                      {log.type.charAt(0)}
                    </span>
                  </div>
                  <div className="history-item-content">
                    <div className="history-item-top">
                      <h4>{log.detail}</h4>
                      <div className="history-item-btns">
                        <button onClick={() => openEditLog(log)} className="history-edit" title="Editar">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDeleteLog(log)} className="history-delete" title="Eliminar">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="history-item-meta">
                      <span className="history-date">{log.date}</span>
                      <span className="history-km">{Number(log.mileage).toLocaleString()} km</span>
                      {log.nextMileage && (
                        <span className="history-next">→ {Number(log.nextMileage).toLocaleString()}</span>
                      )}
                      {log.cost && Number(log.cost) > 0 && (
                        <span className="history-cost">${Number(log.cost).toLocaleString()}</span>
                      )}
                    </div>
                    {log.notes && <p className="history-notes">{log.notes}</p>}
                    {log.photos?.length > 0 && (
                      <div className="history-photos">
                        {log.photos.map((photo, i) => (
                          <img
                            key={i}
                            src={photo.url}
                            alt={photo.name}
                            className="history-photo-thumb"
                            onClick={() => setLightboxPhoto(photo.url)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================
  // MAIN RENDER
  // ============================================

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

      {view === 'vehicle-form' && renderVehicleForm()}
      {view === 'log-form' && renderLogForm()}
      {view === 'vehicle-list' && renderVehicleList()}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div className="lightbox-overlay" onClick={() => setLightboxPhoto(null)}>
          <button className="lightbox-close" onClick={() => setLightboxPhoto(null)}>
            <X size={24} />
          </button>
          <img src={lightboxPhoto} alt="" className="lightbox-image" />
        </div>
      )}
    </div>
  );
}
