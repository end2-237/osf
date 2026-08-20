import React from 'react';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { C } from '../lib/ui';

/* ══════════════════════════════════════════════════════════════════════════
   LES ICÔNES

   On passait par des émojis. C'était rapide et c'était faux : un émoji change
   de dessin d'un téléphone à l'autre — le même « 🛒 » est bleu chez Samsung,
   gris chez Xiaomi, et il apporte sa propre couleur au milieu d'une palette
   qu'on a choisie au ton près. Sur une place de marché, ça donne l'air d'un
   prototype.

   Ici, un jeu de traits vectoriels, monochromes, à l'épaisseur constante. Ils
   prennent la couleur qu'on leur donne, ils sont identiques partout, et ils
   s'alignent sur la grille typographique.

   Un seul point d'entrée avec des noms métier plutôt que des noms de
   bibliothèque : le jour où l'on change de jeu, on change ce fichier et rien
   d'autre.
   ══════════════════════════════════════════════════════════════════════════ */

const JEU = {
  // Navigation
  accueil:        [Ionicons, 'home-outline'],
  accueilPlein:   [Ionicons, 'home'],
  catalogue:      [Ionicons, 'grid-outline'],
  cataloguePlein: [Ionicons, 'grid'],
  favori:         [Ionicons, 'heart-outline'],
  favoriPlein:    [Ionicons, 'heart'],
  panier:         [Ionicons, 'cart-outline'],
  panierPlein:    [Ionicons, 'cart'],
  profil:         [Ionicons, 'person-outline'],
  profilPlein:    [Ionicons, 'person'],

  // En-tête
  recherche:      [Ionicons, 'search'],
  cloche:         [Ionicons, 'notifications-outline'],
  casque:         [Ionicons, 'headset-outline'],
  position:       [Ionicons, 'location-outline'],
  retour:         [Ionicons, 'chevron-back'],
  suite:          [Ionicons, 'chevron-forward'],
  fermer:         [Ionicons, 'close'],
  bas:            [Ionicons, 'chevron-down'],
  haut:           [Ionicons, 'chevron-up'],
  filtre:         [Ionicons, 'options-outline'],
  partager:       [Ionicons, 'share-social-outline'],

  // Commerce
  eclair:         [Ionicons, 'flash'],
  etoile:         [Ionicons, 'star'],
  etoileVide:     [Ionicons, 'star-outline'],
  feu:            [MaterialCommunityIcons, 'fire'],
  chrono:         [Ionicons, 'time-outline'],
  etiquette:      [Ionicons, 'pricetag-outline'],
  cadeau:         [Ionicons, 'gift-outline'],
  fusee:          [Ionicons, 'rocket-outline'],
  camion:         [MaterialCommunityIcons, 'truck-fast-outline'],
  boutique:       [Ionicons, 'storefront-outline'],
  colis:          [Ionicons, 'cube-outline'],
  carte:          [Ionicons, 'card-outline'],
  relais:         [MaterialCommunityIcons, 'swap-horizontal-bold'],
  live:           [Ionicons, 'radio-outline'],
  cible:          [Ionicons, 'trophy-outline'],
  personnes:      [Ionicons, 'people-outline'],
  poubelle:       [Ionicons, 'trash-outline'],
  plus:           [Ionicons, 'add'],
  moins:          [Ionicons, 'remove'],
  coche:          [Ionicons, 'checkmark'],
  cocheCercle:    [Ionicons, 'checkmark-circle'],
  telephone:      [Ionicons, 'call'],
  message:        [Ionicons, 'logo-whatsapp'],
  reglages:       [Ionicons, 'settings-outline'],
  couronne:       [MaterialCommunityIcons, 'crown-outline'],
  argent:         [MaterialCommunityIcons, 'cash-multiple'],
  graphique:      [Feather, 'bar-chart-2'],
  sortie:         [Ionicons, 'log-out-outline'],
  info:           [Ionicons, 'information-circle-outline'],
  document:       [Ionicons, 'document-text-outline'],
  cadenas:        [Ionicons, 'lock-closed-outline'],
  aide:           [Ionicons, 'chatbubble-ellipses-outline'],
  cloches:        [Ionicons, 'notifications-off-outline'],
  vide:           [Ionicons, 'file-tray-outline'],
  boussole:       [Ionicons, 'navigate-outline'],
};

export default function Icone({ nom, taille = 20, couleur = C.encre, style }) {
  const entree = JEU[nom];
  if (!entree) return null;
  const [Famille, glyphe] = entree;
  return <Famille name={glyphe} size={taille} color={couleur} style={style} />;
}

/* Les catégories du catalogue. Elles ont besoin d'un dessin reconnaissable à
   trente pixels : c'est le seul endroit où une icône remplace une photo. */
const CATEGORIES = [
  [/tech|informat|ordinat/i, [MaterialCommunityIcons, 'laptop']],
  [/audio|casque|son/i, [Ionicons, 'headset']],
  [/tele|phone|smart/i, [MaterialCommunityIcons, 'cellphone']],
  [/femme|mode|cloth|vetement/i, [MaterialCommunityIcons, 'tshirt-crew-outline']],
  [/shoe|chauss/i, [MaterialCommunityIcons, 'shoe-sneaker']],
  [/beaut|parfum/i, [MaterialCommunityIcons, 'lipstick']],
  [/maison|cuisine|meuble/i, [MaterialCommunityIcons, 'sofa-outline']],
  [/sport|fitness/i, [MaterialCommunityIcons, 'dumbbell']],
  [/bebe|bébé|enfant/i, [MaterialCommunityIcons, 'teddy-bear']],
  [/auto|voiture/i, [MaterialCommunityIcons, 'car-outline']],
  [/sant|pharm|bien/i, [MaterialCommunityIcons, 'medical-bag']],
  [/nutrition|aliment|epicerie/i, [MaterialCommunityIcons, 'food-apple-outline']],
  [/restaur/i, [MaterialCommunityIcons, 'silverware-fork-knife']],
  [/accessoir|sac/i, [MaterialCommunityIcons, 'bag-personal-outline']],
  [/jeu|gamer|console/i, [Ionicons, 'game-controller-outline']],
  [/photo|camera|drone/i, [Ionicons, 'camera-outline']],
];

export function IconeCategorie({ nom, taille = 30, couleur = C.marine }) {
  const trouve = CATEGORIES.find(([r]) => r.test(nom || ''));
  const [Famille, glyphe] = trouve ? trouve[1] : [Ionicons, 'cube-outline'];
  return <Famille name={glyphe} size={taille} color={couleur} />;
}
