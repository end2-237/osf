import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, RefreshControl, StyleSheet, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../lib/session';
import { produits, categories } from '../../lib/boutique';
import CarteProduit from '../../components/CarteProduit';
import { TitreSection, Puces, Carrousel, Squelette } from '../../components/Base';
import Stories from '../../components/Stories';
import {
  SlidesPub, PubVerticale, melangerPubs, useCartesPub, useCarrouselPub, useStoriesPub,
} from '../../components/Pub';
import Logo from '../../components/Logo';
import { C, R, S, E, OMBRE } from '../../lib/ui';
import Icone, { IconeCategorie } from '../../components/Icone';

const L = Dimensions.get('window').width;

/* ══════════════════════════════════════════════════════════════════════════
   L'ACCUEIL — douze blocs, dans cet ordre

   L'ordre n'est pas une question de goût. Il descend du plus décidé au moins
   décidé : celui qui sait ce qu'il veut trouve la recherche en haut ; celui
   qui vient voir descend et se laisse prendre par les offres ; celui qui ne
   voulait rien tombe sur la grille infinie du bas.

   Un seul bloc change de nature par rapport à la référence : le bandeau
   marine ne vend pas l'inscription, il vend LE RELAIS. C'est notre seule
   proposition que personne d'autre ne fait.
   ══════════════════════════════════════════════════════════════════════════ */

const RACCOURCIS = [
  { valeur: 'Tech Lab', libelle: 'Tech', icone: 'catalogue' },
  { valeur: 'Audio Lab', libelle: 'Audio', icone: 'casque' },
  { valeur: 'Femme', libelle: 'Femme', icone: 'etiquette' },
  { valeur: 'Shoes', libelle: 'Chaussures', icone: 'colis' },
  { valeur: 'Maison', libelle: 'Maison', icone: 'boutique' },
  { valeur: 'Beauté', libelle: 'Beauté', icone: 'cadeau' },
];

// Chaque service porte sa couleur : c'est ce qui les rend reconnaissables
// d'un coup d'œil dans un rail qui défile.
const SERVICES = [
  { icone: 'eclair',    teinte: '#FF6B00', titre: 'Ventes\nflash',       route: '/catalogue' },
  { icone: 'cadeau',    teinte: '#E53935', titre: 'Cartes\ncadeaux',     route: '/fidelite' },
  { icone: 'live',      teinte: '#D81B60', titre: 'Lives',               route: '/lives' },
  { icone: 'fusee',     teinte: '#2C6BED', titre: 'Livraison\nexpress',  route: '/catalogue' },
  { icone: 'relais',    teinte: '#00897B', titre: 'Le\nrelais',          route: '/relais' },
  { icone: 'personnes', teinte: '#7B1FA2', titre: 'Parrainage',          route: '/parrainage' },
];

// Le repli des stories, quand la régie est vide ou le réseau coupé. Les
// articles, eux, sont attachés au chargement : une story sans stock est une
// affiche qu'on referme, et le tiroir est tout l'intérêt du format.
const STORIES_REPLI = [
  { id: 'beaute', titre: 'Beauté −40 %', icone: 'cadeau', fond: '#2C6BED',
    sous: 'Sur une sélection de soins et parfums, jusqu’à dimanche.' },
  { id: 'tech', titre: 'Le mois high-tech', icone: 'catalogue', fond: C.marine,
    sous: 'Téléphones et ordinateurs, payables en douze fois.' },
  { id: 'relais', titre: 'Le relais', icone: 'relais', fond: '#00897B',
    sous: 'Un vendeur ne l’a pas ? Il t’envoie chez un voisin qui l’a — et tu paies moins cher.',
    action: 'Comment ça marche', route: '/relais' },
];

const BANNIERES = [
  { titre: 'Commence l’année\navec de bonnes affaires', sous: 'Jusqu’à −33 % sur des milliers d’articles', fond: C.orange },
  { titre: 'Livraison gratuite\nà Douala', sous: 'Dès 25 000 F d’achat', fond: '#2E7D32' },
  { titre: 'Paiement en 12 fois', sous: 'Sans frais, sur les articles marqués 0-0-24', fond: C.marine },
];

export default function Accueil() {
  const router = useRouter();
  const { user } = useSession();
  const cartesPub = useCartesPub();
  const bannieres = useCarrouselPub(BANNIERES);
  const storiesPub = useStoriesPub(STORIES_REPLI);

  const [cats, setCats] = useState([]);
  const [offres, setOffres] = useState(null);
  const [nouveautes, setNouv] = useState(null);
  const [top, setTop] = useState(null);
  const [grille, setGrille] = useState([]);
  const [page, setPage] = useState(0);
  const [encore, setEncore] = useState(true);
  const [rafraichit, setRaf] = useState(false);
  const [articlesStories, setArticlesStories] = useState([]);

  const charger = useCallback(async () => {
    const [c, o, n, t] = await Promise.all([
      categories(),
      produits({ limite: 8 }),
      produits({ limite: 8, depuis: 8 }),
      produits({ limite: 8, depuis: 16 }),
    ]);
    setCats(c);
    setOffres(o.data);
    setNouv(n.data);
    setTop(t.data);

    // Les stories portent de vrais articles, jamais des visuels seuls : le
    // tiroir est tout l'intérêt du format, et il lui faut du stock.
    setArticlesStories([...(o.data || []), ...(t.data || [])]);
  }, []);

  const chargerGrille = useCallback(async (p) => {
    const { data } = await produits({ limite: 10, depuis: p * 10 });
    if (!data.length) { setEncore(false); return; }
    setGrille((g) => (p === 0 ? data : [...g, ...data]));
    setPage(p);
  }, []);

  useEffect(() => { charger(); chargerGrille(0); }, [charger, chargerGrille]);

  const rafraichir = async () => {
    setRaf(true); setEncore(true);
    await Promise.all([charger(), chargerGrille(0)]);
    setRaf(false);
  };

  // Chaque story reçoit une tranche différente du catalogue : quatre articles
  // par story, sans recouvrement, pour qu'ouvrir la seconde ne redonne pas ce
  // qu'on vient de voir dans la première.
  const histoires = storiesPub.map((h, i) => ({
    ...h,
    accroche: h.sous || h.accroche,
    // La régie parle d'`img` ; le lecteur de stories attend `vignette` pour
    // la pastille du rail et `img` pour le plein écran. On donne les deux.
    vignette: h.img || h.vignette,
    produits: h.produits || articlesStories.slice(i * 4, i * 4 + 4),
  }));

  // Le chargement se déclenche à l'approche du bas, jamais sur un bouton :
  // un bouton « voir plus » coupe la lecture et fait chuter le défilement.
  const auBord = ({ layoutMeasurement, contentOffset, contentSize }) =>
    layoutMeasurement.height + contentOffset.y >= contentSize.height - 600;

  return (
    <View style={S.page}>
      {/* ① L'en-tête marine */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          {/* Ligne 1 — le logo seul, centré. C'est la marque, et rien d'autre
              ne partage sa ligne : posé au milieu, il tient l'écran. */}
          <View style={st.ligneLogo}>
            <Logo taille={21} />
          </View>

          {/* Ligne 2 — l'épingle, le champ, puis la cloche et le casque. Les
              trois affaires du client sur une seule ligne : où on livre, ce
              qu'il cherche, et à qui parler. */}
          <View style={st.ligneRecherche}>
            <Icone nom="position" taille={20} couleur="rgba(255,255,255,0.75)" />
            <Pressable onPress={() => router.push('/recherche')} style={st.recherche}>
              <Icone nom="recherche" taille={17} couleur="rgba(255,255,255,0.55)" />
              <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)' }}>
                Chercher un article
              </Text>
            </Pressable>
            <Pressable onPress={() => router.push('/notifications')} hitSlop={8}>
              <Icone nom="cloche" taille={22} couleur="#FFF" />
            </Pressable>
            <Pressable onPress={() => router.push('/aide')} hitSlop={8}>
              <Icone nom="casque" taille={22} couleur="#FFF" />
            </Pressable>
          </View>

          {/* ② Les puces de raccourci */}
          <View style={{ marginTop: 10, marginHorizontal: -E.page }}>
            <Puces valeurs={RACCOURCIS} sombre
              onChoisir={(v) => router.push(`/catalogue?type=${encodeURIComponent(v)}`)} />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        scrollEventThrottle={200}
        onScroll={({ nativeEvent }) => {
          if (encore && auBord(nativeEvent)) chargerGrille(page + 1);
        }}
        refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={rafraichir} />}>

        {/* La nappe marine. Elle prolonge l'en-tête et descend jusqu'aux
            quatre cinquièmes de la première diapositive : la bannière est
            posée à cheval sur le marine et le lavande, et c'est ce
            chevauchement — pas la bannière elle-même — qui donne la
            profondeur de la référence. Elle défile avec le contenu, sinon
            elle resterait collée sous l'en-tête pendant que tout glisse. */}
        <View pointerEvents="none" style={st.nappe} />

        {/* ②bis Les stories, posées sur la nappe */}
        {histoires.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Stories histoires={histoires} sombre />
          </View>
        )}

        {/* ③ Le carrousel */}
        <View style={{ marginTop: 14 }}>
          <Carrousel bannieres={bannieres}
            onOuvrir={(b) => router.push(b?.route || '/catalogue')} />
        </View>

        {/* ④ Les deux cartes de service */}
        <View style={st.duo}>
          <View style={st.duoCarte}>
            <View style={[st.duoRond, { backgroundColor: '#FFF1E7' }]}>
              <Icone nom="camion" taille={17} couleur={C.orange} />
            </View>
            <Text style={st.duoTexte}>Livraison{'\n'}gratuite</Text>
          </View>
          <View style={st.duoCarte}>
            <View style={[st.duoRond, { backgroundColor: '#FFF1E7' }]}>
              <Icone nom="cible" taille={17} couleur={C.orange} />
            </View>
            <Text style={st.duoTexte}>Programme{'\n'}de fidélité</Text>
          </View>
        </View>

        {/* ⑤ La grille de services */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingHorizontal: E.page, marginTop: 14 }}>
          {SERVICES.map((s) => (
            <Pressable key={s.titre} onPress={() => router.push(s.route)} style={st.service}>
              <View style={[st.serviceRond, { backgroundColor: s.teinte + '18' }]}>
                <Icone nom={s.icone} taille={21} couleur={s.teinte} />
              </View>
              <Text style={st.serviceTexte}>{s.titre}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ⑥ Le bloc orange plein */}
        <View style={st.blocOrange}>
          <View style={st.blocOrangeTitre}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#FFF' }}>
              Offres avantageuses
            </Text>
            <Pressable onPress={() => router.push('/catalogue')} style={st.pilule}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.orange }}>tout voir ›</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingHorizontal: E.page, paddingBottom: 14 }}>
            {offres === null
              ? [0, 1, 2].map((i) => <Squelette key={i} hauteur={250} style={{ width: 160 }} />)
              : offres.map((p) => <CarteProduit key={p.id} p={p} largeur={160} />)}
          </ScrollView>
        </View>

        {/* ⑦ Les catégories populaires */}
        {cats.length > 0 && (
          <View style={{ marginTop: 18 }}>
            <TitreSection titre="Catégories populaires" lien="toutes"
              onLien={() => router.push('/catalogue')} />
            <View style={st.grilleCats}>
              {cats.slice(0, 9).map((c) => (
                <Pressable key={c.nom} style={st.cat}
                  onPress={() => router.push(`/catalogue?type=${encodeURIComponent(c.nom)}`)}>
                  <View style={st.catImage}>
                    <IconeCategorie nom={c.nom} taille={30} />
                  </View>
                  <Text style={st.catTexte} numberOfLines={2}>{c.nom}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ⑧ Nouveautés et tendances — cartes horizontales */}
        <View style={{ marginTop: 18 }}>
          <TitreSection titre="Nouveautés et tendances" lien="tout voir"
            onLien={() => router.push('/catalogue')} />
          <View style={{ paddingHorizontal: E.page, gap: 10 }}>
            {nouveautes === null
              ? [0, 1].map((i) => <Squelette key={i} hauteur={130} />)
              : nouveautes.slice(0, 4).map((p) => (
                  <CarteProduit key={p.id} p={{ ...p, nouveau: true }} horizontal />
                ))}
          </View>
        </View>

        {/* ⑨ Les promotions — le rail de diapositives de pub */}
        <View style={{ marginTop: 18 }}>
          <TitreSection titre="Promotions" lien="toutes" onLien={() => router.push('/catalogue')} />
          <SlidesPub />
        </View>

        {/* ⑩ Le top */}
        <View style={{ marginTop: 18 }}>
          <TitreSection titre="Top produits" lien="tout voir" onLien={() => router.push('/catalogue')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingHorizontal: E.page }}>
            {top === null
              ? [0, 1, 2].map((i) => <Squelette key={i} hauteur={250} style={{ width: 160 }} />)
              : top.map((p) => <CarteProduit key={p.id} p={{ ...p, meilleur_prix: true }} largeur={160} />)}
          </ScrollView>
        </View>

        {/* ⑪ Le bandeau du relais — notre bloc à nous */}
        <Pressable onPress={() => router.push('/relais')} style={st.bandeau}>
          <View style={{ flex: 1 }}>
            <Text style={st.bandeauTitre}>
              Un vendeur ne l’a pas ? <Text style={{ color: C.orange }}>Il t’envoie</Text>
            </Text>
            <Text style={st.bandeauSous}>
              Chez un voisin qui l’a — et tu paies moins cher qu’au prix affiché.
            </Text>
            <View style={st.bandeauBouton}>
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>
                {user ? 'Voir mon relais' : 'Comment ça marche'}
              </Text>
            </View>
          </View>
          <View style={st.bandeauRond}>
            <Icone nom="relais" taille={30} couleur="#FFF" />
          </View>
        </Pressable>

        {/* ⑫ La grille infinie, avec bannières intercalées */}
        <View style={{ marginTop: 18 }}>
          <TitreSection titre="Ça pourrait te plaire" />
          <View style={st.grille}>
            {/* La pub occupe une CASE, pas une bande : elle arrive dans le
                rythme des deux colonnes au lieu de le rompre. */}
            {melangerPubs(grille, cartesPub).map((e) =>
              e.type === 'produit' ? (
                <View key={e.p.id} style={st.celluleGrille}><CarteProduit p={e.p} /></View>
              ) : (
                <View key={e.cle} style={st.celluleGrille}><PubVerticale pub={e.pub} /></View>
              ))}
          </View>
          {encore && grille.length > 0 && <Squelette hauteur={80} style={{ margin: E.page }} />}
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingBottom: 14 },
  ligneLogo: { height: 40, alignItems: 'center', justifyContent: 'center' },
  logo: { color: '#FFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  ligneRecherche: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },

  // 14 (marge stories) + 96 (le rail) + 14 (marge carrousel) + 118 des 150 de
  // la bannière : quatre cinquièmes, pas la totalité. La nappe doit s'arrêter
  // DANS la diapositive, sinon le chevauchement disparaît et on retombe sur
  // un en-tête simplement plus haut.
  nappe: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 242,
    backgroundColor: C.marine,
  },
  recherche: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: R.puce, paddingHorizontal: 15, paddingVertical: 12,
  },
  duoRond: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  bandeauRond: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },

  duo: { flexDirection: 'row', gap: 10, paddingHorizontal: E.page, marginTop: 14 },
  duoCarte: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: C.carte, borderRadius: R.carte, padding: 12, ...OMBRE,
  },
  duoTexte: { fontSize: 12, fontWeight: '700', color: C.encre, lineHeight: 15 },

  service: { width: 68, alignItems: 'center', gap: 6 },
  serviceRond: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: C.carte,
    alignItems: 'center', justifyContent: 'center', ...OMBRE,
  },
  serviceTexte: { fontSize: 10.5, color: C.encre, textAlign: 'center', lineHeight: 13 },

  blocOrange: { backgroundColor: C.orange, marginTop: 18, paddingTop: 14 },
  blocOrangeTitre: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: E.page, marginBottom: 12,
  },
  pilule: { backgroundColor: '#FFF', borderRadius: R.puce, paddingHorizontal: 12, paddingVertical: 6 },

  grilleCats: {
    flexDirection: 'row', flexWrap: 'wrap', gap: E.gouttiere,
    paddingHorizontal: E.page,
  },
  cat: {
    width: (L - E.page * 2 - E.gouttiere * 2) / 3,
    backgroundColor: C.carte, borderRadius: R.carte,
    padding: 10, alignItems: 'center', gap: 6, ...OMBRE,
  },
  catImage: {
    width: '100%', aspectRatio: 1.15, backgroundColor: '#FFF',
    borderRadius: R.vignette, alignItems: 'center', justifyContent: 'center',
  },
  catTexte: { fontSize: 11, color: C.encre, textAlign: 'center', lineHeight: 14, minHeight: 28 },

  bandeau: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.marine, borderRadius: R.carte,
    marginHorizontal: E.page, marginTop: 18, padding: 16,
  },
  bandeauTitre: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  bandeauSous: { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, marginTop: 5, lineHeight: 17 },
  bandeauBouton: {
    alignSelf: 'flex-start', marginTop: 11, backgroundColor: C.orange,
    borderRadius: R.puce, paddingHorizontal: 16, paddingVertical: 8,
  },

  grille: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: E.gouttiere, paddingHorizontal: E.page,
  },
  celluleGrille: { width: (L - E.page * 2 - E.gouttiere) / 2 },
  banniereGrille: {
    backgroundColor: C.marine, borderRadius: R.carte,
    padding: 16, justifyContent: 'center', minHeight: 150,
  },
});
