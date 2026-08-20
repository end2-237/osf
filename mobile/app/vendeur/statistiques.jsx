import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { Chargement, Puces } from '../../components/Base';
import { C, R, S, E, OMBRE, fcfa } from '../../lib/ui';
import Icone from '../../components/Icone';

/* LES STATISTIQUES. Pas de graphique : sur un téléphone, une courbe de sept
   points ne dit rien qu'un chiffre ne dise mieux. On donne les nombres, la
   comparaison à la période précédente, et le classement des articles — c'est
   ce dont un commerçant se sert réellement pour décider quoi racheter. */
export default function Statistiques() {
  const router = useRouter();
  const { vendor } = useSession();
  const [cmds, setCmds] = useState(null);
  const [jours, setJours] = useState(30);

  useEffect(() => {
    if (!vendor?.id) return;
    supabase.from('orders')
      .select('total_amount, status, created_at, order_items(product_name, quantity, unit_price)')
      .eq('vendor_id', vendor.id)
      .then(({ data }) => setCmds(data || []));
  }, [vendor?.id]);

  if (cmds === null) return <View style={S.page}><Chargement hauteur={400} /></View>;

  const compte = (depuis, jusqu) => cmds.filter((o) => {
    const j = (Date.now() - new Date(o.created_at)) / 864e5;
    return j >= depuis && j < jusqu && o.status !== 'cancelled';
  });

  const actuelle = compte(0, jours);
  const avant = compte(jours, jours * 2);
  const ca = (l) => l.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
  const evolution = ca(avant) ? Math.round((ca(actuelle) / ca(avant) - 1) * 100) : null;

  const parArticle = new Map();
  for (const o of actuelle) {
    for (const it of o.order_items || []) {
      const c = parArticle.get(it.product_name) || { n: 0, ca: 0 };
      c.n += it.quantity || 1;
      c.ca += (it.unit_price || 0) * (it.quantity || 1);
      parArticle.set(it.product_name, c);
    }
  }
  const top = [...parArticle.entries()].sort((a, b) => b[1].ca - a[1].ca).slice(0, 8);
  const panierMoyen = actuelle.length ? Math.round(ca(actuelle) / actuelle.length) : 0;

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable hitSlop={10} onPress={() => router.back()}>
              <Icone nom="retour" taille={25} couleur="#FFF" />
            </Pressable>
            <Text style={st.titre}>Statistiques</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={{ paddingVertical: 12 }}>
        <Puces actif={String(jours)} onChoisir={(v) => setJours(Number(v))} valeurs={[
          { valeur: '7', libelle: '7 jours' },
          { valeur: '30', libelle: '30 jours' },
          { valeur: '90', libelle: '90 jours' },
        ]} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={[st.bloc, { gap: 12 }]}>
          <View>
            <Text style={S.etiquette}>Chiffre d’affaires</Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: C.encre, marginTop: 3 }}>
              {fcfa(ca(actuelle))}
            </Text>
            {evolution !== null && (
              <Text style={{
                fontSize: 12.5, fontWeight: '700', marginTop: 3,
                color: evolution >= 0 ? C.vert : C.rouge,
              }}>
                {evolution >= 0 ? '↑' : '↓'} {Math.abs(evolution)} % par rapport aux {jours} jours précédents
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Tuile libelle="Commandes" valeur={String(actuelle.length)} />
            <Tuile libelle="Panier moyen" valeur={fcfa(panierMoyen)} />
            <Tuile libelle="Livrées" valeur={String(actuelle.filter(o => o.status === 'delivered').length)} />
          </View>
        </View>

        <View style={[st.bloc, { gap: 10 }]}>
          <Text style={S.titre}>Ce qui se vend le mieux</Text>
          {top.length === 0 ? (
            <Text style={S.sousTitre}>Aucune vente sur la période.</Text>
          ) : top.map(([nom, c], i) => (
            <View key={nom} style={st.rang}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: C.grisClair, width: 20 }}>
                {i + 1}
              </Text>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 13, color: C.encre }}>{nom}</Text>
                <Text style={{ fontSize: 11, color: C.gris }}>{c.n} vendu{c.n > 1 ? 's' : ''}</Text>
              </View>
              <Text style={{ fontSize: 13.5, fontWeight: '800', color: C.encre }}>{fcfa(c.ca)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
function Tuile({ libelle, valeur }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.champ, borderRadius: R.champ, padding: 11 }}>
      <Text style={{ fontSize: 10.5, color: C.gris, fontWeight: '600' }}>{libelle}</Text>
      <Text style={{ fontSize: 14.5, fontWeight: '800', color: C.encre, marginTop: 3 }}>{valeur}</Text>
    </View>
  );
}
const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  titre: { color: '#FFF', fontSize: 19, fontWeight: '800' },
  bloc: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 14,
    marginHorizontal: E.page, marginBottom: 12, ...OMBRE,
  },
  rang: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderTopWidth: 1, borderTopColor: C.bord, paddingTop: 9,
  },
});
