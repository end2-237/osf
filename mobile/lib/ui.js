import { StyleSheet, Platform } from 'react-native';

/* ══════════════════════════════════════════════════════════════════════════
   LES JETONS

   Tirés de la référence image par image. Trois valeurs décident du rendu et
   ce sont celles qu'on rate d'habitude :

   · le fond de page n'est PAS blanc mais lavande très pâle. C'est lui qui
     fait ressortir les cartes sans ombre lourde ; sur blanc la page paraît
     plate ;
   · l'ombre est presque invisible — 6 % d'opacité, jamais de gris sale ;
   · le rayon des cartes est de 16, celui des vignettes de 12. L'écart entre
     les deux est ce qui donne la profondeur.
   ══════════════════════════════════════════════════════════════════════════ */

export const C = {
  marine: '#141B4D',
  marineClair: '#232B63',
  orange: '#FF6B00',
  orangeClair: '#FF8A3D',
  orangePale: '#FFF1E7',

  fond: '#F2F1FA',
  carte: '#FFFFFF',
  champ: '#F5F5FA',

  encre: '#1A1A1A',
  gris: '#8A8F98',
  grisClair: '#C7CBD1',
  bord: '#ECECF3',

  vert: '#00A651',
  rouge: '#E53935',
  jaune: '#FFB800',
};

export const R = { carte: 16, vignette: 12, puce: 999, champ: 12 };
export const E = { page: 12, gouttiere: 10, bloc: 14 };

export const OMBRE = Platform.select({
  ios: {
    shadowColor: '#141B4D',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
  },
  android: { elevation: 2 },
  default: {},
});

/** « 299 990 F » — l'espace fine insécable est ce qui rend un prix lisible. */
export const fcfa = (n) =>
  `${Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/ |\s/g, ' ')} F`;

export const pourcent = (avant, apres) => {
  const a = Number(avant) || 0, b = Number(apres) || 0;
  if (!a || b >= a) return null;
  return `-${Math.round((1 - b / a) * 100)}%`;
};

export const S = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.fond },

  carte: { backgroundColor: C.carte, borderRadius: R.carte, ...OMBRE },

  titreSection: { fontSize: 17, fontWeight: '700', color: C.encre },
  lienSection: { fontSize: 13, fontWeight: '600', color: C.orange },

  titre: { fontSize: 17, fontWeight: '700', color: C.encre },
  sousTitre: { fontSize: 13, color: C.gris, lineHeight: 19 },
  etiquette: {
    fontSize: 11, fontWeight: '700', color: C.gris,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },

  prix: { fontSize: 20, fontWeight: '800', color: C.encre },
  prixBarre: { fontSize: 12, color: C.gris, textDecorationLine: 'line-through' },
  remise: { fontSize: 12, fontWeight: '700', color: C.orange },

  champ: {
    backgroundColor: C.champ, borderWidth: 1, borderColor: C.bord,
    borderRadius: R.champ, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: C.encre,
  },

  // Le bouton principal est marine plein. L'orange est un accent, jamais une
  // action : mis sur un bouton large il écrase tout le reste de l'écran.
  bouton: {
    backgroundColor: C.marine, borderRadius: R.puce,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
  },
  boutonTexte: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  boutonEteint: { backgroundColor: '#EDEDF2' },
  boutonEteintTexte: { color: C.grisClair },

  boutonOrange: {
    backgroundColor: C.orange, borderRadius: R.puce,
    paddingVertical: 12, alignItems: 'center',
  },
  boutonFin: {
    borderWidth: 1, borderColor: C.bord, borderRadius: R.puce,
    paddingVertical: 12, alignItems: 'center', backgroundColor: C.carte,
  },
  boutonFinTexte: { fontSize: 14, fontWeight: '600', color: C.encre },
});

/* Les badges de la carte produit. Un seul s'affiche, dans cet ordre. */
export const BADGES = {
  sale: { texte: 'SALE', fond: C.orange, encre: '#FFF' },
  neuf: { texte: '🔥 NEW', fond: C.orange, encre: '#FFF' },
  echelonne: { texte: '0-0-24', fond: '#FFF', encre: C.encre },
};
