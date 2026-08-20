/* ════════════════════════════════════════════════════════════════════════════
   COMPATIBILITÉ

   Les premiers écrans du relais ont été écrits avant le système de design.
   Plutôt que de les réécrire — ils marchent, ils sont testés, et le comptoir
   est l'écran qu'on ne veut surtout pas casser —, on remappe leurs jetons sur
   ceux de `ui.js`. Un seul système de design, deux vocabulaires le temps que
   les anciens écrans passent au nouveau.
   ════════════════════════════════════════════════════════════════════════════ */
import { C as U, S as SU, R, OMBRE } from './ui';

export const C = {
  fond: U.fond,
  carte: U.carte,
  encre: U.encre,
  gris: U.gris,
  bord: U.bord,
  bordClair: U.bord,
  prix: U.orange,
  vert: U.vert,
  lien: '#007185',
  jaune: U.orange,          // les boutons d'action passent au marine, voir S.bouton
  jauneSombre: U.orangeClair,
  ambre: '#B45309',
};

export const S = {
  carte: { backgroundColor: U.carte, borderRadius: R.carte, padding: 16, ...OMBRE },
  titre: { fontSize: 17, fontWeight: '700', color: U.encre },
  sousTitre: { fontSize: 13, color: U.gris, lineHeight: 19 },
  etiquette: {
    fontSize: 11, fontWeight: '700', color: U.gris,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  champ: SU.champ,
  // L'action principale est marine, comme partout ailleurs dans l'application.
  bouton: SU.bouton,
  boutonTexte: SU.boutonTexte,
  boutonSombre: SU.bouton,
  boutonSombreTexte: SU.boutonTexte,
};
