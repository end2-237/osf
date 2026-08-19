import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

/* ══════════════════════════════════════════════════════════════════════════
   LA CONNEXION

   L'adresse et la clé anon viennent de `extra` dans app.json, alimentées par
   les variables d'environnement au moment du build. Elles ne sont pas
   secrètes — la clé anon est déjà lisible dans le bundle du site web — mais
   elles n'ont rien à faire en dur dans un fichier source : le jour où le
   projet Supabase change, on ne veut pas rechercher la chaîne dans le code.

   `detectSessionInUrl` est désactivé : il n'y a pas d'URL de navigateur ici,
   et le laisser actif fait chercher un fragment qui n'existe pas à chaque
   démarrage.
   ══════════════════════════════════════════════════════════════════════════ */

const extra = Constants.expoConfig?.extra || {};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl;
const cle = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey;

if (!url || !cle) {
  throw new Error(
    'Adresse ou clé Supabase absente. Renseigne EXPO_PUBLIC_SUPABASE_URL et ' +
    'EXPO_PUBLIC_SUPABASE_ANON_KEY (voir mobile/README.md).',
  );
}

export const supabase = createClient(url, cle, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
