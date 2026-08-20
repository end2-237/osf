import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { Vide, Chargement, Puces } from '../components/Base';
import { C, R, S, E, OMBRE, fcfa } from '../lib/ui';

/* ══════════════════════════════════════════════════════════════════════════
   MES COMMANDES

   Groupées par date, avec la photo des articles et le statut en clair. Deux
   actions sur une commande en cours : suivre, et confirmer la réception.

   La confirmation n'est pas une formalité : c'est elle qui libère l'argent du
   commerçant. Sans elle, la somme reste bloquée quarante-huit heures. Le
   bouton porte donc son vrai nom, et le texte dit ce qu'il déclenche.
   ══════════════════════════════════════════════════════════════════════════ */

const STATUTS = {
  pending: ['En attente', C.orange, 'La boutique doit confirmer.'],
  pending_payment: ['Paiement en attente', C.orange, 'Le paiement n’a pas abouti.'],
  paid: ['Payée', '#2C6BED', 'La boutique prépare ta commande.'],
  confirmed: ['Confirmée', '#2C6BED', 'La boutique prépare ta commande.'],
  shipped: ['Expédiée', '#7B1FA2', 'Elle est partie.'],
  in_transit: ['En route', '#7B1FA2', 'Le livreur est en chemin.'],
  delivered: ['Livrée', C.vert, 'Reçue.'],
  cancelled: ['Annulée', C.gris, ''],
};

const FILTRES = [
  { valeur: 'toutes', libelle: 'Toutes' },
  { valeur: 'cours', libelle: 'En cours' },
  { valeur: 'livrees', libelle: 'Livrées' },
];

export default function Commandes() {
  const router = useRouter();
  const { user } = useSession();
  const [liste, setListe] = useState(null);
  const [filtre, setFiltre] = useState('toutes');
  const [busy, setBusy] = useState('');

  const charger = async () => {
    if (!user) { setListe([]); return; }
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(id, product_name, product_img, quantity, unit_price), vendor:vendors!vendor_id(shop_name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setListe(data || []);
  };

  useEffect(() => { charger(); }, [user]);   // eslint-disable-line react-hooks/exhaustive-deps

  const confirmer = async (id) => {
    setBusy(id);
    await supabase.rpc('confirm_delivery', { p_order_id: id }).catch(() => {});
    await charger();
    setBusy('');
  };

  if (!user) {
    return <Vide icone="👤" titre="Connecte-toi" texte="Pour retrouver tes commandes."
      bouton="Se connecter" onBouton={() => router.push('/connexion')} />;
  }

  const filtree = (liste || []).filter((o) => {
    if (filtre === 'cours') return !['delivered', 'cancelled'].includes(o.status);
    if (filtre === 'livrees') return o.status === 'delivered';
    return true;
  });

  // Groupées par jour : « aujourd'hui » et « hier » se lisent mieux qu'une
  // date, et c'est la période où l'on cherche vraiment une commande.
  const groupes = {};
  for (const o of filtree) {
    const d = new Date(o.created_at);
    const j = Math.floor((Date.now() - d) / 864e5);
    const cle = j === 0 ? 'Aujourd’hui' : j === 1 ? 'Hier'
      : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    (groupes[cle] ||= []).push(o);
  }

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
        <Puces valeurs={FILTRES} actif={filtre} onChoisir={setFiltre} />
      </View>

      {liste === null ? <Chargement /> : filtree.length === 0 ? (
        <Vide icone="📦" titre="Aucune commande"
          texte="Tes commandes s’afficheront ici, avec leur suivi."
          bouton="Voir le catalogue" onBouton={() => router.push('/catalogue')} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          {Object.entries(groupes).map(([jour, cmds]) => (
            <View key={jour} style={{ marginBottom: 8 }}>
              <Text style={st.jour}>{jour}</Text>
              {cmds.map((o) => {
                const [lib, couleur, aide] = STATUTS[o.status] || ['—', C.gris, ''];
                const enCours = !['delivered', 'cancelled'].includes(o.status);
                return (
                  <View key={o.id} style={st.carte}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: C.encre }}>
                        Commande nº {String(o.id).slice(0, 6).toUpperCase()}
                      </Text>
                      <View style={[st.statut, { backgroundColor: couleur + '18' }]}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: couleur }}>{lib}</Text>
                      </View>
                    </View>

                    {!!o.vendor?.shop_name && (
                      <Text style={{ fontSize: 12, color: C.gris, marginTop: 2 }}>
                        {o.vendor.shop_name}
                        {o.fulfilment === 'comptoir' ? ' · retrait au comptoir' : ''}
                      </Text>
                    )}

                    <ScrollView horizontal showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, marginTop: 10 }}>
                      {(o.order_items || []).map((it) => (
                        <View key={it.id} style={{ width: 54 }}>
                          <Image source={{ uri: it.product_img }} resizeMode="contain"
                            style={st.vignette} />
                          {it.quantity > 1 && (
                            <View style={st.qte}>
                              <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>
                                ×{it.quantity}
                              </Text>
                            </View>
                          )}
                        </View>
                      ))}
                    </ScrollView>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                      <Text style={{ flex: 1, fontSize: 11.5, color: C.gris }}>{aide}</Text>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: C.encre }}>
                        {fcfa(o.total_amount)}
                      </Text>
                    </View>

                    {enCours && (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 11 }}>
                        <Pressable onPress={() => router.push(`/commandes/${o.id}`)}
                          style={[S.boutonFin, { flex: 1 }]}>
                          <Text style={S.boutonFinTexte}>Suivre</Text>
                        </Pressable>
                        {['shipped', 'in_transit', 'paid'].includes(o.status) && (
                          <Pressable onPress={() => confirmer(o.id)} disabled={busy === o.id}
                            style={[S.bouton, { flex: 1, paddingVertical: 12 }]}>
                            <Text style={[S.boutonTexte, { fontSize: 13 }]}>
                              {busy === o.id ? '…' : 'J’ai reçu'}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
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
  jour: {
    fontSize: 12, fontWeight: '700', color: C.gris,
    paddingHorizontal: E.page, marginBottom: 8, marginTop: 6,
  },
  carte: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 13,
    marginHorizontal: E.page, marginBottom: 10, ...OMBRE,
  },
  statut: { borderRadius: R.puce, paddingHorizontal: 10, paddingVertical: 4 },
  vignette: { width: 54, height: 54, borderRadius: 9, backgroundColor: '#FFF' },
  qte: {
    position: 'absolute', bottom: 2, right: 2, backgroundColor: C.marine,
    borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1,
  },
});
