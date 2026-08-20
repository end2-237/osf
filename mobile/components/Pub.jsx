import React, { useRef, useState } from 'react';
import {
  View, Text, Image, Pressable, ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { C, R, E, OMBRE } from '../lib/ui';
import Icone from './Icone';

const L = Dimensions.get('window').width;

/* ══════════════════════════════════════════════════════════════════════════
   LA PUBLICITÉ DANS LES LISTES

   Deux formats, et ils ne sont pas interchangeables.

   ① LA DIAPOSITIVE LARGE — un rail horizontal posé ENTRE deux sections. Elle
   interrompt la lecture verticale d'un geste latéral : on la voit parce
   qu'elle ne défile pas dans le même sens que le reste. C'est le format des
   grandes opérations, celles qui ont un visuel.

   ② LA CARTE HAUTE — elle prend une CASE de la grille, à la place d'un
   article. C'est là toute son efficacité : l'œil descend la grille dans un
   rythme, deux colonnes, deux colonnes, et la carte de pub arrive dans ce
   rythme au lieu de le casser. Une bannière pleine largeur au milieu d'une
   grille se saute ; une case ne se saute pas.

   La règle qu'on ne franchit pas : une publicité DIT qu'elle en est une. Le
   petit mot « Sponsorisé » est toujours là. Un client qui découvre après coup
   qu'il a cliqué sur une réclame déguisée ne revient pas — et il a raison.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Le fond de campagne par défaut ──────────────────────────────────────
   Tant qu'aucune régie ne remplit une table, ce sont nos propres opérations
   qui occupent l'espace. Une case vide dans une grille se voit ; une case qui
   parle de nos offres travaille. */

export const PUBS_LARGES = [
  {
    id: 'p-relais', fond: C.marine, teinte: '#2C3A7D',
    eyebrow: 'Le relais Buyticle', titre: 'Il ne l’a pas ?\nIl t’envoie chez le voisin',
    sous: 'Et tu paies 5 % moins cher qu’en boutique',
    action: 'Comment ça marche', route: '/relais', icone: 'relais',
  },
  {
    id: 'p-flash', fond: C.orange, teinte: '#FF8C3A',
    eyebrow: 'Ventes flash', titre: 'Jusqu’à −33 %\nsur des milliers d’articles',
    sous: 'Jusqu’à dimanche minuit',
    action: 'J’en profite', route: '/catalogue', icone: 'eclair',
  },
  {
    id: 'p-livraison', fond: '#00695C', teinte: '#00897B',
    eyebrow: 'Douala et Yaoundé', titre: 'Livraison gratuite\ndès 25 000 F',
    sous: 'Reçu le lendemain, partout en ville',
    action: 'Voir les articles', route: '/catalogue', icone: 'camion',
  },
];

export const PUBS_HAUTES = [
  {
    id: 'h-fidelite', fond: C.orange, eyebrow: 'Programme de fidélité',
    titre: 'Chaque achat te rend des points',
    sous: '1 point pour 100 F, à dépenser quand tu veux',
    action: 'Mes bonus', route: '/fidelite', icone: 'cadeau',
  },
  {
    id: 'h-parrainage', fond: C.marine, eyebrow: 'Parrainage',
    titre: 'Fais venir un ami,\ngagne sur ses achats',
    sous: 'Ton code marche dès la première commande',
    action: 'Mon code', route: '/parrainage', icone: 'personnes',
  },
];

/* ── ① Le rail de diapositives ───────────────────────────────────────────── */
export function SlidesPub({ pubs = PUBS_LARGES, hauteur = 132 }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const ref = useRef(null);
  const largeur = L - E.page * 2;

  if (!pubs.length) return null;

  return (
    <View>
      <ScrollView
        ref={ref} horizontal decelerationRate="fast"
        snapToInterval={largeur + 10}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / (largeur + 10)))}
        contentContainerStyle={{ gap: 10, paddingHorizontal: E.page }}>
        {pubs.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => b.route && router.push(b.route)}
            style={[st.slide, { width: largeur, height: hauteur, backgroundColor: b.fond }]}>

            {!!b.img && (
              <Image source={{ uri: b.img }} resizeMode="cover"
                style={StyleSheet.absoluteFill} />
            )}

            {/* La pastille ronde décalée : elle donne du volume sans image, et
                c'est elle qui empêche une campagne sans visuel de ressembler
                à un simple rectangle de couleur. */}
            {!b.img && (
              <View style={[st.bulle, { backgroundColor: b.teinte || 'rgba(255,255,255,0.12)' }]}>
                <Icone nom={b.icone || 'eclair'} taille={54} couleur="rgba(255,255,255,0.5)" />
              </View>
            )}

            <View style={st.slideTexte}>
              {!!b.eyebrow && <Text style={st.eyebrow}>{b.eyebrow}</Text>}
              <Text style={st.slideTitre} numberOfLines={2}>{b.titre}</Text>
              {!!b.sous && <Text style={st.slideSous} numberOfLines={1}>{b.sous}</Text>}
              {!!b.action && (
                <View style={st.slideBouton}>
                  <Text style={st.slideBoutonTexte}>{b.action}</Text>
                </View>
              )}
            </View>

            <Text style={st.mention}>Sponsorisé</Text>
          </Pressable>
        ))}
      </ScrollView>

      {pubs.length > 1 && (
        <View style={st.points}>
          {pubs.map((_, i) => (
            <View key={i} style={[st.point, i === index && st.pointActif]} />
          ))}
        </View>
      )}
    </View>
  );
}

/* ── ② La carte haute, à poser dans une case de grille ───────────────────── */
export function PubVerticale({ pub = PUBS_HAUTES[0], largeur }) {
  const router = useRouter();
  if (!pub) return null;

  return (
    <Pressable
      onPress={() => pub.route && router.push(pub.route)}
      style={[st.haute, { backgroundColor: pub.fond }, !!largeur && { width: largeur }]}>

      <Text style={st.hauteEyebrow}>{pub.eyebrow}</Text>
      <Text style={st.hauteTitre} numberOfLines={3}>{pub.titre}</Text>

      {/* L'icône occupe le ventre de la carte, à la place de l'image d'un
          article : c'est ce qui lui donne la même masse visuelle qu'une carte
          produit, sans quoi la case paraît creuse au milieu de la grille. */}
      <View style={st.hauteVentre}>
        <Icone nom={pub.icone || 'cadeau'} taille={62} couleur="rgba(255,255,255,0.28)" />
      </View>

      {!!pub.sous && <Text style={st.hauteSous} numberOfLines={2}>{pub.sous}</Text>}

      {!!pub.action && (
        <View style={st.hauteBouton}>
          <Text style={st.hauteBoutonTexte}>{pub.action}</Text>
          <Icone nom="suite" taille={13} couleur={pub.fond} />
        </View>
      )}

      <Text style={[st.mention, { position: 'relative', marginTop: 6 }]}>Sponsorisé</Text>
    </Pressable>
  );
}

/* ── Le mélange : glisser les pubs dans une liste d'articles ──────────────
   Toutes les `tous` cases, une pub prend la place d'un article. Six est le
   bon pas : trois rangées de grille. Plus serré, la grille devient un
   prospectus ; plus lâche, la pub n'est jamais vue. */
export function melangerPubs(articles = [], pubs = PUBS_HAUTES, tous = 6) {
  if (!articles.length || !pubs.length) return articles.map((p) => ({ type: 'produit', p }));
  const sortie = [];
  let n = 0;
  articles.forEach((p, i) => {
    sortie.push({ type: 'produit', p });
    if ((i + 1) % tous === 0 && n < pubs.length * 3) {
      sortie.push({ type: 'pub', pub: pubs[n % pubs.length], cle: `pub-${i}` });
      n += 1;
    }
  });
  return sortie;
}

const st = StyleSheet.create({
  slide: {
    borderRadius: R.carte, overflow: 'hidden', justifyContent: 'center',
    paddingHorizontal: 16, ...OMBRE,
  },
  bulle: {
    position: 'absolute', right: -18, top: -18, width: 128, height: 128,
    borderRadius: 64, alignItems: 'center', justifyContent: 'center',
  },
  slideTexte: { paddingRight: 96 },
  eyebrow: {
    fontSize: 10.5, fontWeight: '700', color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3,
  },
  slideTitre: { fontSize: 17, fontWeight: '800', color: '#FFF', lineHeight: 21 },
  slideSous: { fontSize: 11.5, color: 'rgba(255,255,255,0.8)', marginTop: 3 },
  slideBouton: {
    alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#FFF',
    borderRadius: R.puce, paddingHorizontal: 12, paddingVertical: 6,
  },
  slideBoutonTexte: { fontSize: 11.5, fontWeight: '700', color: C.encre },

  mention: {
    position: 'absolute', right: 10, bottom: 7,
    fontSize: 9, color: 'rgba(255,255,255,0.55)',
  },

  points: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 9 },
  point: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.grisClair },
  pointActif: { backgroundColor: C.marine, width: 16 },

  haute: {
    flex: 1, borderRadius: R.carte, padding: 12, overflow: 'hidden',
    minHeight: 286, ...OMBRE,
  },
  hauteEyebrow: {
    fontSize: 9.5, fontWeight: '700', color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  hauteTitre: { fontSize: 15.5, fontWeight: '800', color: '#FFF', lineHeight: 19, marginTop: 4 },
  hauteVentre: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 66 },
  hauteSous: { fontSize: 11, color: 'rgba(255,255,255,0.82)', lineHeight: 15 },
  hauteBouton: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    marginTop: 9, backgroundColor: '#FFF', borderRadius: R.puce,
    paddingHorizontal: 11, paddingVertical: 6,
  },
  hauteBoutonTexte: { fontSize: 11.5, fontWeight: '700', color: C.encre },
});

export default SlidesPub;
