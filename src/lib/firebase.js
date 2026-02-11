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
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
      });

      // Sauvegarder le token dans Supabase
      if (token && vendorId) {
        await supabase
          .from('fcm_tokens')
          .upsert({ vendor_id: vendorId, token }, { onConflict: 'token' });
      }

      return token;
    }
  } catch (error) {
    console.error('Error getting notification permission:', error);
  }
  return null;
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });

// Fonction pour envoyer une notification (côté serveur avec Firebase Admin SDK)
export const sendNotificationToVendor = async (vendorId, title, body) => {
  try {
    // Cette fonction devrait être appelée depuis un backend sécurisé
    // Pour le moment, on utilise Supabase Edge Functions
    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: { vendorId, title, body }
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};
