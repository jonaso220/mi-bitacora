import { Car, CheckCircle2, Plus, Pencil, Trash2, X } from 'lucide-react';

export default function VehicleList({ vehicles, selectedId, onSelect, onEdit, onDelete, onAdd, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-icon violet">
            <Car size={24} />
          </div>
          <h2>Mis Vehículos</h2>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>

        <div className="vehicle-list">
          {vehicles.map(v => (
            <div
              key={v.id}
              className={`vehicle-item ${selectedId === v.id ? 'active' : ''}`}
            >
              <div
                className="vehicle-item-main"
                onClick={() => onSelect(v.id)}
              >
                <div className="vehicle-item-icon">
                  <Car size={20} />
                </div>
                <div className="vehicle-item-info">
                  <h4>{v.alias}</h4>
                  <p>{v.make} {v.model} • {v.year}</p>
                </div>
                {selectedId === v.id && (
                  <CheckCircle2 className="vehicle-item-check" size={20} />
                )}
              </div>
              <div className="vehicle-item-actions">
                <button onClick={() => onEdit(v)} className="btn-icon" title="Editar">
                  <Pencil size={14} />
                </button>
                <button onClick={() => onDelete(v.id)} className="btn-icon btn-icon-danger" title="Eliminar">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onAdd} className="btn-add-vehicle">
          <Plus size={18} /> Agregar vehículo
        </button>
      </div>
    </div>
  );
}
