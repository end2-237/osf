import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/* ══════════════════════════════════════════════════════════════════════════
   LA NOTIFICATION QUI SONNE DANS LA POCHE

   C'est la seule raison technique d'avoir une application native. Le
   commerçant a trente secondes pour répondre à un appel à disponibilité, et
   le taux de réponse à trente secondes est — chapitre 7 de la stratégie — le
   paramètre qui décide de la couverture du rayon. Une notification web sur
   un Android d'occasion arrive quand elle arrive ; une notification native
   arrive.

   Le canal Android est déclaré à part et en importance MAX : sans lui, le
   système range la notification dans le silence par défaut et le commerçant
   ne l'entend jamais.
   ══════════════════════════════════════════════════════════════════════════ */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function enregistrerPourNotifications(vendorId) {
  // Un émulateur n'a pas de jeton push : inutile d'insister.
  if (!Device.isDevice) return { jeton: null, raison: 'emulateur' };

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('appels', {
      name: 'Appels à disponibilité',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 200, 250],
      lightColor: '#0F1111',
      sound: 'default',
      // L'appel doit passer devant : trente secondes ne se rattrapent pas.
      bypassDnd: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const { status: existant } = await Notifications.getPermissionsAsync();
  let status = existant;
  if (status !== 'granted') {
    const demande = await Notifications.requestPermissionsAsync();
    status = demande.status;
  }
  if (status !== 'granted') return { jeton: null, raison: 'refuse' };

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;
  if (!projectId) return { jeton: null, raison: 'projet_absent' };

  let jeton;
  try {
    const res = await Notifications.getExpoPushTokenAsync({ projectId });
    jeton = res.data;
  } catch (e) {
    return { jeton: null, raison: 'erreur', detail: e?.message };
  }

  // On range le jeton à côté de ceux du web, avec sa plateforme : l'edge
  // function saura qu'un jeton Expo ne s'envoie pas comme un jeton FCM.
  if (jeton && vendorId) {
    await supabase.from('fcm_tokens').upsert(
      { vendor_id: vendorId, token: jeton, plateforme: 'expo' },
      { onConflict: 'token' },
    );
  }

  return { jeton, raison: null };
}
