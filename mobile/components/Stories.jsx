import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Image, Pressable, ScrollView, Animated, Easing,
  Modal, StyleSheet, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useBoutique } from '../lib/boutique';
import { C, R, S, E, OMBRE, fcfa, pourcent } from '../lib/ui';

const { width: L, height: H } = Dimensions.get('window');
const DUREE = 6000;   // six secondes par vue, comme partout ailleurs

/* ══════════════════════════════════════════════════════════════════════════
   LES STORIES

   Une publicité plein écran qu'on accepte de regarder, à une condition : que
   l'article vu soit atteignable sans avoir à le rechercher après coup.

   D'où le tiroir. Le bouton du bas ouvre les articles de la story par-dessus
   l'image, avec leur prix et leur bouton panier. C'est tout le mécanisme :
   sans lui, une story est une affiche qu'on referme et qui n'a rien vendu ;
   avec lui, elle est un rayon.

   Les gestes sont ceux que tout le monde connaît et qu'il ne faut donc pas
   réinventer :
     · toucher à droite → vue suivante ; à gauche → précédente ;
     · maintenir → la barre se fige, on regarde ;
     · la croix ferme, et la story est marquée vue.

   La barre de progression est segmentée, une case par vue. Une barre unique
   ne dit pas combien il en reste, et c'est justement ce qu'on veut savoir
   avant de décider de rester.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Le rail rond, en haut de l'accueil ─────────────────────────────────── */
export function RailStories({ histoires = [], vues = [], onOuvrir }) {
  if (!histoires.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingHorizontal: E.page }}>
      {histoires.map((h, i) => {
        const vue = vues.includes(h.id);
        return (
          <Pressable key={h.id} onPress={() => onOuvrir(i)} style={{ width: 68, alignItems: 'center', gap: 6 }}>
            {/* L'anneau orange dit « pas encore vue ». Gris, elle l'est déjà —
                c'est le seul signal, et il suffit. */}
            <View style={[st.anneau, vue && { borderColor: C.bord }]}>
              {h.vignette
                ? <Image source={{ uri: h.vignette }} style={st.vignetteRail} />
                : <View style={[st.vignetteRail, { backgroundColor: h.fond || C.marine,
                    alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 22 }}>{h.icone || '✨'}</Text>
                  </View>}
            </View>
            <Text numberOfLines={2} style={st.railTexte}>{h.titre}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ── Le lecteur plein écran ─────────────────────────────────────────────── */
export function LecteurStories({ histoires = [], depart = 0, visible, onFermer, onVue }) {
  const router = useRouter();
  const { ouvrirChoix } = useBoutique();

  const [index, setIndex] = useState(depart);
  const [tiroir, setTiroir] = useState(false);
  const progression = useRef(new Animated.Value(0)).current;
  const glisse = useRef(new Animated.Value(300)).current;
  const anim = useRef(null);

  const h = histoires[index];
  const articles = h?.produits || [];

  useEffect(() => { if (visible) setIndex(depart); }, [visible, depart]);

  const suivante = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= histoires.length) { onFermer(); return i; }
      return i + 1;
    });
  }, [histoires.length, onFermer]);

  // La barre avance seule, sauf quand le tiroir est ouvert : on ne fait pas
  // disparaître une image pendant que quelqu'un lit un prix.
  useEffect(() => {
    if (!visible || !h) return;
    onVue?.(h.id);
    progression.setValue(0);
    if (tiroir) return;
    anim.current = Animated.timing(progression, {
      toValue: 1, duration: DUREE, easing: Easing.linear, useNativeDriver: false,
    });
    anim.current.start(({ finished }) => { if (finished) suivante(); });
    return () => anim.current?.stop();
  }, [visible, index, tiroir, h]);   // eslint-disable-line react-hooks/exhaustive-deps

  const basculerTiroir = (ouvrir) => {
    setTiroir(ouvrir);
    Animated.timing(glisse, {
      toValue: ouvrir ? 0 : 300, duration: 260,
      easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true,
    }).start();
  };

  if (!visible || !h) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onFermer}>
      <View style={st.plein}>
        {/* L'image */}
        {h.image
          ? <Image source={{ uri: h.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: h.fond || C.marine }]} />}

        {/* Un voile en haut et en bas : sans lui, un titre blanc sur une photo
            claire devient illisible une fois sur trois. */}
        <View style={st.voileHaut} pointerEvents="none" />
        <View style={st.voileBas} pointerEvents="none" />

        {/* Les segments de progression */}
        <View style={st.segments}>
          {histoires.map((_, i) => (
            <View key={i} style={st.segment}>
              <Animated.View style={[st.segmentPlein, {
                width: i < index ? '100%'
                  : i > index ? '0%'
                  : progression.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }]} />
            </View>
          ))}
        </View>

        <View style={st.barreHaut}>
          <Text style={st.marque}>buy<Text style={{ color: C.orange }}>ticle</Text></Text>
          <Pressable hitSlop={12} onPress={onFermer}>
            <Text style={{ color: '#FFF', fontSize: 22 }}>✕</Text>
          </Pressable>
        </View>

        {/* Les zones de navigation. Elles occupent toute la hauteur utile mais
            s'arrêtent au-dessus du tiroir : un appui sur un prix ne doit
            jamais faire changer de vue. */}
        {!tiroir && (
          <View style={st.zones}>
            <Pressable style={{ flex: 1 }}
              onPress={() => setIndex((i) => Math.max(0, i - 1))} />
            <Pressable style={{ flex: 2 }} onPress={suivante} />
          </View>
        )}

        {/* Le texte de la story */}
        <View style={st.texte} pointerEvents="none">
          <Text style={st.titre}>{h.titre}</Text>
          {!!h.accroche && <Text style={st.accroche}>{h.accroche}</Text>}
        </View>

        {/* Le pied : le bouton du tiroir */}
        {!tiroir && articles.length > 0 && (
          <Pressable onPress={() => basculerTiroir(true)} style={st.boutonTiroir}>
            <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '700' }}>
              Les articles de la story
            </Text>
            <Text style={{ color: '#FFF', fontSize: 12 }}>▲</Text>
          </Pressable>
        )}

        {!tiroir && articles.length === 0 && !!h.route && (
          <Pressable onPress={() => { onFermer(); router.push(h.route); }} style={st.boutonTiroir}>
            <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '700' }}>
              {h.action || 'Voir la sélection'}
            </Text>
          </Pressable>
        )}

        {/* Le tiroir */}
        {articles.length > 0 && (
          <Animated.View style={[st.tiroir, { transform: [{ translateY: glisse }] }]}
            pointerEvents={tiroir ? 'auto' : 'none'}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingHorizontal: E.page }}>
              {articles.map((p) => {
                const remise = pourcent(p.prix_barre, p.price);
                return (
                  <View key={p.id} style={st.carte}>
                    <Pressable onPress={() => { onFermer(); router.push(`/produit/${p.id}`); }}>
                      <View style={st.carteImage}>
                        <Image source={{ uri: p.img }} resizeMode="contain"
                          style={{ width: '100%', height: '100%' }} />
                        {!!remise && (
                          <View style={st.carteRemise}>
                            <Text style={st.carteRemiseTexte}>{remise}</Text>
                          </View>
                        )}
                      </View>
                      <Text numberOfLines={2} style={st.carteNom}>{p.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                        <Text style={st.cartePrix}>{fcfa(p.price)}</Text>
                        {!!remise && <Text style={S.prixBarre}>{fcfa(p.prix_barre)}</Text>}
                      </View>
                    </Pressable>
                    <Pressable onPress={() => ouvrirChoix(p)}
                      style={[S.bouton, { paddingVertical: 9, marginTop: 8 }]}>
                      <Text style={[S.boutonTexte, { fontSize: 13 }]}>Au panier</Text>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>

            <Pressable onPress={() => basculerTiroir(false)} style={st.masquer}>
              <Text style={{ fontSize: 13, color: C.gris }}>Masquer les articles  ▼</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

/* ── Les deux ensemble, à poser dans un écran ───────────────────────────── */
export default function Stories({ histoires = [] }) {
  const [ouvert, setOuvert] = useState(false);
  const [depart, setDepart] = useState(0);
  const [vues, setVues] = useState([]);

  if (!histoires.length) return null;

  return (
    <>
      <RailStories histoires={histoires} vues={vues}
        onOuvrir={(i) => { setDepart(i); setOuvert(true); }} />
      <LecteurStories
        histoires={histoires} depart={depart} visible={ouvert}
        onFermer={() => setOuvert(false)}
        onVue={(id) => setVues((v) => (v.includes(id) ? v : [...v, id]))} />
    </>
  );
}

const st = StyleSheet.create({
  anneau: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2.5, borderColor: C.orange,
    padding: 2.5, backgroundColor: C.carte,
  },
  vignetteRail: { width: '100%', height: '100%', borderRadius: 27 },
  railTexte: { fontSize: 10.5, color: C.encre, textAlign: 'center', lineHeight: 13 },

  plein: { flex: 1, backgroundColor: '#000' },
  voileHaut: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 150,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  voileBas: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 220,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },

  segments: {
    position: 'absolute', top: 52, left: 12, right: 12,
    flexDirection: 'row', gap: 4,
  },
  segment: {
    flex: 1, height: 2.5, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden',
  },
  segmentPlein: { height: '100%', backgroundColor: '#FFF' },

  barreHaut: {
    position: 'absolute', top: 66, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  marque: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  zones: {
    position: 'absolute', top: 100, left: 0, right: 0, bottom: 120,
    flexDirection: 'row',
  },

  texte: { position: 'absolute', left: 20, right: 20, bottom: 140 },
  titre: { color: '#FFF', fontSize: 26, fontWeight: '800', lineHeight: 32 },
  accroche: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 8, lineHeight: 19 },

  boutonTiroir: {
    position: 'absolute', left: 20, right: 20, bottom: 40,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: R.puce, paddingVertical: 14,
  },

  tiroir: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: C.carte,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 16, paddingBottom: 10,
  },
  carte: { width: 150 },
  carteImage: {
    width: '100%', aspectRatio: 1, backgroundColor: '#FFF',
    borderRadius: R.vignette, overflow: 'hidden',
  },
  carteRemise: {
    position: 'absolute', top: 6, left: 6, backgroundColor: C.orange,
    borderRadius: R.puce, paddingHorizontal: 8, paddingVertical: 3,
  },
  carteRemiseTexte: { color: '#FFF', fontSize: 10.5, fontWeight: '700' },
  carteNom: { fontSize: 12.5, color: C.encre, lineHeight: 16, marginTop: 7, minHeight: 32 },
  cartePrix: { fontSize: 15, fontWeight: '800', color: C.encre },

  masquer: { alignItems: 'center', paddingTop: 12, paddingBottom: 6 },
});
