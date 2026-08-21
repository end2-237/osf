import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, Pressable, ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { C, R, E, OMBRE, useLargeur } from '../lib/ui';
import Icone from './Icone';


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

/* ── La régie ────────────────────────────────────────────────────────────
   Les campagnes viennent de la base, plus du code : la console du
   super-admin les écrit, et elles arrivent au prochain chargement d'écran —
   sans déploiement, sans mise à jour à installer.

   Le repli sur les constantes ci-dessus n'est pas de la prudence décorative :
   un téléphone hors réseau, ou une régie vide un lundi matin, laisserait
   sinon un trou dans la page. Un emplacement vide se remarque plus qu'une
   réclame.

   La FENÊTRE de diffusion est jugée en base et jamais ici : sur un téléphone
   dont l'horloge est fausse — et il y en a — on afficherait une campagne
   terminée, ou l'on raterait celle du jour. */
function useCampagnes(emplacement, repli) {
  const [pubs, setPubs] = useState(repli);

  useEffect(() => {
    let vivant = true;
    supabase.rpc('pubs_actives', { p_emplacement: emplacement })
      .then(({ data, error }) => {
        if (!vivant || error || !data?.length) return;
        setPubs(data.map((p) => ({
          id: p.id,
          fond: p.fond || C.marine,
          teinte: p.teinte,
          icone: p.icone,
          eyebrow: p.eyebrow,
          titre: p.titre,
          sous: p.sous_titre,
          action: p.action,
          img: p.image_url,
          route: routeDe(p),
        })));
      });
    return () => { vivant = false; };
  }, [emplacement]);

  return pubs;
}

function routeDe(p) {
  if (p.cible_type === 'boutique' && p.cible_id) return `/boutique/${p.cible_id}`;
  if (p.cible_type === 'produit' && p.cible_id) return `/produit/${p.cible_id}`;
  return p.cible_url || null;
}

// Le clic est compté au départ, pas à l'arrivée : si la destination met du
// temps à s'ouvrir et que le client renonce, le clic a quand même eu lieu.
function compterClic(id) {
  if (id) supabase.rpc('pub_clic', { p_id: id }).then(() => {}, () => {});
}

/* ── ① Le rail de diapositives ───────────────────────────────────────────── */
export function SlidesPub({ pubs: fournies, hauteur = 132 }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const ref = useRef(null);
  const L = useLargeur();
  const largeur = L - E.page * 2;
  const chargees = useCampagnes('slide', PUBS_LARGES);
  const pubs = fournies || chargees;

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
            onPress={() => { compterClic(b.id); if (b.route) router.push(b.route); }}
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

/* Le carrousel du haut de l'accueil. Les bannières viennent de la régie et
   retombent sur les nôtres si elle est vide. */
export function useCarrouselPub(repli) {
  const pubs = useCampagnes('carrousel', repli);
  return pubs;
}

/* Les stories. La régie fournit le VISUEL et le texte ; les articles, eux,
   viennent du catalogue et sont attachés par l'écran — une story sans stock
   est une affiche qu'on referme, et c'est le tiroir d'articles qui fait tout
   l'intérêt du format. */
export function useStoriesPub(repli) {
  return useCampagnes('story', repli);
}

/* Les cartes de grille, à appeler EN HAUT d'un écran. Un tableau stable est
   renvoyé tant que la régie n'a pas répondu, pour que `melangerPubs` ne
   réordonne pas la grille sous les doigts du client. */
export function useCartesPub() {
  return useCampagnes('carte', PUBS_HAUTES);
}

/* ── ② La carte haute, à poser dans une case de grille ───────────────────── */
export function PubVerticale({ pub = PUBS_HAUTES[0], largeur }) {
  const router = useRouter();
  if (!pub) return null;

  return (
    <Pressable
      onPress={() => { compterClic(pub.id); if (pub.route) router.push(pub.route); }}
      style={[st.haute, { backgroundColor: pub.fond }, !!largeur && { width: largeur }]}>

      {!!pub.img && (
        <Image source={{ uri: pub.img }} resizeMode="cover" style={StyleSheet.absoluteFill} />
      )}

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
