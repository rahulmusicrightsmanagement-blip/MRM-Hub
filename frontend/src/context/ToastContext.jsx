import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

let toastId = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type, entering: true }]);
    setTimeout(() => setToasts((prev) => prev.map((t) => t.id === id ? { ...t, entering: false } : t)), 50);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none' }}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const typeStyles = {
  success: { bg: '#065f46', border: '#10b981', color: '#a7f3d0', icon: '✓' },
  error: { bg: '#7f1d1d', border: '#ef4444', color: '#fecaca', icon: '✕' },
  info: { bg: '#1e3a5f', border: '#3b82f6', color: '#bfdbfe', icon: 'ℹ' },
};

const ToastItem = ({ toast, onClose }) => {
  const s = typeStyles[toast.type] || typeStyles.info;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '12px 18px', borderRadius: '10px',
        backgroundColor: s.bg, border: `1px solid ${s.border}`,
        color: s.color, fontSize: '13px', fontWeight: 600,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        pointerEvents: 'auto', cursor: 'pointer',
        transform: toast.entering ? 'translateX(100%)' : 'translateX(0)',
        opacity: toast.entering ? 0 : 1,
        transition: 'all 0.3s ease-out',
        minWidth: '240px', maxWidth: '400px',
      }}
      onClick={onClose}
    >
      <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: s.border, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
        {s.icon}
      </span>
      <span style={{ flex: 1, lineHeight: '1.4' }}>{toast.message}</span>
    </div>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
