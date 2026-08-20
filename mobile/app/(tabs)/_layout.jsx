import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBoutique } from '../../lib/boutique';
import Icone from '../../components/Icone';
import { C } from '../../lib/ui';

/* ══════════════════════════════════════════════════════════════════════════
   LA BARRE D'ONGLETS

   Cinq entrées, jamais six. Le comptoir vendeur n'y figure pas : il s'ouvre
   depuis le profil, et la notification d'appel y mène directement. Mettre un
   sixième onglet réservé aux commerçants encombrerait l'écran des clients,
   qui sont cent fois plus nombreux.

   Les pastilles ne sont pas décoratives : après un ajout au panier, elles
   sont la SEULE confirmation. C'est pour ça qu'on ne met pas de message.
   ══════════════════════════════════════════════════════════════════════════ */

function Onglet({ nom, actif, badge }) {
  return (
    <View style={{ width: 44, alignItems: 'center' }}>
      {/* Plein quand l'onglet est actif, en trait sinon : c'est la convention
          que tout le monde lit sans y penser, et elle double la couleur. */}
      <Icone nom={actif ? nom + 'Plein' : nom} taille={22}
        couleur={actif ? C.orange : C.gris} />
      {badge > 0 && (
        <View style={st.pastille}>
          <Text style={st.pastilleTexte}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </View>
  );
}

export default function Onglets() {
  const { nbArticles, favoris } = useBoutique();
  // La barre gestuelle d'Android mange les libellés si on fixe la hauteur en
  // dur : on ajoute la zone sûre réelle du téléphone.
  const bas = useSafeAreaInsets().bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.orange,
        tabBarInactiveTintColor: C.gris,
        tabBarStyle: [st.barre, { height: 58 + bas, paddingBottom: 6 + bas }],
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: -2 },
        tabBarItemStyle: { paddingVertical: 4 },
      }}>
      <Tabs.Screen name="index" options={{
        title: 'Accueil',
        tabBarIcon: ({ focused }) => <Onglet nom="accueil" actif={focused} />,
      }} />
      <Tabs.Screen name="catalogue" options={{
        title: 'Catalogue',
        tabBarIcon: ({ focused }) => <Onglet nom="catalogue" actif={focused} />,
      }} />
      <Tabs.Screen name="favoris" options={{
        title: 'Favoris',
        tabBarIcon: ({ focused }) => <Onglet nom="favori" actif={focused} badge={favoris.length} />,
      }} />
      <Tabs.Screen name="panier" options={{
        title: 'Panier',
        tabBarIcon: ({ focused }) => <Onglet nom="panier" actif={focused} badge={nbArticles} />,
      }} />
      <Tabs.Screen name="profil" options={{
        title: 'Profil',
        tabBarIcon: ({ focused }) => <Onglet nom="profil" actif={focused} />,
      }} />
    </Tabs>
  );
}

const st = StyleSheet.create({
  barre: {
    backgroundColor: C.carte,
    borderTopWidth: 1, borderTopColor: C.bord,
    paddingTop: 7,
  },
  pastille: {
    position: 'absolute', top: -4, right: 6,
    minWidth: 17, height: 17, borderRadius: 9, backgroundColor: C.orange,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  pastilleTexte: { color: '#FFF', fontSize: 10, fontWeight: '700' },
});
