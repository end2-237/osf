import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { Vide, Chargement } from '../../components/Base';
import { C, R, S, E, OMBRE, fcfa } from '../../lib/ui';

/* MES CLIENTS — reconstruits depuis les commandes, pas depuis une table à
   part. Un fichier client tenu à la main n'est jamais à jour ; celui-ci l'est
   par construction. Trié par ce qu'ils ont dépensé : c'est l'ordre dans
   lequel un commerçant décide qui rappeler. */
export default function Clients() {
  const router = useRouter();
  const { vendor } = useSession();
  const [liste, setListe] = useState(null);

  useEffect(() => {
    if (!vendor?.id) return;
    supabase.from('orders')
      .select('client_name, client_phone, total_amount, status, created_at')
      .eq('vendor_id', vendor.id)
      .then(({ data }) => {
        const par = new Map();
        for (const o of data || []) {
          const k = (o.client_phone || o.client_name || '?').trim();
          const c = par.get(k) || { nom: o.client_name, tel: o.client_phone, n: 0, total: 0, dernier: o.created_at };
          c.n += 1;
          if (['paid','confirmed','shipped','in_transit','delivered'].includes(o.status)) {
            c.total += Number(o.total_amount) || 0;
          }
          if (new Date(o.created_at) > new Date(c.dernier)) c.dernier = o.created_at;
          par.set(k, c);
        }
        setListe([...par.values()].sort((a, b) => b.total - a.total));
      });
  }, [vendor?.id]);

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable hitSlop={10} onPress={() => router.back()}>
              <Text style={{ color: '#FFF', fontSize: 24 }}>‹</Text>
            </Pressable>
            <Text style={st.titre}>Mes clients</Text>
          </View>
          {!!liste && (
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, marginTop: 2 }}>
              {liste.length} client{liste.length > 1 ? 's' : ''} · {fcfa(liste.reduce((s, c) => s + c.total, 0))} au total
            </Text>
          )}
        </View>
      </SafeAreaView>

      {liste === null ? <Chargement /> : liste.length === 0 ? (
        <Vide icone="👥" titre="Aucun client"
          texte="Tes clients apparaîtront ici dès ta première commande." />
      ) : (
        <ScrollView contentContainerStyle={{ paddingVertical: 14, paddingBottom: 30, gap: 10 }}>
          {liste.map((c, i) => (
            <View key={i} style={st.carte}>
              <View style={st.rond}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.marine }}>
                  {(c.nom || '?').slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.encre }}>
                  {c.nom || 'Client'}
                </Text>
                <Text style={{ fontSize: 11.5, color: C.gris, marginTop: 1 }}>
                  {c.n} commande{c.n > 1 ? 's' : ''} · dernière le{' '}
                  {new Date(c.dernier).toLocaleDateString('fr-FR')}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.encre, marginTop: 4 }}>
                  {fcfa(c.total)}
                </Text>
              </View>
              {!!c.tel && (
                <View style={{ gap: 6 }}>
                  <Pressable onPress={() => Linking.openURL(`tel:${c.tel}`)} style={st.action}>
                    <Text style={{ fontSize: 14 }}>📞</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => Linking.openURL(`https://wa.me/237${String(c.tel).replace(/\D/g,'').slice(-9)}`)}
                    style={[st.action, { backgroundColor: '#25D366' }]}>
                    <Text style={{ fontSize: 14 }}>💬</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  titre: { color: '#FFF', fontSize: 19, fontWeight: '800' },
  carte: {
    flexDirection: 'row', gap: 11, backgroundColor: C.carte,
    borderRadius: R.carte, padding: 12, marginHorizontal: E.page, ...OMBRE,
  },
  rond: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: C.champ,
    alignItems: 'center', justifyContent: 'center',
  },
  action: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: C.champ,
    alignItems: 'center', justifyContent: 'center',
  },
});
