import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { produits } from '../../lib/boutique';
import CarteProduit from '../../components/CarteProduit';
import { Vide, Chargement, TitreSection } from '../../components/Base';
import { C, R, S, E, OMBRE , useGrille, COLONNES } from '../../lib/ui';
import Icone from '../../components/Icone';

/* La fiche boutique : qui vend, où, et tout son rayon. Le code d'affiliation
   n'y figure pas — il appartient à l'affiche du comptoir, pas à la vitrine. */
export default function Boutique() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { cellule } = useGrille(COLONNES.produits);
  const [b, setB] = useState(null);
  const [liste, setListe] = useState(null);

  useEffect(() => {
    supabase.from('vendors').select('*').eq('id', id).maybeSingle()
      .then(({ data }) => setB(data));
    produits({ vendorId: id, limite: 40 }).then(({ data }) => setListe(data));
  }, [id]);

  if (!b) return <View style={S.page}><Chargement hauteur={400} /></View>;

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <Pressable hitSlop={10} onPress={() => router.back()}>
            <Icone nom="retour" taille={25} couleur="#FFF" />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <View style={st.logo}>
              {b.logo_url
                ? <Image source={{ uri: b.logo_url }} style={{ width: '100%', height: '100%' }} />
                : <Icone nom="boutique" taille={25} couleur="#FFF" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFF', fontSize: 19, fontWeight: '800' }}>{b.shop_name}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginTop: 2 }}>
                {b.city || 'Douala'}{b.pickup_label ? ` · ${b.pickup_label}` : ''}
              </Text>
            </View>
          </View>
          {!!b.bio && (
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 10, lineHeight: 18 }}>
              {b.bio}
            </Text>
          )}
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingVertical: 14, paddingBottom: 30 }}>
        {liste === null ? <Chargement /> : liste.length === 0 ? (
          <Vide icone="colis" titre="Aucun article" texte="Cette boutique n’a rien publié pour l’instant." />
        ) : (
          <>
            <TitreSection titre={`${liste.length} article${liste.length > 1 ? 's' : ''}`} />
            <View style={st.grille}>
              {liste.map((p) => (
                <View key={p.id} style={{ width: cellule }}>
                  <CarteProduit p={p} />
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  logo: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: E.gouttiere, paddingHorizontal: E.page },
});
