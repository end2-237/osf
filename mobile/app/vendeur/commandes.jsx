import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, Linking, RefreshControl, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { Vide, Chargement, Puces } from '../../components/Base';
import { C, R, S, E, OMBRE, fcfa } from '../../lib/ui';

/* ══════════════════════════════════════════════════════════════════════════
   LES COMMANDES DU COMMERÇANT

   Un écran d'action, pas de consultation. Chaque commande porte son geste
   suivant, et un seul : confirmer, expédier, marquer livrée.

   Le numéro du client est cliquable. C'est le détail qui change tout au
   Cameroun : la moitié des commandes se règlent par un appel — une taille,
   une couleur, un point de rendez-vous — et obliger à recopier un numéro à
   la main pour ça, c'est perdre la commande.
   ══════════════════════════════════════════════════════════════════════════ */

const SUITE = {
  pending:    { libelle: 'En attente', couleur: C.orange, action: 'Confirmer', vers: 'confirmed' },
  pending_payment: { libelle: 'Paiement en attente', couleur: C.orange, action: null },
  paid:       { libelle: 'Payée', couleur: '#2C6BED', action: 'Expédier', vers: 'shipped' },
  confirmed:  { libelle: 'Confirmée', couleur: '#2C6BED', action: 'Expédier', vers: 'shipped' },
  shipped:    { libelle: 'Expédiée', couleur: '#7B1FA2', action: 'Marquer livrée', vers: 'delivered' },
  in_transit: { libelle: 'En route', couleur: '#7B1FA2', action: 'Marquer livrée', vers: 'delivered' },
  delivered:  { libelle: 'Livrée', couleur: C.vert, action: null },
  cancelled:  { libelle: 'Annulée', couleur: C.gris, action: null },
};

export default function CommandesVendeur() {
  const router = useRouter();
  const { vendor } = useSession();
  const [liste, setListe] = useState(null);
  const [filtre, setFiltre] = useState('afaire');
  const [busy, setBusy] = useState('');
  const [raf, setRaf] = useState(false);

  const charger = useCallback(async () => {
    if (!vendor?.id) return;
    const { data } = await supabase.from('orders')
      .select('*, order_items(id, product_name, product_img, quantity, unit_price, selected_size, selected_color)')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false }).limit(100);
    setListe(data || []);
  }, [vendor?.id]);

  useEffect(() => { charger(); }, [charger]);

  const avancer = async (o, vers) => {
    setBusy(o.id);
    await supabase.from('orders').update({
      status: vers,
      ...(vers === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
    }).eq('id', o.id);
    await charger();
    setBusy('');
  };

  const filtree = (liste || []).filter((o) => {
    if (filtre === 'afaire') return !['delivered', 'cancelled'].includes(o.status);
    if (filtre === 'livrees') return o.status === 'delivered';
    return true;
  });

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable hitSlop={10} onPress={() => router.back()}>
              <Text style={{ color: '#FFF', fontSize: 24 }}>‹</Text>
            </Pressable>
            <Text style={st.titre}>Mes commandes</Text>
          </View>
        </View>
      </SafeAreaView>

      <View style={{ paddingVertical: 12 }}>
        <Puces actif={filtre} onChoisir={setFiltre} valeurs={[
          { valeur: 'afaire', libelle: 'À traiter' },
          { valeur: 'livrees', libelle: 'Livrées' },
          { valeur: 'toutes', libelle: 'Toutes' },
        ]} />
      </View>

      {liste === null ? <Chargement /> : filtree.length === 0 ? (
        <Vide icone="📦" titre="Rien à traiter"
          texte="Les commandes de tes clients s’afficheront ici, avec le geste à faire." />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 30, gap: 10 }}
          refreshControl={<RefreshControl refreshing={raf}
            onRefresh={async () => { setRaf(true); await charger(); setRaf(false); }} />}>
          {filtree.map((o) => {
            const s = SUITE[o.status] || { libelle: o.status, couleur: C.gris };
            const comptoir = o.fulfilment === 'comptoir';
            return (
              <View key={o.id} style={st.carte}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: C.encre }}>
                    nº {String(o.id).slice(0, 6).toUpperCase()}
                  </Text>
                  <View style={[st.statut, { backgroundColor: s.couleur + '18' }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: s.couleur }}>
                      {s.libelle}
                    </Text>
                  </View>
                </View>

                {/* Le client, avec son numéro cliquable */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: '600', color: C.encre }}>
                      {o.client_name || 'Client'}
                    </Text>
                    <Text style={{ fontSize: 12, color: C.gris, marginTop: 1 }}>
                      {comptoir ? '🏪 Retrait au comptoir' : `📍 ${o.client_address || '—'}`}
                    </Text>
                  </View>
                  {!!o.client_phone && (
                    <>
                      <Pressable onPress={() => Linking.openURL(`tel:${o.client_phone}`)}
                        style={st.rond}>
                        <Text style={{ fontSize: 15 }}>📞</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => Linking.openURL(
                          `https://wa.me/237${String(o.client_phone).replace(/\D/g, '').slice(-9)}`)}
                        style={[st.rond, { backgroundColor: '#25D366' }]}>
                        <Text style={{ fontSize: 15 }}>💬</Text>
                      </Pressable>
                    </>
                  )}
                </View>

                {/* Les articles, avec la déclinaison choisie */}
                <View style={{ marginTop: 10, gap: 7 }}>
                  {(o.order_items || []).map((it) => (
                    <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                      <Image source={{ uri: it.product_img }} resizeMode="contain"
                        style={st.vignette} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 12.5, color: C.encre }}>
                          {it.product_name}
                        </Text>
                        <Text style={{ fontSize: 11, color: C.gris }}>
                          × {it.quantity}
                          {[it.selected_color, it.selected_size].filter(Boolean).length
                            ? ` · ${[it.selected_color, it.selected_size].filter(Boolean).join(' · ')}`
                            : ''}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12.5, fontWeight: '700' }}>
                        {fcfa(it.unit_price * it.quantity)}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={st.pied}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: C.encre }}>
                      {fcfa(o.total_amount)}
                    </Text>
                    <Text style={{ fontSize: 11, color: C.gris }}>
                      {o.payment_method === 'cash_on_delivery'
                        ? 'À encaisser à la livraison'
                        : 'Payé en ligne'}
                    </Text>
                  </View>
                  {!!s.action && (
                    <Pressable onPress={() => avancer(o, s.vers)} disabled={busy === o.id}
                      style={[S.bouton, { paddingHorizontal: 20, paddingVertical: 11 }]}>
                      <Text style={[S.boutonTexte, { fontSize: 13 }]}>
                        {busy === o.id ? '…' : s.action}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  titre: { color: '#FFF', fontSize: 19, fontWeight: '800' },
  carte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 13,
    marginHorizontal: E.page, ...OMBRE,
  },
  statut: { borderRadius: R.puce, paddingHorizontal: 10, paddingVertical: 4 },
  rond: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: C.champ,
    alignItems: 'center', justifyContent: 'center',
  },
  vignette: { width: 38, height: 44, borderRadius: 8, backgroundColor: '#FFF' },
  pied: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12,
    borderTopWidth: 1, borderTopColor: C.bord, paddingTop: 11,
  },
});
