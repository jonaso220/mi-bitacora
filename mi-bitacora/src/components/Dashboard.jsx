import {
  Car, Calendar, Plus, History, CheckCircle2, Trash2, Gauge,
  TrendingUp, Clock, AlertTriangle, ChevronDown, Activity,
  Pencil, Search, DollarSign, ArrowUpDown, X
} from 'lucide-react';
import StatCard from './StatCard';
import ProgressRing from './ProgressRing';

function Onboarding({ step }) {
  const steps = [
    { label: 'Registra tu vehículo', num: '1' },
    { label: 'Agrega un servicio', num: '2' },
    { label: 'Controla tu historial', num: '3' },
  ];
  return (
    <div className="onboarding-steps">
      {steps.map((s, i) => {
        let cls = 'onboarding-step';
        if (i < step) cls += ' completed';
        else if (i === step) cls += ' active';
        return (
          <div key={i} className={cls}>
            <div className="step-number">
              {i < step ? <CheckCircle2 size={14} /> : s.num}
            </div>
            <span>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function SearchFilterBar({ searchQuery, setSearchQuery, filterType, setFilterType, sortConfig, setSortConfig }) {
  return (
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
  );
}

export default function Dashboard({
  vehicles,
  selectedVehicle,
  vehicleLogs,
  filteredLogs,
  stats,
  latestMileage,
  nextMaintenance,
  searchQuery, setSearchQuery,
  filterType, setFilterType,
  sortConfig, setSortConfig,
  onAddVehicle,
  onAddLog,
  onEditLog,
  onDeleteLog,
  onSwitchVehicle,
}) {
  // Empty state: no vehicles
  if (vehicles.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <Car size={48} />
        </div>
        <h2>Bienvenido a tu Bitácora</h2>
        <p>Comienza registrando tu primer vehículo para llevar el control de sus mantenimientos.</p>
        <Onboarding step={0} />
        <button onClick={onAddVehicle} className="btn-primary btn-lg">
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
        <button onClick={onSwitchVehicle} className="vehicle-switch">
          Cambiar <ChevronDown size={16} />
        </button>
      </div>

      {/* Onboarding hint for first log */}
      {vehicleLogs.length === 0 && (
        <div className="onboarding-hint">
          <Onboarding step={1} />
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
      <button onClick={onAddLog} className="fab">
        <Plus size={24} />
      </button>

      {/* History */}
      <div className="history-section">
        <div className="history-header">
          <History size={18} />
          <h3>Historial</h3>
          <span className="history-count">{filteredLogs.length}</span>
        </div>

        {vehicleLogs.length > 0 && (
          <SearchFilterBar
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            filterType={filterType} setFilterType={setFilterType}
            sortConfig={sortConfig} setSortConfig={setSortConfig}
          />
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
                      <button onClick={() => onEditLog(log)} className="history-edit" title="Editar">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => onDeleteLog(log)} className="history-delete" title="Eliminar">
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
