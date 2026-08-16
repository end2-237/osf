import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { supabase } from './supabase';

const firebaseConfig = {
  apiKey: "AIzaSyBOMDUPerxSFJkLQbG1z1ao48_lB0mprV0",
  authDomain: "buyticle-bce3f.firebaseapp.com",
  projectId: "buyticle-bce3f",
  storageBucket: "buyticle-bce3f.firebasestorage.app",
  messagingSenderId: "313383491173",
  appId: "1:313383491173:web:d0ccc12fc62e5efd0f188c",
  measurementId: "G-V88H9TVFPM"
};

const app = initializeApp(firebaseConfig);

/* ── Messaging, en paresseux et sous garde ───────────────────────────────────
   getMessaging() lève « messaging/unsupported-browser » dans tout navigateur
   qui n'a pas PushManager, ServiceWorker ou Notification : Safari hors écran
   d'accueil, une fenêtre privée, un profil qui bloque les données de site.

   Appelée au chargement du module, cette exception cassait TOUT le fichier —
   y compris requestNotificationPermission, qui n'avait donc jamais l'occasion
   de rapporter la vraie raison. On n'initialise plus qu'à la demande.
   ──────────────────────────────────────────────────────────────────────────── */
/* Ce qui manque, précisément. isSupported() ne répond que oui ou non, et « ce
   navigateur ne sait pas » sans dire quoi n'aide personne à décider s'il doit
   changer de navigateur, sortir de la navigation privée, ou débloquer un
   réglage. On refait donc la vérification nous-mêmes, en nommant chaque pièce. */
export const capacitesManquantes = () => {
  const manque = [];
  if (typeof window === 'undefined') return ['fenêtre'];
  if (!window.isSecureContext)                 manque.push('HTTPS');
  if (!('serviceWorker' in navigator))         manque.push('service worker');
  if (!('PushManager' in window))              manque.push('PushManager');
  if (!('Notification' in window))             manque.push('Notification');
  if (!navigator.cookieEnabled)                manque.push('cookies');
  if (!('showNotification' in (window.ServiceWorkerRegistration?.prototype || {})))
    manque.push('showNotification');
  if (!('getKey' in (window.PushSubscription?.prototype || {})))
    manque.push('PushSubscription.getKey');
  return manque;
};

let _messaging = null;
let _messagingPromise = null;

const obtenirMessaging = () => {
  if (_messaging) return Promise.resolve(_messaging);
  if (_messagingPromise) return _messagingPromise;
  _messagingPromise = isSupported()
    .then((ok) => {
      if (!ok) return null;
      _messaging = getMessaging(app);
      return _messaging;
    })
    .catch(() => null);
  return _messagingPromise;
};

/* Une seule inscription du service worker à la fois. Deux appels concurrents
   pour la même portée font avorter le premier — c'est l'AbortError
   « Operation has been aborted », qu'on prend pour une panne alors que c'est
   nous qui nous marchons dessus. */
let _swPromise = null;

const inscrireServiceWorker = () => {
  if (_swPromise) return _swPromise;
  _swPromise = navigator.serviceWorker
    .register('/firebase-messaging-sw.js', { scope: '/' })
    .then(async (reg) => { await navigator.serviceWorker.ready; return reg; })
    .catch((e) => { _swPromise = null; throw e; });
  return _swPromise;
};

/* ── Le jeton de notification ─────────────────────────────────────────────────
   Renvoie { token, raison }. La raison compte autant que le jeton : sans elle,
   l'écran ne peut que dire « autorise les notifications », ce qui est faux
   quatre fois sur cinq et envoie le commerçant chercher au mauvais endroit.

   Cinq échecs possibles, et un seul dépend vraiment de lui.
   ──────────────────────────────────────────────────────────────────────────── */
export const RAISONS = {
  ok:           'Notifications actives.',
  non_supporte: 'Ce navigateur ne peut pas recevoir de notifications. Sur iPhone, ajoute le site à l’écran d’accueil ; en navigation privée, ça ne marche pas ; et sur Brave, il faut activer « Use Google services for push messaging » dans les réglages de confidentialité.',
  sw_echec:     'Le service de fond n’a pas pu démarrer — souvent un bloqueur de scripts ou la navigation privée. Recharge la page.',
  refusee:      'Tu as refusé les notifications. Il faut les réautoriser dans les réglages du navigateur, à côté de l’adresse du site.',
  ignoree:      'La demande a été fermée sans répondre. Réessaie.',
  cle_absente:  'Configuration incomplète côté serveur : la clé VAPID manque. Ce n’est pas de ton fait — préviens Buyticle.',
  jeton_absent: 'Firebase n’a pas délivré de jeton. Réessaie dans un instant.',
  erreur:       'Une erreur est survenue.',
};

export const requestNotificationPermission = async (vendorId) => {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    return { token: null, raison: 'non_supporte' };
  }

  const messaging = await obtenirMessaging();
  if (!messaging) {
    const manque = capacitesManquantes();
    console.warn('[FCM] non supporté — manque :', manque.length ? manque : '(rien de visible)');
    return {
      token: null,
      raison: 'non_supporte',
      // Rien ne manque en apparence mais Firebase refuse quand même : c'est la
      // signature d'un navigateur qui a coupé le service de push de Google —
      // Brave le fait par défaut.
      detail: manque.length ? `manque : ${manque.join(', ')}` : 'service de push désactivé',
    };
  }

  let swRegistration;
  try {
    swRegistration = await inscrireServiceWorker();
  } catch (swErr) {
    console.error('[FCM] Échec SW:', swErr);
    return { token: null, raison: 'sw_echec', detail: swErr?.name };
  }

  const permission = await Notification.requestPermission();
  if (permission === 'denied')  return { token: null, raison: 'refusee' };
  if (permission !== 'granted') return { token: null, raison: 'ignoree' };

  // La cause la plus fréquente, et la seule qui ne se règle pas côté commerçant.
  const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!VAPID_KEY) {
    console.error('[FCM] VITE_FIREBASE_VAPID_KEY manquante — console Firebase → Cloud Messaging → certificats push Web');
    return { token: null, raison: 'cle_absente' };
  }

  let token;
  try {
    token = await getToken(messaging, {
      vapidKey: VAPID_KEY.trim(),
      serviceWorkerRegistration: swRegistration,
    });
  } catch (e) {
    console.error('[FCM] getToken:', e);
    return { token: null, raison: 'erreur', detail: e?.message };
  }
  if (!token) return { token: null, raison: 'jeton_absent' };

  if (vendorId) {
    // Un seul jeton par boutique : on remplace au lieu d'empiler.
    await supabase.from('fcm_tokens').delete().eq('vendor_id', vendorId);
    const { error } = await supabase.from('fcm_tokens').insert({ vendor_id: vendorId, token });
    if (error) {
      console.error('[FCM] Enregistrement du jeton:', error.code, error.message);
      return { token, raison: 'erreur', detail: error.message };
    }
  }

  return { token, raison: 'ok' };
};

// ✅ FIX : Listener continu (onMessage ne se ferme pas après 1 message)
export const setupForegroundNotifications = (onNotification) => {
  let stop = null;
  obtenirMessaging().then((m) => {
    if (m) stop = onMessage(m, onNotification);
  });
  // On rend une fonction d'arrêt tout de suite : l'appelant ne doit pas avoir
  // à savoir que l'initialisation est asynchrone.
  return () => { if (stop) stop(); };
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    obtenirMessaging().then((m) => { if (m) onMessage(m, resolve); });
  });

export const sendNotificationToVendor = async (vendorId, title, body) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: { vendorId, title, body }
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};
