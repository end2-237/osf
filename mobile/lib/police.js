import React from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';

/* ══════════════════════════════════════════════════════════════════════════
   LA POLICE

   Inter, en cinq graisses. C'est la néo-grotesque de la référence : hauteur
   d'x généreuse, chiffres à chasse égale, et elle tient à onze pixels sur un
   écran d'entrée de gamme — c'est là que la plupart des polices d'affichage
   s'effondrent, et un prix illisible est un prix qui ne se lit pas.

   Le point délicat est la GRAISSE. En React Native, `fontWeight` ne suffit pas
   avec une police chargée par fichier : il faut nommer la variante exacte.
   Écrire `fontFamily: 'Inter_700Bold'` dans chaque style serait invivable et
   se désynchroniserait au premier oubli. On traduit donc la graisse en nom de
   fichier une fois, à la racine, en enveloppant `Text` et `TextInput`.

   La première version modifiait l'élément renvoyé en place. C'était faux : un
   élément React n'est pas fait pour être remanié après coup, et le rendu web
   s'en étranglait. On passe par `cloneElement`, qui est la porte prévue.

   `allowFontScaling` est coupé : un client qui a doublé la taille du texte
   dans Android casserait chaque grille de prix, et le prix est précisément ce
   qu'il ne faut pas casser.
   ══════════════════════════════════════════════════════════════════════════ */

const POLICES = {
  '100': 'Inter_300Light',
  '200': 'Inter_300Light',
  '300': 'Inter_300Light',
  '400': 'Inter_400Regular',
  'normal': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  'bold': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_800ExtraBold',
};

function familleDe(style) {
  // `flatten` aplatit les tableaux imbriqués et les styles enregistrés : c'est
  // la seule façon fiable de lire la graisse réellement appliquée.
  const plat = StyleSheet.flatten(style) || {};
  return POLICES[String(plat.fontWeight ?? '400')] || POLICES['400'];
}

let pose = false;

export function poserLaPolice() {
  if (pose) return;
  pose = true;

  for (const Composant of [Text, TextInput]) {
    const rendu = Composant.render;
    if (!rendu) continue;
    Composant.render = function (...args) {
      const element = rendu.apply(this, args);
      // Un OBJET aplati, jamais un tableau : le rendu web ne sait pas
      // résoudre un tableau à cet endroit et rejette la page entière.
      // La famille vient en premier — un écran qui veut imposer une autre
      // police garde la main.
      const style = StyleSheet.flatten([
        { fontFamily: familleDe(element.props.style) },
        element.props.style,
      ]);
      return React.cloneElement(element, { allowFontScaling: false, style });
    };
  }
}
