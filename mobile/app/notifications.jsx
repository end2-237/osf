import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/session';
import { enregistrerPourNotifications } from '../lib/notifications';
import { appelsEnAttente, repondreAppel } from '../lib/relais';
import { Vide, Chargement } from '../components/Base';
import { C, R, S, E, OMBRE, fcfa } from '../lib/ui';
import Icone from '../components/Icone';

/* ══════════════════════════════════════════════════════════════════════════
   LES NOTIFICATIONS

   Cet écran avait un défaut de fond : il n'affichait RIEN. La requête ne
   partait que si un commerçant était connecté, et même alors elle ne montrait
   que l'historique — jamais les appels EN COURS. Le relais poussait donc une
   notification sur le téléphone, et si elle était ratée — écran éteint,
   téléphone dans la poche, notification balayée — il n'existait aucun autre
   endroit où la retrouver.

   Or c'est précisément l'usage : on ouvre la liste des notifications pour
   voir ce qu'on a manqué, et pour dire « je suis là » avant que le compte à
   rebours ne s'achève. Un appel de relais dure trente secondes ; l'écran qui
   sert à le rattraper ne peut pas être un écran mort.

   D'où trois changements.

   ① LES APPELS EN COURS SONT EN HAUT, avec leur compte à rebours et le bouton
   qui répond. On ne renvoie pas vers un autre écran : chaque redirection est
   une seconde perdue, et il n'y en a que trente.

   ② LA LISTE SE RAFRAÎCHIT TOUTE SEULE, toutes les cinq secondes tant que
   l'écran est ouvert. Une liste figée sur un écran qu'on a ouvert POUR
   surveiller quelque chose est un contresens.

   ③ LE CLIENT AUSSI A DES NOTIFICATIONS. Avant, un client sans boutique
   voyait une liste vide en permanence. Il voit maintenant l'état de son
   relais en cours et de ses commandes.
   ══════════════════════════════════════════════════════════════════════════ */

const FAMILLES = [
  { cle: 'relais', icone: 'relais', titre: 'Le relais', fond: '#00897B' },
  { cle: 'commande', icone: 'colis', titre: 'Mes commandes', fond: '#2C6BED' },
  { cle: 'boutique', icone: 'boutique', titre: 'Ma boutique', fond: C.marine },
  { cle: 'promo', icone: 'etiquette', titre: 'Offres et remises', fond: C.orange },
];

// À quelle famille appartient chaque genre. Un flux unique mélange une
// promotion et « ton colis est arrivé », et on finit par ne plus rien ouvrir.
const FAMILLE_DE = {
  appel: 'relais', arrive: 'relais', vendu: 'relais', pas_venu: 'relais',
  produit_retire: 'boutique', produit_masque: 'boutique',
  boutique_suspendue: 'boutique', boutique_retablie: 'boutique',
  avertissement: 'boutique', message: 'boutique',
};

function quand(iso) {
  const d = new Date(iso);
  const m = Math.round((Date.now() - d) / 60000);
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  if (j === 1) return 'hier';
  if (j < 7) return `il y a ${j} jours`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

/* ── Un appel en cours ────────────────────────────────────────────────────
   Le compte à rebours descend seul. Il n'est pas décoratif : c'est lui qui
   dit s'il vaut encore la peine de courir chercher l'article au fond du
   magasin, ou s'il faut répondre tout de suite. */
function Appel({ a, onRepondu }) {
  const [reste, setReste] = useState(a.reste_s ?? 30);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    setReste(a.reste_s ?? 30);
    const t = setInterval(() => setReste((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [a.appel_id, a.reste_s]);

  const repondre = async (disponible) => {
    setBusy(disponible ? 'oui' : 'non');
    await repondreAppel(a.appel_id, a.vendor_id, disponible, {
      productId: a.product_id, libelle: a.libelle, prixNet: a.prix_net,
    });
    onRepondu(a.appel_id);
  };

  const fini = reste <= 0;

  return (
    <View style={[st.appel, fini && { opacity: 0.55 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <View style={st.appelRond}>
          <Icone nom="relais" taille={16} couleur="#FFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.appelTitre}>Un voisin cherche un article</Text>
          {!!a.demandeur && (
            <Text style={st.appelQui} numberOfLines={1}>{a.demandeur}</Text>
          )}
        </View>
        <View style={[st.chrono, reste <= 10 && { backgroundColor: C.rouge }]}>
          <Text style={st.chronoTexte}>{fini ? 'fini' : `${reste} s`}</Text>
        </View>
      </View>

      <Text style={st.appelArticle} numberOfLines={2}>
        {a.produit || a.libelle || 'Article demandé'}
      </Text>
      {(!!a.contrainte || !!a.budget) && (
        <Text style={st.appelDetail}>
          {[a.contrainte, a.budget ? `budget ${fcfa(a.budget)}` : null]
            .filter(Boolean).join(' · ')}
        </Text>
      )}

      {!fini && (
        <View style={{ flexDirection: 'row', gap: 9, marginTop: 10 }}>
          <Pressable disabled={!!busy} onPress={() => repondre(false)}
            style={[S.boutonFin, { flex: 1 }]}>
            <Text style={S.boutonFinTexte}>Je ne l’ai pas</Text>
          </Pressable>
          <Pressable disabled={!!busy} onPress={() => repondre(true)}
            style={[st.oui, busy === 'oui' && { opacity: 0.6 }]}>
            <Icone nom="coche" taille={16} couleur="#FFF" />
            <Text style={st.ouiTexte}>Je l’ai</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function Notifications() {
  const router = useRouter();
  const { user, vendor } = useSession();

  const [liste, setListe] = useState(null);
  const [appels, setAppels] = useState([]);
  const [famille, setFamille] = useState(null);
  const [autorise, setAutorise] = useState(true);
  const [raf, setRaf] = useState(false);

  const charger = useCallback(async () => {
    if (!user) { setListe([]); return; }

    const { data } = vendor
      ? await supabase.rpc('mes_notifications', { p_vendor_id: vendor.id, p_limite: 50 })
      : { data: [] };

    setListe((data || []).map((n) => ({
      id: n.id,
      genre: n.genre,
      famille: FAMILLE_DE[n.genre] || 'commande',
      titre: n.titre, corps: n.corps, lien: n.lien,
      lue: n.lue, date: n.created_at,
    })));
  }, [user, vendor]);

  // Les appels ne peuvent pas attendre un tirage : on regarde toutes les cinq
  // secondes tant que l'écran est ouvert. C'est le seul endroit de
  // l'application où l'on interroge aussi souvent, et c'est justifié — trente
  // secondes ne se rattrapent pas.
  const chargerAppels = useCallback(async () => {
    if (!vendor?.id) { setAppels([]); return; }
    const { data } = await appelsEnAttente(vendor.id);
    setAppels((data || []).map((a) => ({ ...a, vendor_id: vendor.id })));
  }, [vendor?.id]);

  useEffect(() => { charger(); chargerAppels(); }, [charger, chargerAppels]);

  useEffect(() => {
    if (!vendor?.id) return;
    const t = setInterval(chargerAppels, 5000);
    return () => clearInterval(t);
  }, [vendor?.id, chargerAppels]);

  const activer = async () => {
    const r = await enregistrerPourNotifications(vendor?.id);
    setAutorise(!!r.jeton);
  };

  const filtree = famille ? (liste || []).filter((n) => n.famille === famille) : (liste || []);
  const compte = (c) => (liste || []).filter((n) => n.famille === c).length;

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable hitSlop={10} onPress={() => router.back()}>
              <Icone nom="retour" taille={25} couleur="#FFF" />
            </Pressable>
            <Text style={st.titre}>Notifications</Text>
            {appels.length > 0 && (
              <View style={st.pastilleAppel}>
                <Text style={st.pastilleTexte}>{appels.length}</Text>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingVertical: 14, paddingBottom: 30 }}
        refreshControl={
          <RefreshControl refreshing={raf} onRefresh={async () => {
            setRaf(true); await Promise.all([charger(), chargerAppels()]); setRaf(false);
          }} />
        }>

        {/* ① Ce qui expire — tout en haut, et rien au-dessus */}
        {appels.length > 0 && (
          <View style={{ paddingHorizontal: E.page, gap: 10, marginBottom: 16 }}>
            <Text style={st.sectionUrgente}>
              {appels.length === 1 ? 'Un appel en cours' : `${appels.length} appels en cours`}
            </Text>
            <Text style={st.sectionAide}>
              Réponds ici : chaque seconde compte, et le premier qui dit « je l’ai »
              prend la vente.
            </Text>
            {appels.map((a) => (
              <Appel key={a.appel_id} a={a}
                onRepondu={(id) => setAppels((l) => l.filter((x) => x.appel_id !== id))} />
            ))}
          </View>
        )}

        {!autorise && (
          <Pressable onPress={activer} style={st.alerte}>
            <Icone nom="cloches" taille={21} couleur={C.orange} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: C.encre }}>
                Les notifications sont coupées
              </Text>
              <Text style={{ fontSize: 12, color: C.gris, marginTop: 2 }}>
                {vendor
                  ? 'Tu ne sauras pas qu’un voisin cherche un article que tu as. Touche pour les activer.'
                  : 'Tu ne sauras pas quand ta commande arrive. Touche pour les activer.'}
              </Text>
            </View>
          </Pressable>
        )}

        {/* ② Les familles */}
        <View style={{ paddingHorizontal: E.page, gap: 10 }}>
          {FAMILLES.map((f) => {
            const n = compte(f.cle);
            const actif = famille === f.cle;
            return (
              <Pressable key={f.cle}
                onPress={() => setFamille(actif ? null : f.cle)}
                style={[st.famille, actif && { borderColor: f.fond, borderWidth: 1.5 }]}>
                <View style={[st.familleRond, { backgroundColor: f.fond + '18' }]}>
                  <Icone nom={f.icone} taille={18} couleur={f.fond} />
                </View>
                <Text style={st.familleTitre}>{f.titre}</Text>
                {n > 0 && (
                  <View style={[st.familleCompte, { backgroundColor: f.fond }]}>
                    <Text style={st.familleCompteTexte}>{n}</Text>
                  </View>
                )}
                <Icone nom={actif ? 'haut' : 'suite'} taille={17} couleur={C.grisClair} />
              </Pressable>
            );
          })}
        </View>

        {/* ③ Le fil */}
        {liste === null ? (
          <Chargement hauteur={200} />
        ) : filtree.length === 0 ? (
          appels.length === 0 && (
            <Vide icone="cloche" titre="Rien de neuf"
              texte={vendor
                ? 'Quand un voisin cherchera un article que tu as, l’appel apparaîtra ici — et tu pourras répondre sans quitter cet écran.'
                : 'Tes commandes et ton relais te préviendront ici.'}
              bouton="Voir le catalogue" onBouton={() => router.push('/catalogue')} />
          )
        ) : (
          <View style={{ paddingHorizontal: E.page, gap: 9, marginTop: 16 }}>
            {filtree.map((n) => {
              const f = FAMILLES.find((x) => x.cle === n.famille) || FAMILLES[0];
              return (
                <Pressable key={n.id}
                  onPress={() => n.lien && router.push(n.lien)}
                  style={[st.ligne, !n.lue && { borderLeftWidth: 3, borderLeftColor: f.fond }]}>
                  <View style={[st.ligneRond, { backgroundColor: f.fond + '18' }]}>
                    <Icone nom={f.icone} taille={15} couleur={f.fond} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={st.ligneTitre} numberOfLines={1}>{n.titre}</Text>
                    <Text style={st.ligneCorps} numberOfLines={3}>{n.corps}</Text>
                    <Text style={st.ligneQuand}>{quand(n.date)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingVertical: 12 },
  titre: { color: '#FFF', fontSize: 19, fontWeight: '800' },
  pastilleAppel: {
    backgroundColor: C.rouge, borderRadius: R.puce,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  pastilleTexte: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  sectionUrgente: { fontSize: 16, fontWeight: '800', color: C.encre },
  sectionAide: { fontSize: 12, color: C.gris, lineHeight: 17, marginTop: -4 },

  appel: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 13,
    borderWidth: 1.5, borderColor: '#00897B', ...OMBRE,
  },
  appelRond: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#00897B',
    alignItems: 'center', justifyContent: 'center',
  },
  appelTitre: { fontSize: 13.5, fontWeight: '700', color: C.encre },
  appelQui: { fontSize: 11.5, color: C.gris, marginTop: 1 },
  chrono: {
    backgroundColor: C.marine, borderRadius: R.puce,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  chronoTexte: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  appelArticle: { fontSize: 15, fontWeight: '700', color: C.encre, marginTop: 9 },
  appelDetail: { fontSize: 12, color: C.gris, marginTop: 2 },
  oui: {
    flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: '#00897B', borderRadius: R.puce, paddingVertical: 12,
  },
  ouiTexte: { color: '#FFF', fontSize: 14, fontWeight: '800' },

  alerte: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: C.orangePale, borderRadius: R.carte,
    borderWidth: 1, borderColor: '#FFD9C0',
    marginHorizontal: E.page, marginBottom: 14, padding: 13,
  },

  famille: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: C.carte, borderRadius: R.carte, padding: 13, ...OMBRE,
  },
  familleRond: {
    width: 34, height: 34, borderRadius: R.vignette,
    alignItems: 'center', justifyContent: 'center',
  },
  familleTitre: { flex: 1, fontSize: 14, fontWeight: '600', color: C.encre },
  familleCompte: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  familleCompteTexte: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  ligne: {
    flexDirection: 'row', gap: 11, alignItems: 'flex-start',
    backgroundColor: C.carte, borderRadius: R.carte, padding: 13, ...OMBRE,
  },
  ligneRond: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  ligneTitre: { fontSize: 13.5, fontWeight: '700', color: C.encre },
  ligneCorps: { fontSize: 12.5, color: C.gris, lineHeight: 17, marginTop: 2 },
  ligneQuand: { fontSize: 11, color: C.grisClair, marginTop: 4 },
});
