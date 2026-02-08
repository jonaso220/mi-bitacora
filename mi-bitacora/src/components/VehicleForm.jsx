import { Car, CheckCircle2, X } from 'lucide-react';
import { useToast } from './Toast';

const CURRENT_YEAR = new Date().getFullYear();

function validateVehicle(form) {
  const year = Number(form.year);
  if (year < 1900 || year > CURRENT_YEAR + 1) {
    return `El año debe estar entre 1900 y ${CURRENT_YEAR + 1}`;
  }
  const km = Number(form.initialKm);
  if (km < 0) {
    return 'El kilometraje inicial no puede ser negativo';
  }
  if (km > 9999999) {
    return 'El kilometraje parece demasiado alto';
  }
  return null;
}

export default function VehicleForm({ form, setForm, isEditing, onSave, onCancel }) {
  const { toast } = useToast();

  const handleSubmit = (e) => {
    e.preventDefault();
    const error = validateVehicle(form);
    if (error) {
      toast(error, 'error');
      return;
    }
    onSave(e);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon cyan">
            <Car size={24} />
          </div>
          <h2>{isEditing ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h2>
          <button onClick={onCancel} className="modal-close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Alias</label>
            <input
              required
              type="text"
              value={form.alias}
              onChange={e => setForm({ ...form, alias: e.target.value })}
              placeholder="Ej: Mi Auto, El Rojo..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Marca</label>
              <input
                required
                type="text"
                value={form.make}
                onChange={e => setForm({ ...form, make: e.target.value })}
                placeholder="Toyota"
              />
            </div>
            <div className="form-group">
              <label>Modelo</label>
              <input
                required
                type="text"
                value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
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
                min="1900"
                max={CURRENT_YEAR + 1}
                value={form.year}
                onChange={e => setForm({ ...form, year: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Km Inicial</label>
              <input
                required
                type="number"
                min="0"
                value={form.initialKm}
                onChange={e => setForm({ ...form, initialKm: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              <CheckCircle2 size={18} /> {isEditing ? 'Guardar' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
