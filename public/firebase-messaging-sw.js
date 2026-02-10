// À placer dans public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuration Firebase (à remplacer par vos vraies valeurs)
firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
});

const messaging = firebase.messaging();

// Gestion des notifications en arrière-plan
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title || 'OneFreestyle Elite';
  const notificationOptions = {
    body: payload.notification.body || 'Nouvelle notification',
    icon: '/logo.png',
    badge: '/badge.png',
    tag: 'order-notification',
    requireInteraction: true,
    data: {
      url: payload.data?.url || '/admin'
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gestion du clic sur la notification
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click received.');
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/admin';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Vérifier si une fenêtre est déjà ouverte
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // Sinon ouvrir une nouvelle fenêtre
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
