import React, { createContext, useContext, useState, useCallback } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number;
}

interface NotificationContextType {
  notifications: AppNotification[];
  notify: (notification: Omit<AppNotification, 'id'>) => string;
  notifySuccess: (message: string, title?: string) => string;
  notifyError: (message: string, title?: string) => string;
  notifyWarning: (message: string, title?: string) => string;
  notifyInfo: (message: string, title?: string) => string;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<AppNotification, 'id'>): string => {
      const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newNotification: AppNotification = { id, type, title, message, duration };

      setNotifications((prev) => [...prev.slice(-3), newNotification]); // keep last 4 max

      if (duration > 0) {
        setTimeout(() => {
          removeNotification(id);
        }, duration);
      }
      return id;
    },
    [removeNotification]
  );

  const notifySuccess = useCallback(
    (message: string, title?: string) => notify({ type: 'success', title, message }),
    [notify]
  );

  const notifyError = useCallback(
    (message: string, title?: string) => notify({ type: 'error', title, message, duration: 6000 }),
    [notify]
  );

  const notifyWarning = useCallback(
    (message: string, title?: string) => notify({ type: 'warning', title, message, duration: 5000 }),
    [notify]
  );

  const notifyInfo = useCallback(
    (message: string, title?: string) => notify({ type: 'info', title, message }),
    [notify]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        notify,
        notifySuccess,
        notifyError,
        notifyWarning,
        notifyInfo,
        removeNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    // Return graceful fallback if provider is mounting
    return {
      notifications: [],
      notify: () => '',
      notifySuccess: (msg: string) => { console.log('[Success]', msg); return ''; },
      notifyError: (msg: string) => { console.error('[Error]', msg); return ''; },
      notifyWarning: (msg: string) => { console.warn('[Warning]', msg); return ''; },
      notifyInfo: (msg: string) => { console.info('[Info]', msg); return ''; },
      removeNotification: () => {},
    };
  }
  return context;
};
