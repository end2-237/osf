import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, StyleSheet, RefreshControl, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Barre, Vide, Squelette, TitreSection } from '../components/Base';
import { C, R, S, E, OMBRE } from '../lib/ui';
import Icone from '../components/Icone';

/* ══════════════════════════════════════════════════════════════════════════
   LES LIVES

   Trois états, et l'ordre n'est pas discutable : ce qui passe MAINTENANT, ce
   qui est annoncé, ce qui est fini. Un direct a une valeur qui s'évapore —
   mêlé aux rediffusions dans une seule grille, il se perd et personne
   n'entre.

   La pastille rouge n'est pas décorative : c'est le seul signal qui dit qu'on
   peut encore parler au vendeur et poser une question sur la taille. Une fois
   le direct fini, la vidéo reste, mais la conversation non — et c'est la
   conversation qui fait vendre en live.

   La lecture elle-même part sur le site : le flux vidéo tourne déjà là-bas,
   et le rejouer dans un lecteur natif obligerait à réencoder pour un gain
   nul. On ouvre le navigateur avec la session, et on revient.
   ══════════════════════════════════════════════════════════════════════════ */

const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://buyticle.com';

function quand(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const jours = Math.round((d - new Date()) / 86400000);
  if (jours === 0) return `aujourd’hui à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  if (jours === 1) return `demain à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

function Carte({ l, enDirect, onOuvrir }) {
  return (
    <Pressable onPress={onOuvrir} style={st.carte}>
      <View style={st.couverture}>
        {l.cover_url
          ? <Image source={{ uri: l.cover_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          : <View style={st.couvertureVide}>
              <Icone nom="live" taille={34} couleur="rgba(255,255,255,0.5)" />
            </View>}

        {enDirect ? (
          <View style={st.direct}>
            <View style={st.pastille} />
            <Text style={st.directTexte}>EN DIRECT</Text>
          </View>
        ) : l.status === 'scheduled' ? (
          <View style={[st.direct, { backgroundColor: 'rgba(20,27,77,0.85)' }]}>
            <Icone nom="chrono" taille={10} couleur="#FFF" />
            <Text style={st.directTexte}>BIENTÔT</Text>
          </View>
        ) : (
          <View style={[st.direct, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
            <Text style={st.directTexte}>REDIFFUSION</Text>
          </View>
        )}

        {enDirect && l.viewer_count > 0 && (
          <View style={st.vues}>
            <Icone nom="personnes" taille={11} couleur="#FFF" />
            <Text style={st.vuesTexte}>{l.viewer_count}</Text>
          </View>
        )}
      </View>

      <View style={{ padding: 11, gap: 3 }}>
        <Text style={st.titre} numberOfLines={2}>{l.title || 'Direct'}</Text>
        <Text style={st.sous}>
          {enDirect ? 'En cours — pose tes questions'
            : l.status === 'scheduled' ? quand(l.started_at)
            : 'Rediffusion disponible'}
        </Text>
      </View>
    </Pressable>
  );
}

export default function Lives() {
  const router = useRouter();
  const [liste, setListe] = useState(null);
  const [raf, setRaf] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await supabase.from('live_shows')
      .select('id, title, status, cover_url, started_at, created_at, viewer_count')
      .order('started_at', { ascending: false, nullsFirst: false })
      .limit(60);
    setListe(data || []);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const ouvrir = (l) => Linking.openURL(`${SITE}/live/${l.id}`).catch(() => {});

  const enCours = (liste || []).filter((l) => l.status === 'live');
  const prevus = (liste || []).filter((l) => l.status === 'scheduled');
  const passes = (liste || []).filter((l) => !['live', 'scheduled'].includes(l.status));

  return (
    <View style={S.page}>
      <Barre titre="Les lives"
        sousTitre={enCours.length ? `${enCours.length} en direct maintenant` : undefined} />

      {liste === null ? (
        <View style={{ padding: E.page, gap: 12 }}>
          {[0, 1].map((i) => <Squelette key={i} hauteur={220} />)}
        </View>
      ) : liste.length === 0 ? (
        <Vide icone="live" titre="Aucun direct pour l’instant"
          texte="Les commerçants présentent leurs nouveautés en direct et répondent aux questions. Reviens un peu plus tard."
          bouton="Voir le catalogue" onBouton={() => router.push('/catalogue')} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 34 }}
          refreshControl={
            <RefreshControl refreshing={raf} onRefresh={async () => {
              setRaf(true); await charger(); setRaf(false);
            }} />
          }>

          {enCours.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <TitreSection titre="En direct maintenant" />
              <View style={{ paddingHorizontal: E.page, gap: 12 }}>
                {enCours.map((l) => (
                  <Carte key={l.id} l={l} enDirect onOuvrir={() => ouvrir(l)} />
                ))}
              </View>
            </View>
          )}

          {prevus.length > 0 && (
            <View style={{ marginTop: 18 }}>
              <TitreSection titre="Annoncés" />
              <View style={{ paddingHorizontal: E.page, gap: 12 }}>
                {prevus.map((l) => (
                  <Carte key={l.id} l={l} onOuvrir={() => ouvrir(l)} />
                ))}
              </View>
            </View>
          )}

          {passes.length > 0 && (
            <View style={{ marginTop: 18 }}>
              <TitreSection titre="Rediffusions" />
              <View style={{ paddingHorizontal: E.page, gap: 12 }}>
                {passes.map((l) => (
                  <Carte key={l.id} l={l} onOuvrir={() => ouvrir(l)} />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  carte: { backgroundColor: C.carte, borderRadius: R.carte, overflow: 'hidden', ...OMBRE },
  couverture: { width: '100%', aspectRatio: 16 / 9, backgroundColor: C.champ },
  couvertureVide: {
    width: '100%', height: '100%', backgroundColor: C.marine,
    alignItems: 'center', justifyContent: 'center',
  },
  direct: {
    position: 'absolute', top: 9, left: 9,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.rouge, borderRadius: R.puce,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  pastille: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  directTexte: { fontSize: 9.5, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  vues: {
    position: 'absolute', top: 9, right: 9,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: R.puce,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  vuesTexte: { fontSize: 10.5, fontWeight: '700', color: '#FFF' },
  titre: { fontSize: 14.5, fontWeight: '700', color: C.encre, lineHeight: 19 },
  sous: { fontSize: 12, color: C.gris },
});
