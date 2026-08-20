import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable, Image, StyleSheet, Dimensions, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { produits, categories } from '../lib/boutique';
import CarteProduit from '../components/CarteProduit';
import { TitreSection, Squelette, Vide } from '../components/Base';
import { C, R, S, E, OMBRE, fcfa } from '../lib/ui';

const L = Dimensions.get('window').width;
const CLE = 'btl_recherches';

/* ══════════════════════════════════════════════════════════════════════════
   LA RECHERCHE — trois états

   ① AVEC HISTORIQUE : ses dernières recherches, les recherches populaires,
      et le top des articles cherchés. Les deux derniers blocs ne sont pas du
      remplissage : ils servent à celui qui ouvre la recherche sans savoir
      quoi taper, et c'est le cas le plus fréquent.

   ② SANS HISTORIQUE : mêmes blocs, sans les siens. On ne montre jamais un
      écran nu à quelqu'un qui vient chercher quelque chose.

   ③ EN SAISIE : les suggestions apparaissent à la frappe, catégories d'abord
      puis mots-clés, et les résultats en dessous.

   L'historique vit sur le téléphone. Le stocker en base obligerait à être
   connecté pour chercher, ce qui n'a aucun sens.
   ══════════════════════════════════════════════════════════════════════════ */

const POPULAIRES = [
  { icone: '📱', titre: 'Téléphones', sous: 'Smartphones et accessoires', type: 'Tech Lab' },
  { icone: '🎧', titre: 'Audio', sous: 'Casques et enceintes', type: 'Audio Lab' },
  { icone: '👟', titre: 'Chaussures', sous: 'Homme et femme', type: 'Shoes' },
  { icone: '💄', titre: 'Beauté', sous: 'Soins et parfums', type: 'Beauté' },
];

export default function Recherche() {
  const router = useRouter();
  const champ = useRef(null);

  const [q, setQ] = useState('');
  const [histo, setHisto] = useState([]);
  const [cats, setCats] = useState([]);
  const [top, setTop] = useState(null);
  const [res, setRes] = useState(null);
  const [cherche, setCherche] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CLE).then((v) => setHisto(JSON.parse(v || '[]'))).catch(() => {});
    categories().then(setCats);
    produits({ limite: 6 }).then(({ data }) => setTop(data));
    setTimeout(() => champ.current?.focus(), 300);
  }, []);

  // Recherche à la frappe, avec un délai : sans lui on interroge la base à
  // chaque touche et les réponses arrivent dans le désordre.
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setRes(null); setCherche(false); return; }
    setCherche(true);
    let vivant = true;
    const minuteur = setTimeout(() => {
      produits({ recherche: t, limite: 20 }).then(({ data }) => {
        if (!vivant) return;
        setRes(data); setCherche(false);
      });
    }, 320);
    return () => { vivant = false; clearTimeout(minuteur); };
  }, [q]);

  const retenir = async (terme) => {
    const t = terme.trim();
    if (!t) return;
    const suite = [t, ...histo.filter((x) => x !== t)].slice(0, 8);
    setHisto(suite);
    AsyncStorage.setItem(CLE, JSON.stringify(suite)).catch(() => {});
  };

  const lancer = (terme) => { setQ(terme); retenir(terme); Keyboard.dismiss(); };

  const enSaisie = q.trim().length >= 2;
  const suggestions = enSaisie
    ? cats.filter((c) => c.nom.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 4)
    : [];

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.marine }}>
        <View style={st.enTete}>
          <Pressable hitSlop={10} onPress={() => router.back()}>
            <Text style={{ color: '#FFF', fontSize: 24 }}>‹</Text>
          </Pressable>
          <View style={st.champ}>
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)' }}>🔍</Text>
            <TextInput
              ref={champ} value={q} onChangeText={setQ}
              onSubmitEditing={() => lancer(q)} returnKeyType="search"
              placeholder="Chercher dans Buyticle"
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={st.saisie} />
            {!!q && (
              <Pressable hitSlop={8} onPress={() => setQ('')}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17 }}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingVertical: 14, paddingBottom: 30 }}>

        {/* ③ En saisie */}
        {enSaisie ? (
          <>
            {suggestions.length > 0 && (
              <View style={[st.bloc, { padding: 0, overflow: 'hidden' }]}>
                {suggestions.map((c) => (
                  <Pressable key={c.nom} style={st.suggestion}
                    onPress={() => { retenir(q); router.push(`/catalogue?type=${encodeURIComponent(c.nom)}`); }}>
                    <Text style={{ fontSize: 15 }}>🗂</Text>
                    <Text style={{ flex: 1, fontSize: 14, color: C.encre }}>
                      {q} <Text style={{ color: C.gris }}>dans</Text> {c.nom}
                    </Text>
                    <Text style={{ color: C.grisClair, fontSize: 18 }}>›</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {cherche ? (
              <View style={[st.grille, { marginTop: 14 }]}>
                {[0, 1].map((i) => (
                  <Squelette key={i} hauteur={240}
                    style={{ width: (L - E.page * 2 - E.gouttiere) / 2 }} />
                ))}
              </View>
            ) : res?.length ? (
              <>
                <TitreSection titre={`${res.length} résultat${res.length > 1 ? 's' : ''}`}
                  style={{ marginTop: 16 }} />
                <View style={st.grille}>
                  {res.map((p) => (
                    <View key={p.id} style={{ width: (L - E.page * 2 - E.gouttiere) / 2 }}>
                      <CarteProduit p={p} />
                    </View>
                  ))}
                </View>
              </>
            ) : res ? (
              <Vide icone="🔍" titre={`Rien pour « ${q} »`}
                texte="Essaie un autre mot, ou demande-le à un commerçant : s’il ne l’a pas, il t’enverra chez un voisin qui l’a."
                bouton="Comment marche le relais" onBouton={() => router.push('/relais')} />
            ) : null}
          </>
        ) : (
          <>
            {/* ① Son historique */}
            {histo.length > 0 && (
              <View style={{ marginBottom: 4 }}>
                <View style={st.ligneTitre}>
                  <Text style={S.titreSection}>Recherches récentes</Text>
                  <Pressable onPress={() => { setHisto([]); AsyncStorage.removeItem(CLE); }}>
                    <Text style={S.lienSection}>Tout effacer</Text>
                  </Pressable>
                </View>
                <View style={st.puces}>
                  {histo.map((h) => (
                    <Pressable key={h} onPress={() => lancer(h)} style={st.puce}>
                      <Text style={{ fontSize: 13, color: C.encre }}>{h}</Text>
                      <Pressable hitSlop={6}
                        onPress={() => {
                          const s = histo.filter((x) => x !== h);
                          setHisto(s); AsyncStorage.setItem(CLE, JSON.stringify(s));
                        }}>
                        <Text style={{ color: C.grisClair, fontSize: 13 }}>✕</Text>
                      </Pressable>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* ② Les populaires — le bloc qui sert quand on ne sait pas quoi taper */}
            <TitreSection titre="Populaires en ce moment" style={{ marginTop: 16 }} />
            <View style={[st.bloc, { padding: 0, overflow: 'hidden' }]}>
              {POPULAIRES.map((p) => (
                <Pressable key={p.titre} style={st.suggestion}
                  onPress={() => router.push(`/catalogue?type=${encodeURIComponent(p.type)}`)}>
                  <Text style={{ fontSize: 18 }}>{p.icone}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.encre }}>{p.titre}</Text>
                    <Text style={{ fontSize: 11.5, color: C.gris }}>{p.sous}</Text>
                  </View>
                  <Text style={{ color: C.grisClair, fontSize: 18 }}>›</Text>
                </Pressable>
              ))}
            </View>

            <TitreSection titre="Top des recherches" style={{ marginTop: 18 }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingHorizontal: E.page }}>
              {top === null
                ? [0, 1, 2].map((i) => <Squelette key={i} hauteur={240} style={{ width: 158 }} />)
                : top.map((p) => <CarteProduit key={p.id} p={p} largeur={158} />)}
            </ScrollView>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  enTete: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: E.page, paddingVertical: 10,
  },
  champ: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: R.puce,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  saisie: { flex: 1, fontSize: 15, color: '#FFF', padding: 0 },

  ligneTitre: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: E.page, marginBottom: 10,
  },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: E.page },
  puce: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.carte, borderRadius: R.puce,
    paddingHorizontal: 13, paddingVertical: 8, ...OMBRE,
  },

  bloc: {
    backgroundColor: C.carte, borderRadius: R.carte,
    marginHorizontal: E.page, ...OMBRE,
  },
  suggestion: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.bord,
  },

  grille: {
    flexDirection: 'row', flexWrap: 'wrap', gap: E.gouttiere, paddingHorizontal: E.page,
  },
});
