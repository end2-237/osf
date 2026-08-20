import React, { memo } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { C, R, S, E, OMBRE, fcfa, pourcent } from '../lib/ui';
import { useBoutique } from '../lib/boutique';
import Icone from './Icone';

/* ══════════════════════════════════════════════════════════════════════════
   LA CARTE PRODUIT

   L'élément le plus réutilisé de toute l'application : accueil, catalogue,
   recherche, favoris, suggestions du relais. Onze emplacements, et aucun
   n'est décoratif.

   Celui qui compte le plus et qu'on oublie toujours, c'est la LIGNE
   D'URGENCE — « il en reste 3 », « meilleur prix », un compte à rebours.
   C'est elle qui sépare une grille qu'on parcourt d'une grille qui vend.

   Le bouton rond n'ajoute pas au panier : il ouvre la feuille de choix.
   Ajouter sans avoir choisi la déclinaison est la première cause de retour.
   ══════════════════════════════════════════════════════════════════════════ */

const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
     <rect width="200" height="200" fill="#F5F5FA"/>
     <path d="M62 132h76M72 108l21-25 17 20 12-12 17 17" stroke="#C7CBD1"
           stroke-width="6" fill="none" stroke-linecap="round"/></svg>`);

/** L'urgence, dans l'ordre de force. Une seule ligne s'affiche. */
function urgence(p) {
  if (p.fin_promo) return { icone: 'chrono', texte: p.fin_promo };
  if (p.stock != null && p.stock > 0 && p.stock <= 5) {
    return { icone: 'eclair', texte: `Il en reste ${p.stock}` };
  }
  if (p.meilleur_prix) return { icone: 'etoile', texte: 'Meilleur prix' };
  if (p.populaire) return { icone: 'feu', texte: 'Ça part vite' };
  return null;
}

function badge(p) {
  if (p.status === 'Épuisé') return { t: 'ÉPUISÉ', fond: C.gris };
  if (p.promo) return { t: 'SALE', fond: C.orange };
  if (p.nouveau) return { t: 'NEW', fond: C.orange };
  return { t: '0-0-24', fond: '#FFF', encre: C.encre };
}

function Etoiles({ note = 0, avis = 0 }) {
  if (!note) return null;
  const pleines = Math.round(note);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: C.jaune }}>
        {Number(note).toFixed(1)}
      </Text>
      <View style={{ flexDirection: 'row', gap: 1 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Icone key={i} nom={i < pleines ? 'etoile' : 'etoileVide'} taille={11}
            couleur={i < pleines ? C.jaune : C.grisClair} />
        ))}
      </View>
      {!!avis && <Text style={{ fontSize: 11, color: C.gris }}>({avis})</Text>}
    </View>
  );
}

function CarteProduit({ p, horizontal = false, largeur }) {
  const router = useRouter();
  const { basculerFavori, estFavori, ouvrirChoix } = useBoutique();

  const fav = estFavori(p.id);
  const u = urgence(p);
  const b = badge(p);
  const remise = pourcent(p.prix_barre, p.price);
  const epuise = p.status === 'Épuisé';

  const Image_ = (
    <View style={[st.zoneImage, horizontal && st.zoneImageH]}>
      <Image source={{ uri: p.img || PLACEHOLDER }} resizeMode="contain"
        style={{ width: '100%', height: '100%' }} />
      {/* Les points ne sont pas décoratifs : ils disent qu'il y a d'autres
          photos sans obliger à ouvrir la fiche. */}
      {p.nb_photos > 1 && (
        <View style={st.points}>
          {Array.from({ length: Math.min(p.nb_photos, 5) }).map((_, i) => (
            <View key={i} style={[st.point, i === 0 && st.pointActif]} />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <Pressable
      onPress={() => router.push(`/produit/${p.id}`)}
      style={[st.carte, horizontal ? st.carteH : st.carteV, !!largeur && { width: largeur }]}>

      <View style={horizontal ? { flexDirection: 'row', gap: 12 } : undefined}>
        {/* Le badge est posé SUR l'image dans les deux orientations. Dans la
            référence il ne quitte jamais la vignette : c'est ce qui permet de
            balayer une liste et de repérer les SALE sans lire un mot. */}
        <View style={{ position: 'relative' }}>
          {Image_}
          <View style={[st.badge, { backgroundColor: b.fond },
            b.encre && { borderWidth: 1, borderColor: C.bord }]}>
            <Text style={[st.badgeTexte, b.encre && { color: b.encre }]}>{b.t}</Text>
          </View>
          {!horizontal && (
            <Pressable hitSlop={8} onPress={() => basculerFavori(p)} style={st.coeur}>
              <Icone nom={fav ? 'favoriPlein' : 'favori'} taille={19}
                couleur={fav ? C.rouge : C.grisClair} />
            </Pressable>
          )}
        </View>

        <View style={horizontal ? { flex: 1 } : { marginTop: 8 }}>
          {!!u && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <Icone nom={u.icone} taille={12} couleur={C.orange} />
              <Text style={st.urgence} numberOfLines={1}>{u.texte}</Text>
            </View>
          )}

          <Text style={st.titre} numberOfLines={2}>{p.name}</Text>

          <View style={{ marginTop: 3 }}>
            <Etoiles note={p.note} avis={p.nb_avis} />
          </View>

          {/* Le paiement échelonné se lit avant le prix chez beaucoup de
              clients : c'est lui qui rend l'article atteignable. */}
          {p.price >= 20000 && (
            <View style={st.echelonne}>
              <Text style={st.echelonneTexte}>
                dès <Text style={{ fontWeight: '700', color: C.encre }}>
                  {fcfa(Math.round(p.price / 12))}
                </Text> × 12 mois
              </Text>
            </View>
          )}

          <View style={st.ligneP4rix}>
            <View style={{ flex: 1 }}>
              <Text style={st.prix}>{fcfa(p.price)}</Text>
              {!!remise && (
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <Text style={S.prixBarre}>{fcfa(p.prix_barre)}</Text>
                  <Text style={S.remise}>{remise}</Text>
                </View>
              )}
            </View>

            {horizontal && (
              <Pressable hitSlop={6} onPress={() => basculerFavori(p)}
                style={{ paddingHorizontal: 6 }}>
                <Icone nom={fav ? 'favoriPlein' : 'favori'} taille={21}
                  couleur={fav ? C.rouge : C.grisClair} />
              </Pressable>
            )}

            <Pressable
              onPress={() => !epuise && ouvrirChoix(p)}
              style={[st.panier, epuise && { backgroundColor: C.grisClair }]}>
              <Icone nom="panier" taille={18} couleur="#FFF" />
            </Pressable>
          </View>

          {!!p.livraison && (
            <Text style={st.livraison} numberOfLines={1}>{p.livraison}</Text>
          )}
          {!!p.retrait && (
            <Text style={st.retrait} numberOfLines={1}>{p.retrait}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  carte: { backgroundColor: C.carte, borderRadius: R.carte, padding: 10, ...OMBRE },
  carteV: { flex: 1 },
  carteH: {},

  zoneImage: {
    width: '100%', aspectRatio: 1, backgroundColor: '#FFF',
    borderRadius: R.vignette, overflow: 'hidden',
  },
  zoneImageH: { width: 108, aspectRatio: 1 },

  badge: {
    position: 'absolute', top: 6, left: 6, borderRadius: R.puce,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeTexte: { fontSize: 10, fontWeight: '700', color: '#FFF' },

  coeur: { position: 'absolute', top: 4, right: 4, padding: 4 },

  points: {
    position: 'absolute', bottom: 6, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 3,
  },
  point: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.grisClair },
  pointActif: { backgroundColor: C.marine, width: 10 },

  urgence: { fontSize: 11, fontWeight: '700', color: C.orange },
  titre: { fontSize: 13, color: C.encre, lineHeight: 17, minHeight: 34 },

  echelonne: {
    alignSelf: 'flex-start', marginTop: 5,
    backgroundColor: C.champ, borderRadius: R.puce,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  echelonneTexte: { fontSize: 11, color: C.gris },

  ligneP4rix: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  prix: { fontSize: 18, fontWeight: '800', color: C.encre },

  panier: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: C.marine,
    alignItems: 'center', justifyContent: 'center',
  },

  livraison: { fontSize: 11, color: C.vert, marginTop: 5, fontWeight: '600' },
  retrait: { fontSize: 11, color: C.gris, marginTop: 1 },
});

export default memo(CarteProduit);
