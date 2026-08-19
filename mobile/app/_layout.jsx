import React from 'react';
import { Stack } from 'expo-router';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSessionValue } from '../lib/session';
import { useMiseAJour } from '../lib/maj';
import { C } from '../lib/theme';

/* ══════════════════════════════════════════════════════════════════════════
   BUYTICLE STORE

   L'ossature. Une pile d'écrans, la session au-dessus, et le bandeau de mise
   à jour qui ne s'impose jamais — il propose, l'utilisateur décide du moment.
   ══════════════════════════════════════════════════════════════════════════ */

function BandeauMaj() {
  const { prete, appliquer } = useMiseAJour();
  if (!prete) return null;
  return (
    <Pressable onPress={appliquer} style={styles.maj}>
      <Text style={styles.majTexte}>
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
        <StatusBar style="dark" />
        <View style={{ flex: 1, backgroundColor: C.fond }}>
          <BandeauMaj />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: C.carte },
              headerTitleStyle: { fontSize: 16, fontWeight: '700', color: C.encre },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: C.fond },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="connexion" options={{ title: 'Se connecter' }} />
            <Stack.Screen name="comptoir" options={{ title: 'Le comptoir' }} />
            <Stack.Screen name="relais" options={{ title: 'Mon relais' }} />
            <Stack.Screen name="reglages" options={{ title: 'Réglages' }} />
          </Stack>
        </View>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  maj: {
    backgroundColor: C.encre,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  majTexte: { color: '#FFF', fontSize: 12, textAlign: 'center' },
});
