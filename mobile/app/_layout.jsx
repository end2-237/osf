import React from 'react';
import { Stack } from 'expo-router';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSessionValue } from '../lib/session';
import { BoutiqueProvider } from '../lib/boutique';
import FeuilleChoix from '../components/FeuilleChoix';
import { useMiseAJour } from '../lib/maj';
import { C } from '../lib/ui';

/* ══════════════════════════════════════════════════════════════════════════
   BUYTICLE STORE

   L'ossature. Session et boutique au-dessus de tout, la feuille de choix
   montée une seule fois à la racine — elle s'ouvre depuis n'importe quel
   écran, il n'y a donc aucune raison d'en avoir une par page.

   Le bandeau de mise à jour ne s'impose jamais : il propose. Recharger
   pendant qu'un client attend au comptoir ferait perdre la vente.
   ══════════════════════════════════════════════════════════════════════════ */

function BandeauMaj() {
  const { prete, appliquer } = useMiseAJour();
  if (!prete) return null;
  return (
    <Pressable onPress={appliquer} style={st.maj}>
      <Text style={st.majTexte}>
        Une mise à jour est prête. Touche ici quand tu as un moment.
      </Text>
    </Pressable>
  );
}

export default function Layout() {
  const session = useSessionValue();

  return (
    <SafeAreaProvider>
      <SessionProvider value={session}>
        <BoutiqueProvider>
          <StatusBar style="light" />
          <View style={{ flex: 1, backgroundColor: C.fond }}>
            <BandeauMaj />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.fond } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="connexion" options={{ presentation: 'modal' }} />
            </Stack>
            <FeuilleChoix />
          </View>
        </BoutiqueProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  maj: { backgroundColor: C.marine, paddingHorizontal: 16, paddingVertical: 9 },
  majTexte: { color: '#FFF', fontSize: 12, textAlign: 'center' },
});
