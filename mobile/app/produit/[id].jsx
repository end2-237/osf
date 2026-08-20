import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, StyleSheet, Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { produit, produits, useBoutique } from '../../lib/boutique';
import CarteProduit from '../../components/CarteProduit';
import { TitreSection, Chargement, Vide } from '../../components/Base';
import { C, R, S, E, OMBRE, fcfa, pourcent } from '../../lib/ui';

const L = Dimensions.get('window').width;

/* ══════════════════════════════════════════════════════════════════════════
   LA FICHE PRODUIT

   L'ordre descend de ce qui décide vers ce qui rassure : la galerie, le prix,
   les modes de réception, la description, les caractéristiques, les avis, les
   suggestions.

   La barre d'achat est FIXÉE en bas. C'est la règle la plus importante de
   l'écran : sur une fiche longue, le prix et le bouton disparaissent au
   défilement, et le client qui a fini de lire doit remonter pour acheter.
   Beaucoup ne remontent pas.
   ══════════════════════════════════════════════════════════════════════════ */

const ONGLETS = ['Aperçu', 'Caractéristiques', 'Avis'];

export default function Produit() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { ouvrirChoix, basculerFavori, estFavori } = useBoutique();

  const [p, setP] = useState(null);
  const [charge, setCharge] = useState(true);
  const [photo, setPhoto] = useState(0);
  const [onglet, setOnglet] = useState('Aperçu');
  const [avis, setAvis] = useState([]);
  const [similaires, setSim] = useState([]);

  useEffect(() => {
    let vivant = true;
    (async () => {
      const { data } = await produit(id);
      if (!vivant) return;
      setP(data); setCharge(false);
      if (data) {
        produits({ type: data.type, limite: 8 })
          .then(({ data: s }) => vivant && setSim((s || []).filter((x) => x.id !== data.id)));
        supabase.from('reviews')
          .select('id, rating, comment, created_at, user_id')
          .eq('product_id', id).order('created_at', { ascending: false }).limit(10)
          .then(({ data: a }) => vivant && setAvis(a || []));
      }
    })();
    return () => { vivant = false; };
  }, [id]);

  if (charge) return <View style={S.page}><Chargement hauteur={500} /></View>;
  if (!p) {
    return (
      <View style={S.page}>
        <Vide icone="🔍" titre="Article introuvable"
          texte="Il a peut-être été retiré de la vente."
          bouton="Retour au catalogue" onBouton={() => router.replace('/catalogue')} />
      </View>
    );
  }

  const photos = Array.isArray(p.images) && p.images.length ? p.images : [p.img].filter(Boolean);
  const remise = pourcent(p.prix_barre, p.price);
  const epuise = p.status === 'Épuisé';
  const noteMoy = avis.length
    ? avis.reduce((s, a) => s + (a.rating || 0), 0) / avis.length : null;

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.carte }}>
        <View style={st.barreHaut}>
          <Pressable hitSlop={10} onPress={() => router.back()}>
            <Text style={{ fontSize: 24, color: C.encre }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {ONGLETS.map((o) => (
              <Pressable key={o} onPress={() => setOnglet(o)}
                style={[st.ongletPuce, onglet === o && { backgroundColor: C.marine }]}>
                <Text style={[st.ongletTexte, onglet === o && { color: '#FFF', fontWeight: '700' }]}>
                  {o}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable hitSlop={10} onPress={() => basculerFavori(p)}>
            <Text style={{ fontSize: 20, color: estFavori(p.id) ? C.rouge : C.grisClair }}>
              {estFavori(p.id) ? '♥' : '♡'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        {/* La galerie */}
        <View style={st.galerie}>
          {epuise && <View style={st.epuise}><Text style={st.epuiseTexte}>ÉPUISÉ</Text></View>}
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) =>
              setPhoto(Math.round(e.nativeEvent.contentOffset.x / L))}>
            {(photos.length ? photos : [null]).map((u, i) => (
              <Image key={i} source={{ uri: u }} resizeMode="contain"
                style={{ width: L, height: 320, backgroundColor: '#FFF' }} />
            ))}
          </ScrollView>
          {photos.length > 1 && (
            <View style={st.points}>
              {photos.map((_, i) => (
                <View key={i} style={[st.point, i === photo && st.pointActif]} />
              ))}
            </View>
          )}
        </View>

        {/* Le prix */}
        <View style={[st.bloc, { gap: 8 }]}>
          {!!remise && (
            <View style={st.rubanPromo}>
              <Text style={st.rubanTexte}>Promotion  {remise}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: C.encre }}>{fcfa(p.price)}</Text>
            {!!remise && <Text style={[S.prixBarre, { fontSize: 14 }]}>{fcfa(p.prix_barre)}</Text>}
          </View>
          {p.price >= 20000 && (
            <View style={st.echelonne}>
              <Text style={{ fontSize: 12, color: C.gris }}>
                ou <Text style={{ fontWeight: '700', color: C.encre }}>
                  {fcfa(Math.round(p.price / 12))}</Text> × 12 mois, sans frais
              </Text>
            </View>
          )}
          <Text style={st.nom}>{p.name}</Text>
          {!!noteMoy && (
            <Text style={{ fontSize: 13, color: C.jaune, fontWeight: '700' }}>
              {noteMoy.toFixed(1)} ★  <Text style={{ color: C.gris, fontWeight: '400' }}>
                ({avis.length} avis)
              </Text>
            </Text>
          )}
        </View>

        {onglet === 'Aperçu' && (
          <>
            {/* La boutique */}
            {!!p.vendor && (
              <Pressable onPress={() => router.push(`/boutique/${p.vendor.id}`)} style={st.bloc}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <View style={st.logo}>
                    {p.vendor.logo_url
                      ? <Image source={{ uri: p.vendor.logo_url }} style={{ width: '100%', height: '100%' }} />
                      : <Text style={{ fontSize: 18 }}>🏪</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '700', color: C.encre }}>
                      {p.vendor.shop_name}
                    </Text>
                    <Text style={{ fontSize: 12, color: C.gris }}>
                      {p.vendor.city || 'Douala'} · Voir la boutique
                    </Text>
                  </View>
                  <Text style={{ color: C.grisClair, fontSize: 20 }}>›</Text>
                </View>
              </Pressable>
            )}

            {/* Les modes de réception */}
            <View style={[st.bloc, { gap: 10 }]}>
              <Text style={S.titre}>Comment le recevoir</Text>
              {[
                ['🚀', 'Livraison express', 'Aujourd’hui, en 2 h', 'Payante'],
                ['🚚', 'Livraison standard', 'Demain', '1 500 F'],
                ['🏪', 'Retrait en boutique', 'Dès aujourd’hui', 'Gratuit'],
              ].map(([i, t, d, prix]) => (
                <View key={t} style={st.mode}>
                  <Text style={{ fontSize: 17 }}>{i}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: '600', color: C.encre }}>{t}</Text>
                    <Text style={{ fontSize: 11.5, color: C.gris }}>{d}</Text>
                  </View>
                  <Text style={st.modePrix}>{prix}</Text>
                </View>
              ))}
            </View>

            {/* La description */}
            {!!p.description && (
              <View style={[st.bloc, { gap: 8 }]}>
                <Text style={S.titre}>Description</Text>
                <Text style={{ fontSize: 13.5, color: C.encre, lineHeight: 20 }}>
                  {p.description}
                </Text>
              </View>
            )}
          </>
        )}

        {onglet === 'Caractéristiques' && (
          <View style={[st.bloc, { gap: 0 }]}>
            {[
              ['Catégorie', p.type || '—'],
              ['Disponibilité', epuise ? 'Épuisé' : 'En stock'],
              ['Vendu par', p.vendor?.shop_name || '—'],
              ['Référence', String(p.id).slice(0, 8).toUpperCase()],
            ].map(([k, v], i) => (
              <View key={k} style={[st.carac, i === 0 && { borderTopWidth: 0 }]}>
                <Text style={{ fontSize: 13, color: C.gris, flex: 1 }}>{k}</Text>
                <Text style={{ fontSize: 13, color: C.encre, fontWeight: '600' }}>{v}</Text>
              </View>
            ))}
          </View>
        )}

        {onglet === 'Avis' && (
          <View style={[st.bloc, { gap: 12 }]}>
            {avis.length === 0 ? (
              <Text style={S.sousTitre}>
                Aucun avis pour l’instant. Ils arrivent après une commande livrée —
                on ne demande jamais un avis avant que l’article soit en main.
              </Text>
            ) : avis.map((a) => (
              <View key={a.id} style={{ gap: 3 }}>
                <Text style={{ fontSize: 13, color: C.jaune, fontWeight: '700' }}>
                  {'★'.repeat(a.rating || 0)}
                  <Text style={{ color: C.grisClair }}>{'★'.repeat(5 - (a.rating || 0))}</Text>
                </Text>
                {!!a.comment && (
                  <Text style={{ fontSize: 13, color: C.encre, lineHeight: 18 }}>{a.comment}</Text>
                )}
                <Text style={{ fontSize: 11, color: C.gris }}>
                  {new Date(a.created_at).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Les similaires */}
        {similaires.length > 0 && (
          <View style={{ marginTop: 6 }}>
            <TitreSection titre="Articles similaires" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingHorizontal: E.page }}>
              {similaires.map((s) => <CarteProduit key={s.id} p={s} largeur={158} />)}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* La barre d'achat — fixée, toujours */}
      <View style={st.barreAchat}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 19, fontWeight: '800', color: C.encre }}>{fcfa(p.price)}</Text>
          {!!remise && (
            <Text style={{ fontSize: 11, color: C.vert, fontWeight: '600' }}>
              Tu économises {fcfa(p.prix_barre - p.price)}
            </Text>
          )}
        </View>
        <Pressable onPress={() => !epuise && ouvrirChoix(p)} disabled={epuise}
          style={[S.bouton, { paddingHorizontal: 30 }, epuise && S.boutonEteint]}>
          <Text style={{ fontSize: 15 }}>🛒</Text>
          <Text style={[S.boutonTexte, epuise && S.boutonEteintTexte]}>
            {epuise ? 'Épuisé' : 'Au panier'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  barreHaut: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: E.page, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: C.bord,
  },
  ongletPuce: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: R.puce, backgroundColor: C.champ,
  },
  ongletTexte: { fontSize: 12, color: C.gris },

  galerie: { backgroundColor: '#FFF' },
  points: {
    flexDirection: 'row', justifyContent: 'center', gap: 5,
    paddingBottom: 12, backgroundColor: '#FFF',
  },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.grisClair },
  pointActif: { backgroundColor: C.marine, width: 18 },
  epuise: {
    position: 'absolute', top: 12, left: 12, zIndex: 2,
    backgroundColor: C.gris, borderRadius: R.puce, paddingHorizontal: 12, paddingVertical: 5,
  },
  epuiseTexte: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  bloc: {
    backgroundColor: C.carte, borderRadius: R.carte, padding: 14,
    marginHorizontal: E.page, marginTop: 12, ...OMBRE,
  },
  rubanPromo: {
    alignSelf: 'flex-start', backgroundColor: C.orangePale,
    borderRadius: R.puce, paddingHorizontal: 11, paddingVertical: 5,
  },
  rubanTexte: { fontSize: 11.5, fontWeight: '700', color: C.orange },
  echelonne: {
    alignSelf: 'flex-start', backgroundColor: C.champ,
    borderRadius: R.puce, paddingHorizontal: 11, paddingVertical: 6,
  },
  nom: { fontSize: 15.5, color: C.encre, lineHeight: 21, marginTop: 2 },

  logo: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.champ,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },

  mode: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  modePrix: { fontSize: 12, fontWeight: '700', color: C.orange },

  carac: {
    flexDirection: 'row', paddingVertical: 11,
    borderTopWidth: 1, borderTopColor: C.bord,
  },

  barreAchat: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.carte, borderTopWidth: 1, borderTopColor: C.bord,
    paddingHorizontal: E.page, paddingTop: 12, paddingBottom: 16,
  },
});
