import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const toast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      setConfirmState({ message, resolve });
    });
  }, []);

  const handleConfirmResult = (result) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  const iconMap = {
    success: CheckCircle2,
    error: AlertTriangle,
    info: Info,
  };

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      <div className="toast-container">
        {toasts.map(t => {
          const Icon = iconMap[t.type] || iconMap.info;
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <Icon size={16} />
              <span>{t.message}</span>
              <button className="toast-dismiss" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {confirmState && (
        <div className="confirm-overlay" onClick={() => handleConfirmResult(false)}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">
              <AlertTriangle size={28} />
            </div>
            <p className="confirm-message">{confirmState.message}</p>
            <div className="confirm-actions">
              <button onClick={() => handleConfirmResult(false)} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={() => handleConfirmResult(true)} className="btn-danger">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
