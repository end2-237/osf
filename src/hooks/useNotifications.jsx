import { useEffect, useState } from 'react';
import { onMessageListener } from '../lib/firebase';

export const useNotifications = () => {
  const [notification, setNotification] = useState(null);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    const setupNotifications = async () => {
      try {
        const payload = await onMessageListener();
        
        if (payload) {
          setNotification({
            title: payload.notification?.title || 'Notification',
            body: payload.notification?.body || '',
          });
          setShowNotification(true);

          // Auto-hide après 5 secondes
          setTimeout(() => {
            setShowNotification(false);
          }, 5000);
        }
      } catch (error) {
        console.error('Error receiving notification:', error);
      }
    };

    setupNotifications();
  }, []);

  const hideNotification = () => {
    setShowNotification(false);
  };

  return {
    notification,
    showNotification,
    hideNotification,
  };
};

// Composant de notification toast
export const NotificationToast = ({ notification, show, onClose }) => {
  if (!show || !notification) return null;

  return (
    <div className="fixed top-24 right-6 z-[300] animate-slideInRight">
      <div className="bg-black dark:bg-white border-2 border-primary rounded-2xl p-6 shadow-2xl max-w-sm">
        <div className="flex items-start space-x-4">
          <div className="bg-primary rounded-full p-2">
            <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="flex-grow">
            <h4 className="text-white dark:text-black font-black text-sm uppercase mb-1">
              {notification.title}
            </h4>
            <p className="text-zinc-300 dark:text-zinc-700 text-xs font-bold">
              {notification.body}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white dark:hover:text-black transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
