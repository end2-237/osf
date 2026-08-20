import React from 'react';
import { View, Text, ScrollView, Pressable, Linking, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ligne } from '../components/Base';
import { C, R, S, E, OMBRE } from '../lib/ui';
import Icone from '../components/Icone';

/* L'assistance. WhatsApp d'abord : c'est là que les gens écrivent réellement,
   et un formulaire de contact reste sans réponse dans les deux sens. */
export default function Aide() {
  const router = useRouter();
  const QUESTIONS = [
    ['Comment suivre ma commande ?', 'Depuis « Mes commandes » : chaque commande porte son statut et son suivi.'],
    ['Quand suis-je débité ?', 'À la validation du paiement Mobile Money. En paiement à la livraison, tu paies au livreur.'],
    ['Comment marche le relais ?', 'Quand un commerçant n’a pas ton article, il t’envoie chez un voisin qui l’a — et tu paies moins cher qu’au prix affiché.'],
    ['Et si l’article ne convient pas ?', 'Tu peux demander un retour depuis la commande livrée, sous 48 h.'],
    ['Quand mes bonus arrivent-ils ?', 'À la livraison de la commande, jamais à la commande elle-même.'],
  ];
  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable hitSlop={10} onPress={() => router.back()}>
              <Icone nom="retour" taille={25} couleur="#FFF" />
            </Pressable>
            <Text style={st.titre}>Assistance</Text>
          </View>
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ paddingVertical: 14, paddingBottom: 30 }}>
        <Pressable onPress={() => Linking.openURL('https://wa.me/237699000000')} style={st.wa}>
          <Icone nom="message" taille={26} couleur="#FFF" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>Écris-nous sur WhatsApp</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
              Réponse dans la journée, du lundi au samedi
            </Text>
          </View>
        </Pressable>
        <View style={[st.bloc, { gap: 14 }]}>
          <Text style={S.titre}>Questions fréquentes</Text>
          {QUESTIONS.map(([q, r]) => (
            <View key={q} style={{ gap: 3 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: C.encre }}>{q}</Text>
              <Text style={{ fontSize: 13, color: C.gris, lineHeight: 18 }}>{r}</Text>
            </View>
          ))}
        </View>
        <View style={[st.bloc, { padding: 0, overflow: 'hidden' }]}>
          <Ligne icone="document" titre="Conditions de vente" onPress={() => Linking.openURL('https://www.buyticle.store/cgv')} />
          <Ligne icone="cadenas" titre="Confidentialité" onPress={() => Linking.openURL('https://www.buyticle.store/terms')} />
          <Ligne icone="info" titre="À propos" onPress={() => router.push('/a-propos')} />
        </View>
      </ScrollView>
    </View>
  );
}
const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  titre: { color: '#FFF', fontSize: 19, fontWeight: '800' },
  wa: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#25D366',
    borderRadius: R.carte, padding: 15, marginHorizontal: E.page, marginBottom: 12,
  },
  bloc: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 14,
    marginHorizontal: E.page, marginBottom: 12, ...OMBRE,
  },
});
