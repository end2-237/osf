import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBoutique } from '../../lib/boutique';
import CarteProduit from '../../components/CarteProduit';
import { Vide } from '../../components/Base';
import { C, R, S, E, useGrille, COLONNES } from '../../lib/ui';
import Icone from '../../components/Icone';

/* Les favoris sont la liste d'envies, et c'est souvent le vrai panier : on y
   met ce qu'on achètera à la paie. D'où le bouton qui bascule tout d'un coup
   vers le panier. */
export default function Favoris() {
  const router = useRouter();
  const { favoris, ouvrirChoix } = useBoutique();
  const { cellule } = useGrille(COLONNES.produits);

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <Text style={st.titre}>Mes favoris</Text>
          {favoris.length > 0 && (
            <Text style={st.sousTitre}>
              {favoris.length} article{favoris.length > 1 ? 's' : ''} gardé{favoris.length > 1 ? 's' : ''} de côté
            </Text>
          )}
        </View>
      </SafeAreaView>

      {favoris.length === 0 ? (
        <Vide icone="favori" titre="Aucun favori"
          texte="Touche le cœur d’un article pour le garder ici. Rien ne t’engage — c’est ta liste d’envies."
          bouton="Voir le catalogue" onBouton={() => router.push('/catalogue')} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingVertical: 14, paddingBottom: 28 }}>
          <View style={st.grille}>
            {favoris.map((p) => (
              <View key={p.id} style={{ width: cellule }}>
                <CarteProduit p={p} />
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => favoris.forEach((p) => ouvrirChoix(p))}
            style={[S.boutonFin, { marginHorizontal: E.page, marginTop: 16 }]}>
            <Text style={S.boutonFinTexte}>Tout mettre au panier</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  titre: { color: '#FFF', fontSize: 19, fontWeight: '800' },
  sousTitre: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginTop: 2 },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: E.gouttiere, paddingHorizontal: E.page },
});
