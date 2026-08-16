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
  const d = payload.data || {};

  // Un appel à disponibilité doit sonner et rester à l'écran : le commerçant a
  // trente secondes. Le reste peut attendre qu'il regarde son téléphone.
  const estAppel = d.genre === 'appel';

  return self.registration.showNotification(
    payload.notification?.title || 'Buyticle',
    {
      body:  payload.notification?.body || '',
      icon:  '/ofs.png',
      badge: '/ofs.png',
      // Un tag commun aux appels : le plus récent remplace le précédent, parce
      // qu'un appel périmé n'a plus d'objet. Tout le reste garde son propre tag,
      // sinon une vente confirmée effacerait le client qui vient d'arriver.
      tag: estAppel ? 'relais-appel' : (d.lien ? `bt-${d.genre || 'x'}-${Date.now()}` : 'buyticle'),
      requireInteraction: estAppel,
      vibrate: estAppel ? [300, 100, 300, 100, 300] : [200, 100, 200],
      data: { url: d.lien || '/admin' },
    },
  );
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