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
import { C, R, S, E, OMBRE, fcfa, pourcent , useLargeur } from '../../lib/ui';
import Icone from '../../components/Icone';


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

const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://buyticle.com';

const ONGLETS = ['Aperçu', 'Caractéristiques'];

/* Le compte à rebours de la promotion. Il descend seul, et c'est tout son
   objet : un pourcentage ne presse personne, une heure qui s'épuise oui. Sans
   date de fin en base on ne l'affiche pas — inventer une échéance qui n'existe
   pas est un mensonge qui se découvre au rechargement de la page. */
function useRebours(fin) {
  const [reste, setReste] = useState(() => (fin ? Math.max(0, new Date(fin) - Date.now()) : 0));
  useEffect(() => {
    if (!fin) return;
    const t = setInterval(() => setReste(Math.max(0, new Date(fin) - Date.now())), 1000);
    return () => clearInterval(t);
  }, [fin]);
  if (!fin || reste <= 0) return null;
  const s = Math.floor(reste / 1000);
  const deux = (n) => String(n).padStart(2, '0');
  return `${deux(Math.floor(s / 3600))}:${deux(Math.floor((s % 3600) / 60))}:${deux(s % 60)}`;
}

export default function Produit() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const L = useLargeur();
  const { ouvrirChoix, basculerFavori, estFavori } = useBoutique();

  const [p, setP] = useState(null);
  const [charge, setCharge] = useState(true);
  const [photo, setPhoto] = useState(0);
  const [onglet, setOnglet] = useState('Aperçu');
  const [avis, setAvis] = useState([]);
  const [similaires, setSim] = useState([]);

  // Le crochet vit AVANT les retours anticipés du chargement : appelé plus
  // bas, il ne serait pas exécuté au même rang d'un rendu à l'autre.
  const rebours = useRebours(p?.fin_promo);

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
        <Vide icone="recherche" titre="Article introuvable"
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

  // Partager un article est la façon dont la plupart des ventes se décident
  // ici : on envoie le lien à quelqu'un sur WhatsApp et on demande son avis.
  const partager = () => Share.share({
    message: `${p.name} — ${fcfa(p.price)} sur Buyticle\n${SITE}/product/${p.id}`,
  }).catch(() => {});

  return (
    <View style={S.page}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.carte }}>
        <View style={st.barreHaut}>
          <Pressable hitSlop={10} onPress={() => router.back()}>
            <Icone nom="retour" taille={25} couleur={C.encre} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {ONGLETS.map((o) => (
              <Pressable key={o} onPress={() => setOnglet(o)}
                style={[st.ongletPuce, onglet === o && { backgroundColor: C.marine }]}>
                <Text style={[st.ongletTexte, onglet === o && { color: '#FFF', fontWeight: '700' }]}>
                  {o}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flex: 1 }} />
          <Pressable hitSlop={8} onPress={() => router.push('/recherche')}>
            <Icone nom="recherche" taille={20} couleur={C.encre} />
          </Pressable>
          <Pressable hitSlop={8} onPress={partager}>
            <Icone nom="partager" taille={20} couleur={C.encre} />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => basculerFavori(p)}>
            <Icone nom={estFavori(p.id) ? 'favoriPlein' : 'favori'} taille={21}
              couleur={estFavori(p.id) ? C.rouge : C.encre} />
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
          {/* La ligne de service sous l'image : ce qu'on peut FAIRE de la
              photo. Dans la référence elle porte la vidéo à gauche, les points
              au milieu et l'agrandissement à droite — trois affordances sur une
              seule ligne, sans rien voler à l'image. */}
          <View style={st.sousGalerie}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, width: 78 }}>
              {!!p.video_url && (
                <>
                  <Icone nom="lecture" taille={13} couleur={C.gris} />
                  <Text style={st.sousGalerieTexte}>Vidéo</Text>
                </>
              )}
            </View>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
              {photos.length > 1 && photos.map((_, i) => (
                <View key={i} style={[st.point, i === photo && st.pointActif]} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, width: 78, justifyContent: 'flex-end' }}>
              <Icone nom="agrandir" taille={13} couleur={C.gris} />
              <Text style={st.sousGalerieTexte}>Agrandir</Text>
            </View>
          </View>
        </View>

        {/* Le prix, dans son cadre orange quand il baisse. Le cadre n'est pas
            décoratif : c'est lui qui sépare un prix promotionnel d'un prix
            ordinaire, et sans lui les deux nombres se ressemblent. */}
        <View style={{ paddingHorizontal: E.page, marginTop: 12 }}>
          <View style={[st.cadrePrix, !remise && { borderColor: C.bord }]}>
            {!!remise && (
              <View style={st.bandePromo}>
                <Icone nom="feu" taille={12} couleur="#FFF" />
                <Text style={st.bandePromoTexte}>Promotion</Text>
                {!!rebours && (
                  <>
                    <View style={st.bandeSep} />
                    <Text style={st.bandePromoTexte}>Se termine dans {rebours}</Text>
                  </>
                )}
              </View>
            )}
            <View style={st.cadrePrixCorps}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: C.encre }}>{fcfa(p.price)}</Text>
              {!!remise && (
                <>
                  <Text style={[S.prixBarre, { fontSize: 14 }]}>{fcfa(p.prix_barre)}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: C.rouge }}>{remise}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Le bonus et l'échelonnement, sur une ligne — comme la référence */}
        <View style={st.ligneBonus}>
          <View style={st.bonus}>
            <Text style={st.bonusTexte}>
              +{Math.round(p.price / 100).toLocaleString('fr-FR')}
            </Text>
            <View style={st.bonusPastille}><Text style={st.bonusPastilleTexte}>B</Text></View>
          </View>
          {p.price >= 20000 && (
            <View style={st.echelonne}>
              <Text style={{ fontSize: 12, color: C.gris }}>
                dès <Text style={{ fontWeight: '700', color: C.encre }}>
                  {fcfa(Math.round(p.price / 12))}</Text> × 12 mois
              </Text>
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: E.page, marginTop: 8, gap: 6 }}>
          <Text style={st.nom}>{p.name}</Text>
          {!!noteMoy && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.encre }}>
                {noteMoy.toFixed(1).replace('.', ',')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 1 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Icone key={i} nom={i < Math.round(noteMoy) ? 'etoile' : 'etoileVide'} taille={11}
                    couleur={i < Math.round(noteMoy) ? C.jaune : C.grisClair} />
                ))}
              </View>
              <Text style={{ fontSize: 12, color: C.gris }}>({avis.length} avis)</Text>
            </View>
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
                      : <Icone nom="boutique" taille={19} couleur={C.gris} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '700', color: C.encre }}>
                      {p.vendor.shop_name}
                    </Text>
                    <Text style={{ fontSize: 12, color: C.gris }}>
                      {p.vendor.city || 'Douala'} · Voir la boutique
                    </Text>
                  </View>
                  <Icone nom="suite" taille={18} couleur={C.grisClair} />
                </View>
              </Pressable>
            )}

            {/* Les modes de réception */}
            <View style={[st.bloc, { gap: 10 }]}>
              <Text style={S.titre}>Comment le recevoir</Text>
              {[
                ['fusee', 'Livraison express', 'Aujourd’hui, en 2 h', 'Payante'],
                ['camion', 'Livraison standard', 'Demain', '1 500 F'],
                ['boutique', 'Retrait en boutique', 'Dès aujourd’hui', 'Gratuit'],
              ].map(([i, t, d, prix]) => (
                <View key={t} style={st.mode}>
                  <Icone nom={i} taille={18} couleur={C.orange} />
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

        {onglet === 'Aperçu' && (
          <View style={[st.bloc, { gap: 12 }]}>
            <Text style={S.titre}>Les avis</Text>
            {avis.length === 0 ? (
              <Text style={S.sousTitre}>
                Aucun avis pour l’instant. Ils arrivent après une commande livrée —
                on ne demande jamais un avis avant que l’article soit en main.
              </Text>
            ) : avis.map((a) => (
              <View key={a.id} style={{ gap: 3 }}>
                <View style={{ flexDirection: 'row', gap: 2 }}>
                  {[0,1,2,3,4].map((i) => (
                    <Icone key={i} nom={i < (a.rating || 0) ? 'etoile' : 'etoileVide'} taille={13}
                      couleur={i < (a.rating || 0) ? C.jaune : C.grisClair} />
                  ))}
                </View>
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
          {!!remise && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={S.prixBarre}>{fcfa(p.prix_barre)}</Text>
              <Text style={{ fontSize: 12, fontWeight: '800', color: C.rouge }}>{remise}</Text>
            </View>
          )}
          <Text style={{ fontSize: 20, fontWeight: '800', color: C.encre }}>{fcfa(p.price)}</Text>
        </View>
        <Pressable onPress={() => !epuise && ouvrirChoix(p)} disabled={epuise}
          style={[S.bouton, { flex: 1.15 }, epuise && S.boutonEteint]}>
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
  sousGalerie: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: E.page, paddingBottom: 11, paddingTop: 2,
    backgroundColor: '#FFF',
  },
  sousGalerieTexte: { fontSize: 11.5, color: C.gris },

  cadrePrix: {
    borderWidth: 1.5, borderColor: C.orange, borderRadius: R.carte,
    overflow: 'hidden', backgroundColor: C.carte,
  },
  bandePromo: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.orange, paddingHorizontal: 11, paddingVertical: 5,
  },
  bandePromoTexte: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  bandeSep: { width: 1, height: 11, backgroundColor: 'rgba(255,255,255,0.45)' },
  cadrePrixCorps: {
    flexDirection: 'row', alignItems: 'baseline', gap: 9,
    paddingHorizontal: 13, paddingVertical: 11, flexWrap: 'wrap',
  },

  ligneBonus: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: E.page, marginTop: 9,
  },
  bonus: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bonusTexte: { fontSize: 13, fontWeight: '800', color: C.orange },
  bonusPastille: {
    width: 15, height: 15, borderRadius: 8, backgroundColor: C.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  bonusPastilleTexte: { fontSize: 9, fontWeight: '800', color: '#FFF' },
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
