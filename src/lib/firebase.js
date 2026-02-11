import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
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
const messaging = getMessaging(app);

export const requestNotificationPermission = async (vendorId) => {
  try {
    if (!('serviceWorker' in navigator)) return null;

    let swRegistration;
    try {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      await navigator.serviceWorker.ready;
    } catch (swErr) {
      console.error('[FCM] Échec SW:', swErr);
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!VAPID_KEY) {
      console.error('[FCM] VITE_FIREBASE_VAPID_KEY manquante !');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) return null;
    console.log('[FCM] ✅ Token obtenu:', token.substring(0, 30) + '...');

    if (vendorId) {
      // ✅ FIX double tokens : supprimer l'ancien, insérer le nouveau
      await supabase.from('fcm_tokens').delete().eq('vendor_id', vendorId);
      const { error } = await supabase.from('fcm_tokens').insert({ vendor_id: vendorId, token });
      if (error) {
        console.error('[FCM] Erreur save token:', error.message);
      } else {
        console.log('[FCM] ✅ Token sauvegardé proprement (1 token par vendeur)');
      }
    }

    return token;
  } catch (error) {
    console.error('[FCM] Erreur générale:', error);
    return null;
  }
};

// ✅ FIX : Listener continu (onMessage ne se ferme pas après 1 message)
export const setupForegroundNotifications = (onNotification) => {
  const unsubscribe = onMessage(messaging, (payload) => {
    console.log('[FCM] Message foreground reçu:', payload);
    onNotification(payload);
  });
  return unsubscribe; // retourne la fonction de cleanup
};

export const onMessageListener = () =>
  new Promise((resolve) => { onMessage(messaging, resolve); });

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