import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Dimensions, RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { produits, categories } from '../../lib/boutique';
import CarteProduit from '../../components/CarteProduit';
import { TitreSection, Puces, Squelette, Vide } from '../../components/Base';
import { SlidesPub, PubVerticale, melangerPubs, useCartesPub } from '../../components/Pub';
import { C, R, S, E, OMBRE, useGrille, COLONNES } from '../../lib/ui';
import Icone, { IconeCategorie } from '../../components/Icone';

/* ══════════════════════════════════════════════════════════════════════════
   LE CATALOGUE — deux niveaux

   Premier niveau : toutes les catégories, en grille. C'est là qu'arrive
   celui qui ne sait pas encore ce qu'il veut, et il choisit une direction.

   Second niveau : la catégorie ouverte, avec un rail de marques en haut et la
   grille en dessous. Le rail de marques n'est pas un filtre de plus — c'est
   la façon dont les gens cherchent réellement une chaussure ou un téléphone.

   Le retour du second niveau ramène au premier, jamais à l'accueil : sinon on
   perd la place et on recommence tout.
   ══════════════════════════════════════════════════════════════════════════ */

export default function Catalogue() {
  const router = useRouter();
  const { type } = useLocalSearchParams();
  const cartesPub = useCartesPub();
  const { cellule } = useGrille(COLONNES.produits);
  const { cellule: celluleCat } = useGrille(COLONNES.categories);

  const [cats, setCats] = useState(null);
  const [liste, setListe] = useState(null);
  const [page, setPage] = useState(0);
  const [encore, setEncore] = useState(true);
  const [tri, setTri] = useState('recent');
  const [raf, setRaf] = useState(false);

  useEffect(() => { categories().then(setCats); }, []);

  const charger = useCallback(async (p, remplacer) => {
    const { data } = await produits({ type, limite: 12, depuis: p * 12 });
    if (!data.length && !remplacer) { setEncore(false); return; }
    setListe((l) => (remplacer || p === 0 ? data : [...(l || []), ...data]));
    setPage(p);
  }, [type]);

  useEffect(() => {
    if (!type) { setListe(null); return; }
    setEncore(true); setListe(null);
    charger(0, true);
  }, [type, charger]);

  const trier = (l) => {
    if (!l) return l;
    const c = [...l];
    if (tri === 'prix_haut') c.sort((a, b) => b.price - a.price);
    if (tri === 'prix_bas') c.sort((a, b) => a.price - b.price);
    return c;
  };

  /* ── Premier niveau ───────────────────────────────────────────────────── */
  if (!type) {
    return (
      <View style={S.page}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
          <View style={st.enTete}>
            <Text style={st.titre}>Catalogue</Text>
            <Pressable onPress={() => router.push('/recherche')} style={st.recherche}>
              <Icone nom="recherche" taille={17} couleur="rgba(255,255,255,0.55)" />
              <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)' }}>
                Chercher un article
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={{ paddingVertical: 14, paddingBottom: 28 }}>
          {cats === null ? (
            <View style={{ paddingHorizontal: E.page, gap: 10 }}>
              {[0, 1, 2].map((i) => <Squelette key={i} hauteur={120} />)}
            </View>
          ) : cats.length === 0 ? (
            <Vide icone="catalogue" titre="Le catalogue est vide"
              texte="Aucun article n’est encore publié. Reviens dans un moment." />
          ) : (
            <View style={st.grilleCats}>
              {cats.map((c) => (
                <Pressable key={c.nom} style={[st.cat, { width: celluleCat }]}
                  onPress={() => router.setParams({ type: c.nom })}>
                  <View style={st.catImage}><IconeCategorie nom={c.nom} taille={30} /></View>
                  <Text style={st.catTexte} numberOfLines={2}>{c.nom}</Text>
                  <Text style={st.catCompte}>{c.n} article{c.n > 1 ? 's' : ''}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  /* ── Second niveau ────────────────────────────────────────────────────── */
  const l = trier(liste);

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable hitSlop={10} onPress={() => router.setParams({ type: undefined })}>
              <Icone nom="retour" taille={25} couleur="#FFF" />
            </Pressable>
            <Text style={[st.titre, { flex: 1, textAlign: 'left', marginTop: 0 }]} numberOfLines={1}>
              {type}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/recherche')} style={st.recherche}>
            <Icone nom="recherche" taille={17} couleur="rgba(255,255,255,0.55)" />
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)' }}>
              Chercher dans {type}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        scrollEventThrottle={200}
        onScroll={({ nativeEvent: n }) => {
          if (encore && liste &&
              n.layoutMeasurement.height + n.contentOffset.y >= n.contentSize.height - 500) {
            charger(page + 1);
          }
        }}
        refreshControl={
          <RefreshControl refreshing={raf} onRefresh={async () => {
            setRaf(true); setEncore(true); await charger(0, true); setRaf(false);
          }} />
        }>

        <View style={{ paddingTop: 12 }}>
          <Puces valeurs={[
            { valeur: 'recent', libelle: 'Nouveautés' },
            { valeur: 'prix_bas', libelle: 'Prix croissant' },
            { valeur: 'prix_haut', libelle: 'Prix décroissant' },
          ]} actif={tri} onChoisir={setTri} />
        </View>

        {/* Les diapositives de pub, entre le tri et la grille. C'est le seul
            endroit de l'écran où une réclame ne coupe pas une lecture en
            cours : au-dessus, on choisit ; en dessous, on regarde. */}
        <View style={{ marginTop: 14 }}>
          <SlidesPub hauteur={118} />
        </View>

        {l === null ? (
          <View style={[st.grille, { marginTop: 16 }]}>
            {[0, 1, 2, 3].map((i) => (
              <Squelette key={i} hauteur={250} style={{ width: cellule }} />
            ))}
          </View>
        ) : l.length === 0 ? (
          <Vide icone="recherche" titre="Rien dans cette catégorie"
            texte="Aucun article n’y est publié pour le moment."
            bouton="Voir tout le catalogue"
            onBouton={() => router.setParams({ type: undefined })} />
        ) : (
          <>
            <TitreSection titre={`${l.length} article${l.length > 1 ? 's' : ''}`} style={{ marginTop: 16 }} />
            <View style={st.grille}>
              {melangerPubs(l, cartesPub).map((e) =>
                e.type === 'produit' ? (
                  <View key={e.p.id} style={{ width: cellule }}>
                    <CarteProduit p={e.p} />
                  </View>
                ) : (
                  <View key={e.cle} style={{ width: cellule }}>
                    <PubVerticale pub={e.pub} />
                  </View>
                ))}
            </View>
            {encore && <Squelette hauteur={70} style={{ margin: E.page }} />}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  enTete: { paddingHorizontal: E.page, paddingBottom: 14, paddingTop: 4 },
  titre: { color: '#FFF', fontSize: 19, fontWeight: '800', marginTop: 6 },
  recherche: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    marginTop: 10, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: R.puce, paddingHorizontal: 16, paddingVertical: 11,
  },

  grilleCats: {
    flexDirection: 'row', flexWrap: 'wrap', gap: E.gouttiere, paddingHorizontal: E.page,
  },
  cat: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 10,
    alignItems: 'center', gap: 5, ...OMBRE,
  },
  catImage: {
    width: '100%', aspectRatio: 1.1, borderRadius: R.vignette,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
  },
  catTexte: { fontSize: 11.5, color: C.encre, textAlign: 'center', lineHeight: 14, minHeight: 28 },
  catCompte: { fontSize: 10, color: C.gris },

  grille: {
    flexDirection: 'row', flexWrap: 'wrap', gap: E.gouttiere, paddingHorizontal: E.page,
  },
});
