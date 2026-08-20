import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_300Light, Inter_400Regular, Inter_500Medium,
  Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { SessionProvider, useSessionValue } from '../lib/session';
import { BoutiqueProvider } from '../lib/boutique';
import { poserLaPolice } from '../lib/police';
import FeuilleChoix from '../components/FeuilleChoix';
import { useMiseAJour } from '../lib/maj';
import { C } from '../lib/ui';

/* ══════════════════════════════════════════════════════════════════════════
   BUYTICLE STORE

   Session et boutique au-dessus de tout, la feuille de choix montée une seule
   fois à la racine — elle s'ouvre depuis n'importe quel écran.

   L'écran de démarrage tient tant que la police n'est pas chargée. Sans ça, la
   première image s'affiche dans la police système puis saute quand Inter
   arrive : ce saut de deux dixièmes de seconde est ce qui fait qu'une
   application paraît bricolée dès la première seconde.
   ══════════════════════════════════════════════════════════════════════════ */

SplashScreen.preventAutoHideAsync().catch(() => {});
poserLaPolice();

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
  const [policesPretes, erreurPolice] = useFonts({
    Inter_300Light, Inter_400Regular, Inter_500Medium,
    Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
  });

  // Un garde-fou de deux secondes. Une police qui ne se charge pas — réseau
  // coupé, plateforme qui ne la gère pas — ne doit JAMAIS retenir
  // l'application : mieux vaut la police système que rien du tout, et une
  // page blanche est ce qui fait désinstaller.
  const [tropLong, setTropLong] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTropLong(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const pret = policesPretes || !!erreurPolice || tropLong;

  useEffect(() => {
    if (pret) SplashScreen.hideAsync().catch(() => {});
  }, [pret]);

  if (!pret) return null;

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
