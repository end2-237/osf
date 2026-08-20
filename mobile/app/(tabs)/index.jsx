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
import { C, R, S, E, OMBRE } from '../../lib/ui';

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
  { valeur: 'Tech Lab', libelle: 'Tech', icone: '💻' },
  { valeur: 'Audio Lab', libelle: 'Audio', icone: '🎧' },
  { valeur: 'Femme', libelle: 'Femme', icone: '👗' },
  { valeur: 'Shoes', libelle: 'Chaussures', icone: '👟' },
  { valeur: 'Maison', libelle: 'Maison', icone: '🏡' },
  { valeur: 'Beauté', libelle: 'Beauté', icone: '💄' },
];

const SERVICES = [
  { icone: '⚡', titre: 'Ventes\nflash', route: '/store?flash=1' },
  { icone: '🎁', titre: 'Cartes\ncadeaux', route: '/profil' },
  { icone: '🔴', titre: 'Lives', route: '/lives' },
  { icone: '🚀', titre: 'Livraison\nexpress', route: '/catalogue' },
  { icone: '🔁', titre: 'Le\nrelais', route: '/relais' },
  { icone: '👥', titre: 'Parrainage', route: '/parrainage' },
];

const BANNIERES = [
  { titre: 'Commence l’année\navec de bonnes affaires', sous: 'Jusqu’à −33 % sur des milliers d’articles', fond: C.orange },
  { titre: 'Livraison gratuite\nà Douala', sous: 'Dès 25 000 F d’achat', fond: '#2E7D32' },
  { titre: 'Paiement en 12 fois', sous: 'Sans frais, sur les articles marqués 0-0-24', fond: C.marine },
];

export default function Accueil() {
  const router = useRouter();
  const { user } = useSession();

  const [cats, setCats] = useState([]);
  const [offres, setOffres] = useState(null);
  const [nouveautes, setNouv] = useState(null);
  const [top, setTop] = useState(null);
  const [grille, setGrille] = useState([]);
  const [page, setPage] = useState(0);
  const [encore, setEncore] = useState(true);
  const [rafraichit, setRaf] = useState(false);

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

  // Le chargement se déclenche à l'approche du bas, jamais sur un bouton :
  // un bouton « voir plus » coupe la lecture et fait chuter le défilement.
  const auBord = ({ layoutMeasurement, contentOffset, contentSize }) =>
    layoutMeasurement.height + contentOffset.y >= contentSize.height - 600;

  return (
    <View style={S.page}>
      {/* ① L'en-tête marine */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={st.enTeteHaut}>
            <Text style={st.logo}>buy<Text style={{ color: C.orange }}>ticle</Text></Text>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <Pressable onPress={() => router.push('/notifications')} hitSlop={8}>
                <Text style={{ fontSize: 19 }}>🔔</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/aide')} hitSlop={8}>
                <Text style={{ fontSize: 19 }}>🎧</Text>
              </Pressable>
            </View>
          </View>

          <Pressable onPress={() => router.push('/recherche')} style={st.recherche}>
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)' }}>
              🔍  Chercher un article
            </Text>
          </Pressable>

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

        {/* ③ Le carrousel */}
        <View style={{ marginTop: 14 }}>
          <Carrousel bannieres={BANNIERES} onOuvrir={() => router.push('/catalogue')} />
        </View>

        {/* ④ Les deux cartes de service */}
        <View style={st.duo}>
          <View style={[st.duoCarte]}>
            <Text style={{ fontSize: 18 }}>🚚</Text>
            <Text style={st.duoTexte}>Livraison{'\n'}gratuite</Text>
          </View>
          <View style={[st.duoCarte]}>
            <Text style={{ fontSize: 18 }}>🎯</Text>
            <Text style={st.duoTexte}>Programme{'\n'}de fidélité</Text>
          </View>
        </View>

        {/* ⑤ La grille de services */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingHorizontal: E.page, marginTop: 14 }}>
          {SERVICES.map((s) => (
            <Pressable key={s.titre} onPress={() => router.push(s.route)} style={st.service}>
              <View style={st.serviceRond}><Text style={{ fontSize: 20 }}>{s.icone}</Text></View>
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
                    <Text style={{ fontSize: 26 }}>{emojiCategorie(c.nom)}</Text>
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

        {/* ⑨ Les promotions */}
        <View style={{ marginTop: 18 }}>
          <TitreSection titre="Promotions" lien="toutes" onLien={() => router.push('/catalogue')} />
          <Carrousel hauteur={130} bannieres={[
            { titre: 'Le mois du high-tech', sous: 'Jusqu’à −40 %', fond: '#3949AB' },
            { titre: 'Maison & cuisine', sous: 'Sélection à petit prix', fond: '#00897B' },
          ]} onOuvrir={() => router.push('/catalogue')} />
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
          <Text style={{ fontSize: 52 }}>🏃</Text>
        </Pressable>

        {/* ⑫ La grille infinie, avec bannières intercalées */}
        <View style={{ marginTop: 18 }}>
          <TitreSection titre="Ça pourrait te plaire" />
          <View style={st.grille}>
            {grille.map((p, i) => (
              <React.Fragment key={p.id}>
                <View style={st.celluleGrille}><CarteProduit p={p} /></View>
                {/* Une bannière tous les six articles : elle coupe la
                    monotonie sans casser la lecture en colonnes. */}
                {(i + 1) % 6 === 0 && (
                  <Pressable onPress={() => router.push('/catalogue')}
                    style={[st.celluleGrille, st.banniereGrille]}>
                    <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>
                      Nouvel an{'\n'}avec des remises
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 6 }}>
                      Voir la sélection ›
                    </Text>
                  </Pressable>
                )}
              </React.Fragment>
            ))}
          </View>
          {encore && grille.length > 0 && <Squelette hauteur={80} style={{ margin: E.page }} />}
        </View>
      </ScrollView>
    </View>
  );
}

function emojiCategorie(nom) {
  const n = (nom || '').toLowerCase();
  if (n.includes('tech')) return '💻';
  if (n.includes('audio')) return '🎧';
  if (n.includes('femme') || n.includes('cloth')) return '👗';
  if (n.includes('shoe')) return '👟';
  if (n.includes('beaut')) return '💄';
  if (n.includes('maison')) return '🏡';
  if (n.includes('sport')) return '⚽';
  if (n.includes('bébé') || n.includes('enfant')) return '🧸';
  if (n.includes('auto')) return '🚗';
  if (n.includes('sant')) return '💊';
  if (n.includes('nutrition') || n.includes('aliment')) return '🥗';
  if (n.includes('restaur')) return '🍽';
  return '📦';
}

const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingBottom: 14 },
  enTeteHaut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 40,
  },
  logo: { color: '#FFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  recherche: {
    marginTop: 4, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: R.puce, paddingHorizontal: 16, paddingVertical: 12,
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
