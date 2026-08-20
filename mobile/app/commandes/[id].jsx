import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, StyleSheet, Linking, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { Barre, Vide } from '../../components/Base';
import { C, R, S, E, OMBRE, fcfa } from '../../lib/ui';
import Icone from '../../components/Icone';

/* ══════════════════════════════════════════════════════════════════════════
   UNE COMMANDE

   Le détail répond à trois questions, dans cet ordre : où en est-elle, ce
   qu'elle contient, combien elle a coûté. Le suivi est en haut parce que
   c'est la seule raison pour laquelle on rouvre une commande passée.

   Le fil d'étapes montre TOUTES les étapes, y compris celles qui restent :
   n'afficher que le franchi laisse croire que c'est fini. On voit ce qui a
   été fait, et ce qui vient.

   Le numéro de la boutique est cliquable. La moitié des questions — une
   taille, un point de rendez-vous — se règlent par un appel, et faire
   recopier un numéro à la main, c'est la question qui ne sera pas posée.
   ══════════════════════════════════════════════════════════════════════════ */

const STATUTS = {
  pending: ['En attente', C.orange, 'La boutique doit confirmer.'],
  pending_payment: ['Paiement en attente', C.orange, 'Le paiement n’a pas abouti.'],
  paid: ['Payée', '#2C6BED', 'La boutique prépare ta commande.'],
  confirmed: ['Confirmée', '#2C6BED', 'La boutique prépare ta commande.'],
  shipped: ['Expédiée', '#7B1FA2', 'Elle est partie.'],
  in_transit: ['En route', '#7B1FA2', 'Le livreur est en chemin.'],
  delivered: ['Livrée', C.vert, 'Reçue.'],
  cancelled: ['Annulée', C.gris, 'Cette commande n’ira pas plus loin.'],
};

// Le fil que suit une commande normale. Une commande annulée en sort, d'où le
// traitement à part plus bas.
const FIL = [
  { cles: ['pending', 'pending_payment'], t: 'Commandée', i: 'colis' },
  { cles: ['paid', 'confirmed'], t: 'Confirmée par la boutique', i: 'coche' },
  { cles: ['shipped', 'in_transit'], t: 'En route', i: 'camion' },
  { cles: ['delivered'], t: 'Livrée', i: 'boutique' },
];

const MOYENS = {
  orange_money: 'Orange Money',
  mtn_momo: 'MTN MoMo',
  cash_on_delivery: 'À la livraison',
};

export default function Commande() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useSession();

  const [o, setO] = useState(undefined);
  const [busy, setBusy] = useState(false);

  const charger = async () => {
    const { data } = await supabase.from('orders')
      .select('*, order_items(id, product_id, product_name, product_img, quantity, unit_price, selected_size, selected_color), vendor:vendors!vendor_id(id, shop_name, phone, city)')
      .eq('id', id).maybeSingle();
    setO(data || null);
  };

  useEffect(() => { if (id) charger(); }, [id]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (o === undefined) {
    return (
      <View style={S.page}>
        <Barre titre="Ma commande" />
        <ActivityIndicator style={{ marginTop: 40 }} color={C.marine} />
      </View>
    );
  }

  if (!o) {
    return (
      <View style={S.page}>
        <Barre titre="Ma commande" />
        <Vide icone="colis" titre="Commande introuvable"
          texte="Elle n’existe plus, ou elle appartient à un autre compte."
          bouton="Voir mes commandes" onBouton={() => router.replace('/commandes')} />
      </View>
    );
  }

  const [libelle, teinte, dit] = STATUTS[o.status] || ['En cours', C.gris, ''];
  const annulee = o.status === 'cancelled';
  const etape = FIL.findIndex((e) => e.cles.includes(o.status));
  const articles = o.order_items || [];

  const sousTotal = articles.reduce(
    (s, a) => s + (Number(a.unit_price) || 0) * (Number(a.quantity) || 1), 0);
  const total = Number(o.total_amount) || sousTotal;
  const livraison = Math.max(0, total - sousTotal);

  const confirmer = async () => {
    setBusy(true);
    await supabase.rpc('confirm_delivery', { p_order_id: o.id }).catch(() => {});
    await charger();
    setBusy(false);
  };

  const appeler = () => {
    const n = (o.vendor?.phone || '').replace(/\s/g, '');
    if (n) Linking.openURL(`tel:${n}`).catch(() => {});
  };

  return (
    <View style={S.page}>
      <Barre titre={`Commande n° ${String(o.id).slice(0, 8)}`}
        sousTitre={o.created_at
          ? new Date(o.created_at).toLocaleDateString('fr-FR',
              { day: 'numeric', month: 'long', year: 'numeric' })
          : undefined} />

      <ScrollView contentContainerStyle={{ padding: E.page, paddingBottom: 40, gap: 12 }}>

        {/* ① Où elle en est */}
        <View style={st.bloc}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[st.pastille, { backgroundColor: teinte }]} />
            <Text style={{ fontSize: 16, fontWeight: '800', color: teinte }}>{libelle}</Text>
          </View>
          {!!dit && <Text style={st.dit}>{dit}</Text>}

          {!annulee && (
            <View style={{ marginTop: 14, gap: 0 }}>
              {FIL.map((e, i) => {
                const fait = etape >= 0 && i <= etape;
                const courant = i === etape;
                return (
                  <View key={e.t} style={{ flexDirection: 'row', gap: 11 }}>
                    <View style={{ alignItems: 'center', width: 26 }}>
                      <View style={[st.jalon, fait && { backgroundColor: teinte, borderColor: teinte }]}>
                        <Icone nom={fait ? 'coche' : e.i} taille={12}
                          couleur={fait ? '#FFF' : C.grisClair} />
                      </View>
                      {i < FIL.length - 1 && (
                        <View style={[st.trait, i < etape && { backgroundColor: teinte }]} />
                      )}
                    </View>
                    <View style={{ flex: 1, paddingBottom: i < FIL.length - 1 ? 14 : 0 }}>
                      <Text style={[st.jalonTexte,
                        fait && { color: C.encre, fontWeight: '700' },
                        courant && { color: teinte }]}>
                        {e.t}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ② La boutique */}
        {!!o.vendor && (
          <View style={[st.bloc, { flexDirection: 'row', alignItems: 'center', gap: 11 }]}>
            <View style={st.rondBoutique}>
              <Icone nom="boutique" taille={19} couleur={C.orange} />
            </View>
            <Pressable style={{ flex: 1 }}
              onPress={() => o.vendor.id && router.push(`/boutique/${o.vendor.id}`)}>
              <Text style={{ fontSize: 14.5, fontWeight: '700', color: C.encre }}>
                {o.vendor.shop_name}
              </Text>
              {!!o.vendor.city && <Text style={{ fontSize: 12, color: C.gris }}>{o.vendor.city}</Text>}
            </Pressable>
            {!!o.vendor.phone && (
              <Pressable onPress={appeler} style={st.appel}>
                <Icone nom="telephone" taille={16} couleur="#FFF" />
              </Pressable>
            )}
          </View>
        )}

        {/* ③ Ce qu'elle contient */}
        <View style={[st.bloc, { gap: 11 }]}>
          <Text style={S.titre}>
            {articles.length} article{articles.length > 1 ? 's' : ''}
          </Text>
          {articles.map((a) => (
            <Pressable key={a.id}
              onPress={() => a.product_id && router.push(`/produit/${a.product_id}`)}
              style={{ flexDirection: 'row', gap: 11, alignItems: 'center' }}>
              <View style={st.vignette}>
                {a.product_img
                  ? <Image source={{ uri: a.product_img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  : <Icone nom="colis" taille={20} couleur={C.grisClair} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13.5, color: C.encre, lineHeight: 18 }} numberOfLines={2}>
                  {a.product_name}
                </Text>
                {(a.selected_size || a.selected_color) && (
                  <Text style={{ fontSize: 11.5, color: C.gris, marginTop: 2 }}>
                    {[a.selected_color, a.selected_size].filter(Boolean).join(' · ')}
                  </Text>
                )}
                <Text style={{ fontSize: 12.5, color: C.gris, marginTop: 2 }}>
                  {a.quantity} × {fcfa(a.unit_price)}
                </Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.encre }}>
                {fcfa((Number(a.unit_price) || 0) * (Number(a.quantity) || 1))}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ④ Combien */}
        <View style={[st.bloc, { gap: 7 }]}>
          <Text style={S.titre}>Le compte</Text>
          <Rangee k="Articles" v={fcfa(sousTotal)} />
          {livraison > 0 && <Rangee k="Livraison" v={fcfa(livraison)} />}
          <View style={st.filet} />
          <Rangee k="Total" v={fcfa(total)} fort />
          <Text style={{ fontSize: 12, color: C.gris, marginTop: 4 }}>
            Payée par {MOYENS[o.payment_method] || o.payment_method || '—'}
          </Text>
        </View>

        {/* ⑤ Où elle va */}
        {!!(o.shipping_address || o.delivery_address || o.address) && (
          <View style={st.bloc}>
            <Text style={S.titre}>Livraison</Text>
            <Text style={{ fontSize: 13, color: C.encre, marginTop: 6, lineHeight: 19 }}>
              {o.shipping_address || o.delivery_address || o.address}
            </Text>
          </View>
        )}

        {/* ⑥ Le geste suivant, et un seul */}
        {['shipped', 'in_transit'].includes(o.status) && (
          <>
            <Pressable disabled={busy} onPress={confirmer}
              style={[S.bouton, busy && S.boutonEteint]}>
              <Text style={[S.boutonTexte, busy && S.boutonEteintTexte]}>
                {busy ? 'Un instant…' : 'J’ai reçu ma commande'}
              </Text>
            </Pressable>
            <Text style={{ fontSize: 11.5, color: C.gris, textAlign: 'center', lineHeight: 16 }}>
              C’est ce bouton qui libère l’argent du commerçant. Ne le touche
              qu’une fois l’article en main.
            </Text>
          </>
        )}

        {o.status === 'delivered' && (
          <Pressable onPress={() => router.push('/avis')} style={S.boutonFin}>
            <Text style={S.boutonFinTexte}>Donner mon avis</Text>
          </Pressable>
        )}

        <Pressable onPress={() => router.push('/aide')} style={S.boutonFin}>
          <Text style={S.boutonFinTexte}>Un problème avec cette commande</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Rangee({ k, v, fort }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: fort ? 15 : 13, color: fort ? C.encre : C.gris,
        fontWeight: fort ? '700' : '400' }}>{k}</Text>
      <Text style={{ fontSize: fort ? 17 : 13, color: C.encre,
        fontWeight: fort ? '800' : '600' }}>{v}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  bloc: { backgroundColor: C.carte, borderRadius: R.carte, padding: 14, ...OMBRE },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  dit: { fontSize: 13, color: C.gris, marginTop: 6, lineHeight: 18 },

  jalon: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: C.bord,
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.carte,
  },
  trait: { width: 2, flex: 1, backgroundColor: C.bord, minHeight: 14 },
  jalonTexte: { fontSize: 13.5, color: C.gris, lineHeight: 24 },

  rondBoutique: {
    width: 40, height: 40, borderRadius: R.vignette, backgroundColor: C.orangePale,
    alignItems: 'center', justifyContent: 'center',
  },
  appel: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: C.vert,
    alignItems: 'center', justifyContent: 'center',
  },

  vignette: {
    width: 50, height: 50, borderRadius: R.vignette, backgroundColor: C.champ,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  filet: { height: 1, backgroundColor: C.bord, marginVertical: 4 },
});
