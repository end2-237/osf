import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Vide, Chargement } from '../components/Base';
import { C, R, S, E, OMBRE } from '../lib/ui';
import Icone from '../components/Icone';

/* Les boutiques. Sur une place de marché naissante, elles rassurent plus que
   les produits : on achète chez quelqu'un avant d'acheter quelque chose. */
export default function Boutiques() {
  const router = useRouter();
  const [liste, setListe] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    supabase.from('vendors')
      .select('id, shop_name, logo_url, city, plan')
      .order('shop_name')
      .then(({ data }) => setListe(data || []));
  }, []);

  const filtree = (liste || []).filter((b) =>
    !q.trim() || (b.shop_name || '').toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable hitSlop={10} onPress={() => router.back()}>
              <Icone nom="retour" taille={25} couleur="#FFF" />
            </Pressable>
            <Text style={st.titre}>Les boutiques</Text>
          </View>
          <View style={st.champ}>
            <TextInput value={q} onChangeText={setQ} placeholder="Chercher une boutique"
              placeholderTextColor="rgba(255,255,255,0.5)" style={st.saisie} />
          </View>
        </View>
      </SafeAreaView>

      {liste === null ? <Chargement /> : filtree.length === 0 ? (
        <Vide icone="boutique" titre="Aucune boutique" texte="Aucune boutique ne correspond." />
      ) : (
        <ScrollView contentContainerStyle={{ paddingVertical: 14, paddingBottom: 30, gap: 10 }}>
          {filtree.map((b) => (
            <Pressable key={b.id} onPress={() => router.push(`/boutique/${b.id}`)} style={st.carte}>
              <View style={st.logo}>
                {b.logo_url
                  ? <Image source={{ uri: b.logo_url }} style={{ width: '100%', height: '100%' }} />
                  : <Icone nom="boutique" taille={21} couleur={C.gris} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: C.encre }}>{b.shop_name}</Text>
                <Text style={{ fontSize: 12, color: C.gris, marginTop: 2 }}>
                  {b.city || 'Douala'}{b.plan && b.plan !== 'free' ? ' · Boutique vérifiée' : ''}
                </Text>
              </View>
              <Icone nom="suite" taille={18} couleur={C.grisClair} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  titre: { color: '#FFF', fontSize: 19, fontWeight: '800' },
  champ: {
    marginTop: 10, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: R.puce, paddingHorizontal: 14,
  },
  saisie: { fontSize: 15, color: '#FFF', paddingVertical: 10 },
  carte: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.carte, borderRadius: R.carte, padding: 12,
    marginHorizontal: E.page, ...OMBRE,
  },
  logo: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: C.champ,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
});
