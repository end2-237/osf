import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Image, TextInput, Animated,
  ActivityIndicator, StyleSheet, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { C, R, S, E, OMBRE } from '../lib/ui';
import Icone from './Icone';

const L = Dimensions.get('window').width;

/* ══════════════════════════════════════════════════════════════════════════
   LES BRIQUES PARTAGÉES

   Tout ce qui revient sur plus d'un écran. Les garder ici évite la dérive :
   trois titres de section écrits trois fois finissent par avoir trois tailles.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── L'en-tête marine ─────────────────────────────────────────────────────
   Il ne se contente pas d'afficher un logo : il porte la recherche, et c'est
   la première chose qu'on cherche en ouvrant une place de marché. */
export function EnTete({ titre, recherche = true, retour = false, action }) {
  const router = useRouter();
  return (
    <View style={st.enTete}>
      <View style={st.enTeteHaut}>
        {retour ? (
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ width: 32 }}>
            <Icone nom="retour" taille={24} couleur="#FFF" />
          </Pressable>
        ) : <View style={{ width: 32 }} />}
        <Text style={st.enTeteTitre} numberOfLines={1}>{titre || 'Buyticle'}</Text>
        <View style={{ width: 32, alignItems: 'flex-end' }}>{action}</View>
      </View>

      {recherche && (
        <Pressable onPress={() => router.push('/recherche')} style={st.champRecherche}>
          <Icone nom="recherche" taille={17} couleur="rgba(255,255,255,0.55)" />
          <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)' }}>Chercher un article</Text>
        </Pressable>
      )}
    </View>
  );
}

/* ── Le titre de section, avec son lien ──────────────────────────────────── */
export function TitreSection({ titre, lien, onLien, style }) {
  return (
    <View style={[st.ligneTitre, style]}>
      <Text style={S.titreSection}>{titre}</Text>
      {!!lien && (
        <Pressable onPress={onLien} hitSlop={8}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={S.lienSection}>{lien}</Text>
            <Icone nom="suite" taille={14} couleur={C.orange} />
          </View>
        </Pressable>
      )}
    </View>
  );
}

/* ── Le rail de puces ─────────────────────────────────────────────────────
   Sous la recherche sur l'accueil, en filtre ailleurs. */
export function Puces({ valeurs, actif, onChoisir, sombre = false }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: E.page }}>
      {valeurs.map((v) => {
        const val = typeof v === 'string' ? v : v.valeur;
        const lib = typeof v === 'string' ? v : v.libelle;
        const on = actif === val;
        return (
          <Pressable key={val} onPress={() => onChoisir?.(val)}
            style={[
              st.puce,
              sombre && { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'transparent' },
              on && (sombre ? { backgroundColor: '#FFF' } : { backgroundColor: C.marine, borderColor: C.marine }),
            ]}>
            {!!v.icone && (
              <Icone nom={v.icone} taille={15}
                couleur={on ? (sombre ? C.marine : '#FFF') : (sombre ? '#FFF' : C.gris)} />
            )}
            <Text style={[
              st.puceTexte,
              sombre && { color: '#FFF' },
              on && (sombre ? { color: C.marine, fontWeight: '700' } : { color: '#FFF', fontWeight: '700' }),
            ]}>{lib}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ── Le carrousel de bannières ────────────────────────────────────────────
   Il défile tout seul. Les voisines dépassent des deux côtés : c'est ce qui
   dit qu'il y en a d'autres sans avoir à mettre une flèche. */
export function Carrousel({ bannieres = [], hauteur = 150, onOuvrir }) {
  const [index, setIndex] = useState(0);
  const ref = useRef(null);
  const largeur = L - E.page * 2 - 24;

  useEffect(() => {
    if (bannieres.length < 2) return;
    const t = setInterval(() => {
      setIndex((i) => {
        const suivant = (i + 1) % bannieres.length;
        ref.current?.scrollTo({ x: suivant * (largeur + 10), animated: true });
        return suivant;
      });
    }, 4000);
    return () => clearInterval(t);
  }, [bannieres.length, largeur]);

  if (!bannieres.length) return null;

  return (
    <View>
      <ScrollView ref={ref} horizontal pagingEnabled={false} decelerationRate="fast"
        snapToInterval={largeur + 10} showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / (largeur + 10)))}
        contentContainerStyle={{ gap: 10, paddingHorizontal: E.page + 12 }}>
        {bannieres.map((b, i) => (
          <Pressable key={i} onPress={() => onOuvrir?.(b)}
            style={{ width: largeur, height: hauteur, borderRadius: R.carte, overflow: 'hidden' }}>
            {b.img
              ? <Image source={{ uri: b.img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              : (
                <View style={[st.bannierePlate, { backgroundColor: b.fond || C.orange }]}>
                  <Text style={st.banniereTitre}>{b.titre}</Text>
                  {!!b.sous && <Text style={st.banniereSous}>{b.sous}</Text>}
                </View>
              )}
          </Pressable>
        ))}
      </ScrollView>

      {bannieres.length > 1 && (
        <View style={st.points}>
          {bannieres.map((_, i) => (
            <View key={i} style={[st.point, i === index && st.pointActif]} />
          ))}
        </View>
      )}
    </View>
  );
}

/* ── Les états ────────────────────────────────────────────────────────────
   Une page vide sans explication se lit comme une panne. */
export function Vide({ icone = 'vide', titre, texte, bouton, onBouton }) {
  return (
    <View style={st.vide}>
      <View style={st.videRond}>
        <Icone nom={icone} taille={34} couleur={C.grisClair} />
      </View>
      <Text style={[S.titre, { marginTop: 12, textAlign: 'center' }]}>{titre}</Text>
      {!!texte && (
        <Text style={[S.sousTitre, { textAlign: 'center', marginTop: 6, maxWidth: 300 }]}>
          {texte}
        </Text>
      )}
      {!!bouton && (
        <Pressable onPress={onBouton} style={[S.bouton, { marginTop: 18, paddingHorizontal: 28 }]}>
          <Text style={S.boutonTexte}>{bouton}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Chargement({ hauteur = 200 }) {
  return (
    <View style={{ height: hauteur, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={C.marine} />
    </View>
  );
}

/* Squelette de carte : il tient la place pendant le chargement et évite le
   saut de mise en page qui donne l'impression d'une application instable. */
export function Squelette({ hauteur = 220, style }) {
  const p = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(p, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(p, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  return <Animated.View style={[{ height: hauteur, borderRadius: R.carte, backgroundColor: '#E7E7EF', opacity: p }, style]} />;
}

/* ── La ligne de réglage, réutilisée dans tous les profils ───────────────── */
export function Ligne({ icone, titre, valeur, badge, onPress, danger }) {
  return (
    <Pressable onPress={onPress} style={st.ligne}>
      {!!icone && (
        <View style={{ width: 26, alignItems: 'center' }}>
          <Icone nom={icone} taille={19} couleur={danger ? C.rouge : C.gris} />
        </View>
      )}
      <Text style={[st.ligneTitreTexte, danger && { color: C.rouge }]} numberOfLines={1}>
        {titre}
      </Text>
      {badge != null && badge !== 0 && (
        <View style={st.pastille}><Text style={st.pastilleTexte}>{badge}</Text></View>
      )}
      {!!valeur && <Text style={st.ligneValeur} numberOfLines={1}>{valeur}</Text>}
      {!!onPress && <Icone nom="suite" taille={17} couleur={C.grisClair} />}
    </Pressable>
  );
}

export function Champ({ label, aide, ...props }) {
  return (
    <View style={{ gap: 6 }}>
      {!!label && <Text style={S.etiquette}>{label}</Text>}
      <TextInput placeholderTextColor={C.grisClair} style={S.champ} {...props} />
      {!!aide && <Text style={{ fontSize: 11, color: C.gris }}>{aide}</Text>}
    </View>
  );
}

const st = StyleSheet.create({
  enTete: {
    backgroundColor: C.marine,
    paddingTop: 8, paddingBottom: 12,
    borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
  },
  enTeteHaut: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: E.page, height: 38,
  },
  enTeteTitre: { flex: 1, textAlign: 'center', color: '#FFF', fontSize: 16, fontWeight: '700' },
  champRecherche: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    marginHorizontal: E.page, marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: R.puce, paddingHorizontal: 15, paddingVertical: 11,
  },

  ligneTitre: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: E.page, marginBottom: 10, marginTop: 4,
  },

  puce: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: C.bord, borderRadius: R.puce,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.carte,
  },
  puceTexte: { fontSize: 13, color: C.encre, fontWeight: '500' },

  bannierePlate: { flex: 1, padding: 18, justifyContent: 'center' },
  banniereTitre: { color: '#FFF', fontSize: 21, fontWeight: '800', lineHeight: 26 },
  banniereSous: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 6 },

  points: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 },
  point: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.grisClair },
  pointActif: { backgroundColor: C.marine, width: 16 },

  vide: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 24 },
  videRond: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: C.champ,
    alignItems: 'center', justifyContent: 'center',
  },

  ligne: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: C.bord,
  },
  ligneTitreTexte: { flex: 1, fontSize: 15, color: C.encre },
  ligneValeur: { fontSize: 13, color: C.gris, maxWidth: 150 },

  pastille: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.orange,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  pastilleTexte: { color: '#FFF', fontSize: 11, fontWeight: '700' },
});
