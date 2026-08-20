import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { C } from '../lib/ui';

/* ══════════════════════════════════════════════════════════════════════════
   LA MARQUE

   Le « b » vient du fichier du site — `assets/buyticle.svg`, recopié tel quel
   et rendu en PNG. Rien n'est redessiné ici : deux marques légèrement
   différentes entre le site et l'application, et plus personne ne sait
   laquelle est la bonne.

   Le mot est en typographie, pas en image : à cette taille une image de texte
   bave sur les écrans d'entrée de gamme, et le mot doit rester net — c'est ce
   qu'on lit, le sigle n'est que ce qu'on reconnaît.
   ══════════════════════════════════════════════════════════════════════════ */

export default function Logo({ taille = 22, couleur = '#FFF', mot = true }) {
  return (
    <View style={st.rangee}>
      <Image
        source={require('../assets/marque.png')}
        style={{ width: taille * 1.05, height: taille * 1.05 }}
        resizeMode="contain"
      />
      {mot && (
        <Text style={[st.mot, { fontSize: taille * 0.95, color: couleur }]}>
          buy<Text style={{ color: C.orange }}>ticle</Text>
        </Text>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  rangee: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  mot: { fontWeight: '800', letterSpacing: -0.5 },
});
