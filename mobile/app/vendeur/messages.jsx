import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '../../lib/session';
import { supabase } from '../../lib/supabase';
import { Barre, Vide } from '../../components/Base';
import { C, R, S, E, OMBRE } from '../../lib/ui';
import Icone from '../../components/Icone';

/* ══════════════════════════════════════════════════════════════════════════
   CE QUE BUYTICLE M'A DIT

   Cet écran répond à une question précise, et une seule : « je suis parti
   avec 44 articles, j'en retrouve 41, que s'est-il passé ? »

   Avant, il n'y avait rien à répondre. Une suppression administrative ne
   laissait aucune trace côté vendeur — ni message, ni motif, ni date. Le
   commerçant ne pouvait que conclure que la plateforme perd ses données, et
   il avait raison de le penser.

   L'ordre est chronologique inverse, sans regroupement : c'est un dossier
   qu'on relit, pas un flux qu'on parcourt. Le motif est affiché à côté du
   message parce qu'il tient en un mot et que c'est lui qu'on cherche en
   revenant six semaines plus tard.
   ══════════════════════════════════════════════════════════════════════════ */

const GENRES = {
  produit_retire: { t: 'Article retiré', i: 'colis', c: C.rouge },
  produit_masque: { t: 'Article masqué', i: 'colis', c: C.orange },
  boutique_suspendue: { t: 'Boutique suspendue', i: 'boutique', c: C.rouge },
  boutique_retablie: { t: 'Boutique rouverte', i: 'boutique', c: C.vert },
  avertissement: { t: 'Avertissement', i: 'info', c: C.orange },
  message: { t: 'Message', i: 'cloche', c: C.marine },
};

function quand(iso) {
  const d = new Date(iso);
  const h = Math.round((Date.now() - d) / 3600000);
  if (h < 1) return 'à l’instant';
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  if (j === 1) return 'hier';
  if (j < 7) return `il y a ${j} jours`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Messages() {
  const router = useRouter();
  const { vendor } = useSession();

  const [liste, setListe] = useState(null);
  const [raf, setRaf] = useState(false);

  const charger = useCallback(async () => {
    if (!vendor) { setListe([]); return; }
    const { data } = await supabase.rpc('mes_actions_admin', {
      p_vendor_id: vendor.id, p_limite: 60,
    });
    setListe(data || []);
  }, [vendor]);

  useEffect(() => { charger(); }, [charger]);

  if (!vendor) {
    return (
      <View style={S.page}>
        <Barre titre="Messages de Buyticle" />
        <Vide icone="boutique" titre="Réservé aux boutiques"
          texte="Cet écran rassemble ce que l’équipe t’a écrit au sujet de ta boutique."
          bouton="Retour" onBouton={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={S.page}>
      <Barre titre="Messages de Buyticle"
        sousTitre={liste?.length ? `${liste.length} message${liste.length > 1 ? 's' : ''}` : undefined} />

      {liste === null ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.marine} />
      ) : liste.length === 0 ? (
        <Vide icone="cloche" titre="Rien à signaler"
          texte="Quand l’équipe intervient sur ta boutique — un article retiré, un rappel —, tu retrouveras ici ce qui a été fait et pourquoi."
          bouton="Retour au comptoir" onBouton={() => router.replace('/vendeur')} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: E.page, paddingBottom: 40, gap: 10 }}
          refreshControl={
            <RefreshControl refreshing={raf} onRefresh={async () => {
              setRaf(true); await charger(); setRaf(false);
            }} />
          }>
          {liste.map((a) => {
            const g = GENRES[a.genre] || GENRES.message;
            return (
              <View key={a.id} style={st.carte}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[st.rond, { backgroundColor: g.c + '18' }]}>
                    <Icone nom={g.i} taille={15} couleur={g.c} />
                  </View>
                  <Text style={[st.genre, { color: g.c }]}>{g.t}</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={st.quand}>{quand(a.created_at)}</Text>
                </View>

                {!!a.cible && (
                  <Text style={st.cible} numberOfLines={2}>{a.cible}</Text>
                )}

                <Text style={st.message}>{a.message}</Text>

                {!!a.motif && (
                  <View style={st.motif}>
                    <Text style={st.motifTexte}>{a.motif.replace(/_/g, ' ')}</Text>
                  </View>
                )}
              </View>
            );
          })}

          <Pressable onPress={() => router.push('/aide')} style={[S.boutonFin, { marginTop: 6 }]}>
            <Text style={S.boutonFinTexte}>Répondre à l’équipe</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  carte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 14, gap: 8, ...OMBRE },
  rond: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  genre: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  quand: { fontSize: 11, color: C.gris },
  cible: { fontSize: 14, fontWeight: '700', color: C.encre },
  message: { fontSize: 13, color: C.encre, lineHeight: 19 },
  motif: {
    alignSelf: 'flex-start', backgroundColor: C.champ, borderRadius: R.puce,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  motifTexte: { fontSize: 10.5, color: C.gris, fontWeight: '600' },
});
