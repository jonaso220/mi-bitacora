import { Wrench, CheckCircle2, X, DollarSign } from 'lucide-react';
import { useToast } from './Toast';

function validateLog(form, initialKm) {
  const mileage = Number(form.mileage);
  const nextMileage = Number(form.nextMileage);
  const cost = Number(form.cost);
  const km0 = Number(initialKm) || 0;

  if (mileage < 0) {
    return 'El kilometraje no puede ser negativo';
  }
  if (km0 > 0 && mileage < km0) {
    return `El kilometraje (${mileage}) no puede ser menor al km inicial del vehículo (${km0})`;
  }
  if (form.nextMileage && nextMileage <= mileage) {
    return 'El próximo km debe ser mayor al km actual';
  }
  if (form.cost && cost < 0) {
    return 'El costo no puede ser negativo';
  }
  return null;
}

export default function LogForm({ form, setForm, isEditing, onSave, onCancel, vehicleInitialKm }) {
  const { toast } = useToast();

  const handleSubmit = (e) => {
    e.preventDefault();
    const error = validateLog(form, vehicleInitialKm);
    if (error) {
      toast(error, 'error');
      return;
    }
    onSave(e);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon emerald">
            <Wrench size={24} />
          </div>
          <h2>{isEditing ? 'Editar Registro' : 'Registrar Servicio'}</h2>
          <button onClick={onCancel} className="modal-close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Fecha</label>
            <input
              required
              type="date"
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Detalle del Servicio</label>
            <input
              required
              type="text"
              value={form.detail}
              onChange={e => setForm({ ...form, detail: e.target.value })}
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
                  onClick={() => setForm({ ...form, type })}
                  className={`type-btn ${form.type === type ? 'active' : ''} type-${type.toLowerCase()}`}
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
                min="0"
                value={form.mileage}
                onChange={e => setForm({ ...form, mileage: e.target.value })}
                placeholder="10500"
              />
            </div>
            <div className="form-group">
              <label>Próximo Km (opcional)</label>
              <input
                type="number"
                min="0"
                value={form.nextMileage}
                onChange={e => setForm({ ...form, nextMileage: e.target.value })}
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
                value={form.cost}
                onChange={e => setForm({ ...form, cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Notas Adicionales</label>
            <textarea
              rows="3"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Marca de aceite, observaciones..."
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary btn-emerald">
              <CheckCircle2 size={18} /> {isEditing ? 'Guardar' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
