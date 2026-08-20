import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Image, Pressable, Animated, Easing, Dimensions,
  StyleSheet, ScrollView,
} from 'react-native';
import { C, R, S, fcfa, pourcent } from '../lib/ui';
import { useBoutique } from '../lib/boutique';
import Icone from './Icone';

/* ══════════════════════════════════════════════════════════════════════════
   LA FEUILLE DE CHOIX

   L'interaction la plus travaillée de la référence, reprise geste pour geste.

   Le bouton rond d'une carte n'ajoute pas au panier : il ouvre cette feuille.
   Elle monte du bas en 280 ms, le fond s'assombrit, une poignée grise dit
   qu'on peut la refermer d'un glissement. Elle n'occupe jamais tout l'écran —
   la grille reste visible derrière, et c'est ce qui dit qu'on n'a pas quitté
   la page.

   LA RÈGLE QUI COMPTE : le bouton naît éteint. Il reste gris tant que toutes
   les variantes n'ont pas été choisies, et devient marine plein ensuite. On
   ne laisse jamais ajouter une déclinaison que personne n'a choisie — c'est
   la première cause de retour, et elle coûte un aller-retour au commerçant.

   À la validation, la feuille redescend et la pastille du panier
   s'incrémente. Pas de message de confirmation : la pastille EST la
   confirmation.
   ══════════════════════════════════════════════════════════════════════════ */

const H = Dimensions.get('window').height;

export default function FeuilleChoix() {
  const { choix, fermerChoix, ajouter } = useBoutique();
  const [couleur, setCouleur] = useState(null);
  const [taille, setTaille] = useState(null);

  const glisse = useRef(new Animated.Value(H)).current;
  const voile = useRef(new Animated.Value(0)).current;

  const couleurs = choix?.couleurs || [];
  const tailles = choix?.tailles || [];
  const besoinCouleur = couleurs.length > 0;
  const besoinTaille = tailles.length > 0;
  const complet = (!besoinCouleur || couleur) && (!besoinTaille || taille);

  useEffect(() => {
    if (choix) {
      setCouleur(null); setTaille(null);
      Animated.parallel([
        Animated.timing(glisse, {
          toValue: 0, duration: 280,
          easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true,
        }),
        Animated.timing(voile, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    }
  }, [choix]);   // eslint-disable-line react-hooks/exhaustive-deps

  const fermer = () => {
    Animated.parallel([
      Animated.timing(glisse, {
        toValue: H, duration: 220,
        easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(voile, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => fermerChoix());
  };

  const valider = () => {
    ajouter({
      id: choix.id, name: choix.name, price: choix.price, img: choix.img,
      prix_barre: choix.prix_barre, vendor_id: choix.vendor_id, type: choix.type,
      couleur: couleur?.nom || null, taille: taille || null,
    });
    fermer();
  };

  if (!choix) return null;

  const remise = pourcent(choix.prix_barre, choix.price);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: voile }]}>
        <Pressable style={[StyleSheet.absoluteFill, st.voile]} onPress={fermer} />
      </Animated.View>

      <Animated.View style={[st.feuille, { transform: [{ translateY: glisse }] }]}>
        <Pressable onPress={fermer} style={st.zonePoignee} hitSlop={10}>
          <View style={st.poignee} />
        </Pressable>

        <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: 4 }}>
          {/* Le résumé : il doit suffire à reconnaître l'article sans
              remonter à la fiche. */}
          <View style={st.resume}>
            <Image source={{ uri: choix.img }} resizeMode="contain" style={st.vignette} />
            <View style={{ flex: 1 }}>
              {!!choix.meilleur_prix && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <Icone nom="etoile" taille={12} couleur={C.orange} />
                  <Text style={st.urgence}>Meilleur prix</Text>
                </View>
              )}
              <Text style={st.nom} numberOfLines={2}>{choix.name}</Text>
              {choix.price >= 20000 && (
                <View style={st.echelonne}>
                  <Text style={st.echelonneTexte}>
                    dès <Text style={{ fontWeight: '700', color: C.encre }}>
                      {fcfa(Math.round(choix.price / 12))}</Text> × 12 mois
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 6 }}>
                <Text style={st.prix}>{fcfa(choix.price)}</Text>
                {!!remise && (
                  <>
                    <Text style={S.prixBarre}>{fcfa(choix.prix_barre)}</Text>
                    <Text style={S.remise}>{remise}</Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {besoinCouleur && (
            <View style={st.bloc}>
              <Text style={st.libelle}>
                Couleur : <Text style={{ fontWeight: '400', color: C.gris }}>
                  {couleur?.nom || 'à choisir'}
                </Text>
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
                {couleurs.map((c) => (
                  <Pressable key={c.nom} onPress={() => setCouleur(c)}
                    style={[st.swatch, couleur?.nom === c.nom && st.choisi]}>
                    {c.img
                      ? <Image source={{ uri: c.img }} style={st.swatchImg} resizeMode="cover" />
                      : <View style={[st.swatchImg, { backgroundColor: c.code || C.champ }]} />}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {besoinTaille && (
            <View style={st.bloc}>
              <Text style={st.libelle}>
                {choix.libelle_taille || 'Taille'} : <Text style={{ fontWeight: '400', color: C.gris }}>
                  {taille || 'à choisir'}
                </Text>
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {tailles.map((t) => (
                  <Pressable key={t} onPress={() => setTaille(t)}
                    style={[st.puce, taille === t && st.choisi]}>
                    <Text style={[st.puceTexte, taille === t && { color: C.encre, fontWeight: '700' }]}>
                      {t}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {!besoinCouleur && !besoinTaille && (
            <Text style={[S.sousTitre, { paddingHorizontal: 16, paddingBottom: 4 }]}>
              Cet article n’a qu’une seule déclinaison.
            </Text>
          )}
        </ScrollView>

        <View style={st.pied}>
          <Pressable onPress={valider} disabled={!complet}
            style={[S.bouton, !complet && S.boutonEteint]}>
            <Icone nom="panier" taille={18} couleur={complet ? '#FFF' : C.grisClair} />
            <Text style={[S.boutonTexte, !complet && S.boutonEteintTexte]}>
              Ajouter au panier
            </Text>
          </Pressable>
          {!complet && (
            <Text style={st.aide}>
              {besoinCouleur && !couleur ? 'Choisis une couleur' : 'Choisis une taille'} pour continuer.
            </Text>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  voile: { backgroundColor: 'rgba(20,27,77,0.45)' },

  feuille: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    maxHeight: H * 0.82,
    backgroundColor: C.carte,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },

  zonePoignee: { alignItems: 'center', paddingVertical: 10 },
  poignee: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.grisClair },

  resume: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  vignette: { width: 76, height: 96, borderRadius: R.vignette, backgroundColor: '#FFF' },
  urgence: { fontSize: 11, fontWeight: '700', color: C.orange, marginBottom: 2 },
  nom: { fontSize: 13, color: C.encre, lineHeight: 17 },
  echelonne: {
    alignSelf: 'flex-start', marginTop: 5, backgroundColor: C.champ,
    borderRadius: R.puce, paddingHorizontal: 8, paddingVertical: 3,
  },
  echelonneTexte: { fontSize: 11, color: C.gris },
  prix: { fontSize: 21, fontWeight: '800', color: C.encre },

  bloc: { paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  libelle: { fontSize: 14, fontWeight: '700', color: C.encre },

  swatch: {
    width: 52, height: 52, borderRadius: R.vignette,
    borderWidth: 2, borderColor: 'transparent', padding: 2,
    backgroundColor: C.champ,
  },
  swatchImg: { width: '100%', height: '100%', borderRadius: 8 },

  puce: {
    borderWidth: 1.5, borderColor: C.bord, borderRadius: R.puce,
    paddingHorizontal: 16, paddingVertical: 9, backgroundColor: C.carte,
  },
  puceTexte: { fontSize: 13, color: C.gris },

  // Le bord orange est le seul signe de sélection. Un fond coloré ferait
  // disparaître la photo de la déclinaison, qui est justement ce qu'on choisit.
  choisi: { borderColor: C.orange },

  pied: {
    padding: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: C.bord,
    backgroundColor: C.carte,
  },
  aide: { fontSize: 11, color: C.gris, textAlign: 'center', marginTop: 7 },
});
