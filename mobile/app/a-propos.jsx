import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMiseAJour } from '../lib/maj';
import { C, R, S, E, OMBRE } from '../lib/ui';
import Icone from '../components/Icone';

export default function APropos() {
  const router = useRouter();
  const { version, canal, prete, appliquer } = useMiseAJour();
  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable hitSlop={10} onPress={() => router.back()}>
              <Icone nom="retour" taille={25} couleur="#FFF" />
            </Pressable>
            <Text style={st.titre}>À propos</Text>
          </View>
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ paddingVertical: 14 }}>
        <View style={[st.bloc, { alignItems: 'center', gap: 8 }]}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: C.encre }}>
            buy<Text style={{ color: C.orange }}>ticle</Text>
          </Text>
          <Text style={{ fontSize: 13, color: C.gris, textAlign: 'center', lineHeight: 19 }}>
            La place de marché de Douala. Quand un commerçant n’a pas ce que tu
            cherches, il t’envoie chez un voisin qui l’a — et tu paies moins cher
            qu’au prix affiché.
          </Text>
        </View>
        <View style={[st.bloc, { gap: 8 }]}>
          <Rangee k="Version" v={Constants.expoConfig?.version || '—'} />
          <Rangee k="Canal" v={canal} />
          <Rangee k="Mise à jour" v={version} />
          {prete && (
            <Pressable onPress={appliquer} style={[S.bouton, { marginTop: 6 }]}>
              <Text style={S.boutonTexte}>Appliquer la mise à jour</Text>
            </Pressable>
          )}
        </View>
        <Text style={{ fontSize: 11, color: C.gris, textAlign: 'center', marginTop: 8 }}>
          BUYTICLE ETS · RCCM CM-DLA-01-2025-A10-01482 · Douala, Cameroun
        </Text>
      </ScrollView>
    </View>
  );
}
function Rangee({ k, v }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13.5, color: C.gris }}>{k}</Text>
      <Text style={{ fontSize: 13.5, fontWeight: '600', color: C.encre }}>{v}</Text>
    </View>
  );
}
const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  titre: { color: '#FFF', fontSize: 19, fontWeight: '800' },
  bloc: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 16,
    marginHorizontal: E.page, marginBottom: 12, ...OMBRE,
  },
});
