import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../lib/session';
import { soldeBon, appelsEnAttente } from '../../lib/relais';
import { Vide, Chargement, Ligne } from '../../components/Base';
import { C, R, S, E, OMBRE, fcfa } from '../../lib/ui';

/* ══════════════════════════════════════════════════════════════════════════
   LE TABLEAU DE BORD DU COMMERÇANT

   Il ouvre sur ce qui demande une action aujourd'hui, pas sur des courbes.
   Un commerçant regarde son téléphone entre deux clients : s'il doit chercher
   ce qu'il a à faire, il ne le fait pas.

   D'où l'ordre : les appels en attente d'abord — trente secondes, ça ne se
   rattrape pas —, puis les commandes à confirmer, puis l'argent, puis le
   reste. Les statistiques viennent en dernier ; elles se consultent le soir.
   ══════════════════════════════════════════════════════════════════════════ */

export default function Vendeur() {
  const router = useRouter();
  const { user, vendor, charge } = useSession();

  const [cmds, setCmds] = useState(null);
  const [solde, setSolde] = useState(null);
  const [bon, setBon] = useState(null);
  const [appels, setAppels] = useState(0);
  const [raf, setRaf] = useState(false);

  const charger = useCallback(async () => {
    if (!vendor?.id) return;
    const [c, b, s, a] = await Promise.all([
      supabase.from('orders')
        .select('id, total_amount, status, created_at, client_name')
        .eq('vendor_id', vendor.id).order('created_at', { ascending: false }).limit(50),
      supabase.rpc('vendor_balance', { p_vendor_id: vendor.id }),
      soldeBon(vendor.id),
      appelsEnAttente(vendor.id),
    ]);
    setCmds(c.data || []);
    setSolde(b.data?.[0] || null);
    setBon(s.data?.[0] || null);
    setAppels((a.data || []).length);
  }, [vendor?.id]);

  useEffect(() => { charger(); }, [charger]);

  // Les appels ne peuvent pas attendre un tirage : on regarde toutes les
  // cinq secondes tant que l'écran est ouvert.
  useEffect(() => {
    if (!vendor?.id) return;
    const t = setInterval(() => {
      appelsEnAttente(vendor.id).then(({ data }) => setAppels((data || []).length));
    }, 5000);
    return () => clearInterval(t);
  }, [vendor?.id]);

  if (charge) return <View style={S.page}><Chargement hauteur={400} /></View>;

  if (!vendor) {
    return (
      <View style={S.page}>
        <Vide icone="🏬" titre="Ce compte n’a pas de boutique"
          texte="Le comptoir s’ouvre pour les commerçants inscrits. Écris-nous si tu veux vendre sur Buyticle."
          bouton="Retour" onBouton={() => router.replace('/')} />
      </View>
    );
  }

  const aConfirmer = (cmds || []).filter((o) => o.status === 'pending').length;
  const duJour = (cmds || []).filter((o) =>
    new Date(o.created_at).toDateString() === new Date().toDateString());
  const caJour = duJour
    .filter((o) => o.status !== 'cancelled')
    .reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
  const caMois = (cmds || [])
    .filter((o) => ['paid', 'confirmed', 'shipped', 'in_transit', 'delivered'].includes(o.status))
    .reduce((s, o) => s + (Number(o.total_amount) || 0), 0);

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable hitSlop={10} onPress={() => router.back()}>
              <Text style={{ color: '#FFF', fontSize: 24 }}>‹</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={st.titre} numberOfLines={1}>{vendor.shop_name}</Text>
              <Text style={st.sousTitre}>
                Forfait {vendor.plan === 'free' || !vendor.plan ? 'gratuit' : vendor.plan}
              </Text>
            </View>
          </View>

          <View style={st.chiffres}>
            <View style={st.chiffre}>
              <Text style={st.chiffreValeur}>{fcfa(caJour)}</Text>
              <Text style={st.chiffreLibelle}>aujourd’hui</Text>
            </View>
            <View style={st.chiffre}>
              <Text style={st.chiffreValeur}>{duJour.length}</Text>
              <Text style={st.chiffreLibelle}>commandes</Text>
            </View>
            <View style={st.chiffre}>
              <Text style={st.chiffreValeur}>{fcfa(caMois)}</Text>
              <Text style={st.chiffreLibelle}>encaissé</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingVertical: 14, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={raf}
          onRefresh={async () => { setRaf(true); await charger(); setRaf(false); }} />}>

        {/* ① Ce qui ne peut pas attendre */}
        {appels > 0 && (
          <Pressable onPress={() => router.push('/vendeur/relais')} style={st.urgent}>
            <Text style={{ fontSize: 24 }}>🔔</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFF' }}>
                {appels} client{appels > 1 ? 's' : ''} cherche{appels > 1 ? 'nt' : ''} un article
              </Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                Trente secondes pour répondre — touche ici
              </Text>
            </View>
            <Text style={{ color: '#FFF', fontSize: 20 }}>›</Text>
          </Pressable>
        )}

        {aConfirmer > 0 && (
          <Pressable onPress={() => router.push('/vendeur/commandes')} style={st.aFaire}>
            <Text style={{ fontSize: 20 }}>📦</Text>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: C.encre }}>
              {aConfirmer} commande{aConfirmer > 1 ? 's' : ''} à confirmer
            </Text>
            <Text style={{ color: C.grisClair, fontSize: 20 }}>›</Text>
          </Pressable>
        )}

        {/* ② L'argent */}
        <View style={[st.bloc, { gap: 12 }]}>
          <Text style={S.titre}>Mon argent</Text>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <View style={[st.tuile, { backgroundColor: C.marine }]}>
              <Text style={[st.tuileLibelle, { color: 'rgba(255,255,255,0.6)' }]}>Disponible</Text>
              <Text style={[st.tuileValeur, { color: '#FFF' }]}>
                {fcfa(solde?.available || 0)}
              </Text>
            </View>
            <View style={st.tuile}>
              <Text style={st.tuileLibelle}>En attente</Text>
              <Text style={st.tuileValeur}>{fcfa(solde?.held || 0)}</Text>
            </View>
          </View>
          {Number(solde?.held || 0) > 0 && (
            <Text style={{ fontSize: 11.5, color: C.orange, lineHeight: 16 }}>
              {fcfa(solde.held)} attendent la confirmation de tes clients. Une
              commande livrée devient disponible dès qu’ils confirment, ou
              automatiquement 48 h après.
            </Text>
          )}
          <Pressable onPress={() => router.push('/vendeur/retraits')} style={S.boutonFin}>
            <Text style={S.boutonFinTexte}>Retirer mon argent</Text>
          </Pressable>
        </View>

        {/* ③ Le bon de relais */}
        {!!bon && (
          <Pressable onPress={() => router.push('/vendeur/retraits')} style={st.bon}>
            <Text style={{ fontSize: 22 }}>🔁</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: '700' }}>
                BON DE RELAIS
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFF', marginTop: 2 }}>
                {fcfa(bon.solde)}
              </Text>
              <Text style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                Gagné en envoyant des clients chez des voisins
              </Text>
            </View>
          </Pressable>
        )}

        {/* ④ Le reste */}
        <View style={[st.bloc, { padding: 0, overflow: 'hidden' }]}>
          <Ligne icone="🔁" titre="Le relais" badge={appels}
            onPress={() => router.push('/vendeur/relais')} />
          <Ligne icone="📦" titre="Mes commandes" badge={aConfirmer}
            onPress={() => router.push('/vendeur/commandes')} />
          <Ligne icone="🏷" titre="Mes produits"
            onPress={() => router.push('/vendeur/produits')} />
          <Ligne icone="👥" titre="Mes clients"
            onPress={() => router.push('/vendeur/clients')} />
          <Ligne icone="📊" titre="Statistiques"
            onPress={() => router.push('/vendeur/statistiques')} />
        </View>

        <View style={[st.bloc, { padding: 0, overflow: 'hidden' }]}>
          <Ligne icone="💸" titre="Retraits et bon"
            valeur={fcfa(solde?.available || 0)}
            onPress={() => router.push('/vendeur/retraits')} />
          <Ligne icone="👑" titre="Abonnement"
            valeur={vendor.plan === 'free' || !vendor.plan ? 'Gratuit' : vendor.plan}
            onPress={() => router.push('/vendeur/abonnement')} />
          <Ligne icone="🚚" titre="Livraison"
            onPress={() => router.push('/vendeur/livraison')} />
          <Ligne icone="⚙️" titre="Réglages de la boutique"
            onPress={() => router.push('/vendeur/reglages')} />
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  titre: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  sousTitre: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 1 },

  chiffres: { flexDirection: 'row', gap: 8, marginTop: 14 },
  chiffre: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: R.champ, padding: 10,
  },
  chiffreValeur: { color: '#FFF', fontSize: 14.5, fontWeight: '800' },
  chiffreLibelle: { color: 'rgba(255,255,255,0.6)', fontSize: 10.5, marginTop: 2 },

  urgent: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.orange, borderRadius: R.carte,
    marginHorizontal: E.page, marginBottom: 12, padding: 14,
  },
  aFaire: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: C.carte, borderRadius: R.carte,
    marginHorizontal: E.page, marginBottom: 12, padding: 13, ...OMBRE,
  },

  bloc: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 14,
    marginHorizontal: E.page, marginBottom: 12, ...OMBRE,
  },
  tuile: { flex: 1, backgroundColor: C.champ, borderRadius: R.champ, padding: 12 },
  tuileLibelle: { fontSize: 11, color: C.gris, fontWeight: '600' },
  tuileValeur: { fontSize: 16, fontWeight: '800', color: C.encre, marginTop: 3 },

  bon: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.marine, borderRadius: R.carte,
    marginHorizontal: E.page, marginBottom: 12, padding: 14,
  },
});
