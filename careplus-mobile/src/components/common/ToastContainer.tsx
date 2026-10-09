import React from 'react';
import { useNotification, AppNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotification();
  const { theme } = useAuth();
  const isLight = theme === 'light';

  if (!notifications.length) return null;

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />;
    }
  };

  return (
    <div className="fixed top-4 left-0 right-0 z-[9999] flex flex-col items-center pointer-events-none px-4 space-y-2 max-w-md mx-auto">
      {notifications.map((n) => (
        <div
          key={n.id}
          className="pointer-events-auto w-full rounded-2xl p-3.5 shadow-xl border flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top duration-200"
          style={
            isLight
              ? {
                  backgroundColor: '#ffffff',
                  borderColor: '#C5DCE8',
                  color: '#18324A',
                  boxShadow: '0 8px 24px rgba(24, 50, 74, 0.12)',
                }
              : {
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  color: '#f8fafc',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                }
          }
        >
          <div className="flex items-start gap-2.5 min-w-0">
            {getIcon(n.type)}
            <div className="min-w-0">
              {n.title && <p className="text-xs font-bold leading-tight truncate">{n.title}</p>}
              <p className="text-xs opacity-90 leading-relaxed break-words">{n.message}</p>
            </div>
          </div>
          <button
            onClick={() => removeNotification(n.id)}
            className="p-1 rounded-lg opacity-60 hover:opacity-100 transition shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
