importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// ✅ Config Firebase réelle (identique à src/lib/firebase.js)
firebase.initializeApp({
  apiKey: "AIzaSyBOMDUPerxSFJkLQbG1z1ao48_lB0mprV0",
  authDomain: "buyticle-bce3f.firebaseapp.com",
  projectId: "buyticle-bce3f",
  storageBucket: "buyticle-bce3f.firebasestorage.app",
  messagingSenderId: "313383491173",
  appId: "1:313383491173:web:d0ccc12fc62e5efd0f188c"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Message en arrière-plan reçu:', payload);

  const notificationTitle = payload.notification?.title || '🛒 OneFreestyle Elite';
  const notificationOptions = {
    body: payload.notification?.body || 'Nouvelle notification',
    icon: '/ofs.png',
    badge: '/ofs.png',
    tag: 'order-notification',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { url: '/admin' }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/admin';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});