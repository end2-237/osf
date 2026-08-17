/* ════════════════════════════════════════════════════════════════════════════
   UN CODE QR, SANS DÉPENDANCE ET SANS SERVEUR

   L'affiche du comptoir est le seul canal d'acquisition du modèle. Elle doit
   s'imprimer chez un commerçant de Mboppi, sur l'imprimante d'un cybercafé,
   sans que rien d'extérieur ne soit sollicité au moment de l'impression.

   D'où ce fichier plutôt qu'une bibliothèque ou une API d'images : appeler un
   service tiers ferait dépendre l'affiche d'un domaine que nous ne contrôlons
   pas, lui enverrait le code d'affiliation de chaque boutique, et donnerait un
   PNG flou dès qu'on l'agrandit. Ici le résultat est un tracé vectoriel : net
   à n'importe quelle taille, du ticket de caisse à l'affiche A3.

   Encodage en mode octet, correction d'erreurs de niveau M — environ quinze
   pour cent du symbole peut être sali, plié ou décollé sans que le téléphone
   cesse de le lire. C'est le niveau qui convient à un autocollant posé sur un
   comptoir. Versions 1 à 10, soit 213 octets : une adresse de relais en fait
   une quarantaine.

   Référence : ISO/IEC 18004.
   ════════════════════════════════════════════════════════════════════════════ */

/* ── Le corps fini GF(256) ───────────────────────────────────────────────────
   Toute l'arithmétique de Reed-Solomon vit ici. Polynôme primitif 0x11D, celui
   qu'impose la norme. On tabule une fois pour toutes, au chargement du module,
   pour que la multiplication devienne une addition d'exposants.
   ──────────────────────────────────────────────────────────────────────────── */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  // La deuxième moitié évite un modulo dans la boucle chaude.
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Le polynôme générateur de degré n : ∏ (x − α^i), i de 0 à n−1. */
function generateur(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const r = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      r[j] ^= g[j];                       // × x
      r[j + 1] ^= mul(g[j], EXP[i]);      // × α^i
    }
    g = r;
  }
  return g;
}

/** Les n mots de correction d'un bloc de données : le reste de la division. */
function correction(donnees, n) {
  const g = generateur(n);
  const r = new Array(donnees.length + n).fill(0);
  for (let i = 0; i < donnees.length; i++) r[i] = donnees[i];
  for (let i = 0; i < donnees.length; i++) {
    const c = r[i];
    if (c === 0) continue;
    for (let j = 0; j < g.length; j++) r[i + j] ^= mul(g[j], c);
  }
  return r.slice(donnees.length);
}

/* ── Les tables de la norme ──────────────────────────────────────────────────
   Pour chaque version, au niveau M :
     [ mots de correction par bloc, blocs du groupe 1, données par bloc du
       groupe 1, blocs du groupe 2, données par bloc du groupe 2 ]
   ──────────────────────────────────────────────────────────────────────────── */

const BLOCS = [
  null,
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
];

/** Les centres des motifs d'alignement, par version. */
const ALIGNEMENTS = [
  null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
];

const REMPLISSAGE = [0xec, 0x11];   // les deux octets de bourrage alternés
const NIVEAU_M = 0b00;              // les deux bits du niveau M dans le format

/* ── Le flux binaire ─────────────────────────────────────────────────────── */

/** Combien d'octets de données tient la version v, niveau M. */
const capacite = (v) => {
  const [, g1, d1, g2, d2] = BLOCS[v];
  return g1 * d1 + g2 * d2;
};

/** La plus petite version qui contient ce texte, ou 0 si aucune. */
function choisirVersion(nOctets) {
  for (let v = 1; v <= 10; v++) {
    const enTete = 4 + (v < 10 ? 8 : 16);
    if (enTete + 8 * nOctets <= capacite(v) * 8) return v;
  }
  return 0;
}

function motsDeDonnees(octets, version) {
  const total = capacite(version);
  const bits = [];
  const pousser = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };

  pousser(0b0100, 4);                                  // mode octet
  pousser(octets.length, version < 10 ? 8 : 16);       // nombre de caractères
  for (const o of octets) pousser(o, 8);

  // Terminateur : jusqu'à quatre zéros, puis on complète l'octet courant.
  for (let i = 0; i < 4 && bits.length < total * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);

  const mots = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    mots.push(v);
  }
  for (let i = 0; mots.length < total; i++) mots.push(REMPLISSAGE[i % 2]);
  return mots;
}

/** Découpe en blocs, calcule leur correction, et entrelace le tout. */
function entrelacer(mots, version) {
  const [nEc, g1, d1, g2, d2] = BLOCS[version];
  const donnees = [], ecc = [];
  let p = 0;
  for (let i = 0; i < g1; i++) { const b = mots.slice(p, p + d1); p += d1; donnees.push(b); ecc.push(correction(b, nEc)); }
  for (let i = 0; i < g2; i++) { const b = mots.slice(p, p + d2); p += d2; donnees.push(b); ecc.push(correction(b, nEc)); }

  const sortie = [];
  const maxD = Math.max(d1, d2);
  for (let i = 0; i < maxD; i++) for (const b of donnees) if (i < b.length) sortie.push(b[i]);
  for (let i = 0; i < nEc; i++) for (const b of ecc) sortie.push(b[i]);
  return sortie;
}

/* ── La matrice ──────────────────────────────────────────────────────────── */

/** Les 15 bits d'information de format, protégés en BCH(15,5). */
function bitsFormat(masque) {
  const donnees = (NIVEAU_M << 3) | masque;
  let reste = donnees;
  for (let i = 0; i < 10; i++) reste = (reste << 1) ^ ((reste >>> 9) * 0x537);
  return ((donnees << 10) | reste) ^ 0x5412;
}

/** Les 18 bits d'information de version, à partir de la version 7. */
function bitsVersion(version) {
  let reste = version;
  for (let i = 0; i < 12; i++) reste = (reste << 1) ^ ((reste >>> 11) * 0x1f25);
  return (version << 12) | reste;
}

const MASQUES = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

/** Les motifs fixes : repères d'angle, séparateurs, synchronisation, alignement. */
function poserMotifs(m, fige, version, taille) {
  const finder = (r, c) => {
    for (let i = -1; i <= 7; i++) {
      for (let j = -1; j <= 7; j++) {
        const rr = r + i, cc = c + j;
        if (rr < 0 || rr >= taille || cc < 0 || cc >= taille) continue;
        const noir =
          (i >= 0 && i <= 6 && (j === 0 || j === 6)) ||
          (j >= 0 && j <= 6 && (i === 0 || i === 6)) ||
          (i >= 2 && i <= 4 && j >= 2 && j <= 4);
        m[rr][cc] = noir ? 1 : 0;
        fige[rr][cc] = true;
      }
    }
  };
  finder(0, 0);
  finder(0, taille - 7);
  finder(taille - 7, 0);

  // Synchronisation : une ligne et une colonne alternées entre les repères.
  for (let i = 8; i < taille - 8; i++) {
    const noir = i % 2 === 0 ? 1 : 0;
    m[6][i] = noir; fige[6][i] = true;
    m[i][6] = noir; fige[i][6] = true;
  }

  // Alignement, sauf là où il chevaucherait un repère d'angle.
  const centres = ALIGNEMENTS[version];
  const dernier = centres[centres.length - 1];
  for (const r of centres) {
    for (const c of centres) {
      if ((r === 6 && c === 6) || (r === 6 && c === dernier) || (r === dernier && c === 6)) continue;
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          m[r + i][c + j] = Math.max(Math.abs(i), Math.abs(j)) !== 1 ? 1 : 0;
          fige[r + i][c + j] = true;
        }
      }
    }
  }

  // Le module toujours noir, juste au-dessus du repère bas-gauche.
  m[4 * version + 9][8] = 1;
  fige[4 * version + 9][8] = true;

  // On réserve la place du format — il sera écrit une fois le masque choisi.
  for (let i = 0; i < 9; i++) {
    if (!fige[8][i]) { fige[8][i] = true; m[8][i] = 0; }
    if (!fige[i][8]) { fige[i][8] = true; m[i][8] = 0; }
  }
  for (let i = 0; i < 8; i++) {
    fige[8][taille - 1 - i] = true; m[8][taille - 1 - i] = 0;
    fige[taille - 1 - i][8] = true; m[taille - 1 - i][8] = 0;
  }

  // Et celle de la version, quand elle est écrite.
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const a = Math.floor(i / 3), b = i % 3;
      fige[taille - 11 + b][a] = true; m[taille - 11 + b][a] = 0;
      fige[a][taille - 11 + b] = true; m[a][taille - 11 + b] = 0;
    }
  }
}

/** Le parcours en zigzag, de bas à droite vers le haut. */
function poserDonnees(m, fige, flux, taille) {
  let sens = -1, ligne = taille - 1, bit = 0;
  const total = flux.length * 8;
  for (let col = taille - 1; col > 0; col -= 2) {
    if (col === 6) col--;                        // la colonne de synchronisation
    for (;;) {
      for (let k = 0; k < 2; k++) {
        const c = col - k;
        if (fige[ligne][c]) continue;
        m[ligne][c] = bit < total ? (flux[bit >> 3] >> (7 - (bit & 7))) & 1 : 0;
        bit++;
      }
      ligne += sens;
      if (ligne < 0 || ligne >= taille) { ligne -= sens; sens = -sens; break; }
    }
  }
}

/** La pénalité d'un masque : plus elle est basse, plus le symbole se lit vite. */
function penalite(m, taille) {
  let p = 0;

  // Règle 1 — les suites de cinq modules identiques ou plus.
  for (let axe = 0; axe < 2; axe++) {
    for (let i = 0; i < taille; i++) {
      let precedent = -1, suite = 0;
      for (let j = 0; j < taille; j++) {
        const v = axe === 0 ? m[i][j] : m[j][i];
        if (v === precedent) suite++;
        else { if (suite >= 5) p += 3 + (suite - 5); precedent = v; suite = 1; }
      }
      if (suite >= 5) p += 3 + (suite - 5);
    }
  }

  // Règle 2 — les carrés de deux sur deux d'une seule couleur.
  for (let i = 0; i < taille - 1; i++)
    for (let j = 0; j < taille - 1; j++)
      if (m[i][j] === m[i][j + 1] && m[i][j] === m[i + 1][j] && m[i][j] === m[i + 1][j + 1]) p += 3;

  // Règle 3 — les motifs qu'on confondrait avec un repère d'angle.
  const A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  for (let axe = 0; axe < 2; axe++) {
    for (let i = 0; i < taille; i++) {
      for (let j = 0; j + 11 <= taille; j++) {
        let a = true, b = true;
        for (let k = 0; k < 11; k++) {
          const v = axe === 0 ? m[i][j + k] : m[j + k][i];
          if (v !== A[k]) a = false;
          if (v !== B[k]) b = false;
        }
        if (a) p += 40;
        if (b) p += 40;
      }
    }
  }

  // Règle 4 — l'écart à la moitié de modules noirs.
  let noirs = 0;
  for (let i = 0; i < taille; i++) for (let j = 0; j < taille; j++) noirs += m[i][j];
  const pourcent = (noirs * 100) / (taille * taille);
  p += Math.floor(Math.abs(pourcent - 50) / 5) * 10;

  return p;
}

function ecrireFormat(m, taille, masque) {
  const bits = bitsFormat(masque);
  for (let i = 0; i < 15; i++) {
    const b = (bits >> i) & 1;
    // Première copie, autour du repère haut-gauche.
    if (i < 6) m[i][8] = b;
    else if (i === 6) m[7][8] = b;
    else if (i === 7) m[8][8] = b;
    else if (i === 8) m[8][7] = b;
    else m[8][14 - i] = b;
    // Seconde copie, répartie sur les deux autres repères.
    if (i < 8) m[8][taille - 1 - i] = b;
    else m[taille - 15 + i][8] = b;
  }
  m[taille - 8][8] = 1;   // le module toujours noir
}

function ecrireVersion(m, taille, version) {
  if (version < 7) return;
  const bits = bitsVersion(version);
  for (let i = 0; i < 18; i++) {
    const b = (bits >> i) & 1;
    const a = Math.floor(i / 3), c = i % 3;
    m[taille - 11 + c][a] = b;
    m[a][taille - 11 + c] = b;
  }
}

/* ── L'entrée publique ───────────────────────────────────────────────────── */

/**
 * Encode un texte en matrice de modules.
 * @returns {{ taille: number, version: number, modules: number[][] }}
 *          `modules[ligne][colonne]` vaut 1 pour un module noir.
 */
export function encoderQR(texte) {
  const octets = Array.from(new TextEncoder().encode(String(texte)));
  const version = choisirVersion(octets.length);
  if (!version) throw new Error('Texte trop long pour un code QR de version 10.');

  const taille = 17 + 4 * version;
  const flux = entrelacer(motsDeDonnees(octets, version), version);

  const base = Array.from({ length: taille }, () => new Array(taille).fill(0));
  const fige = Array.from({ length: taille }, () => new Array(taille).fill(false));
  poserMotifs(base, fige, version, taille);
  poserDonnees(base, fige, flux, taille);

  // Les huit masques sont essayés, on garde celui qui se lit le mieux. C'est
  // ce que fait la norme, et c'est ce qui rend le symbole robuste à un
  // téléphone bon marché tenu de travers dans une allée mal éclairée.
  let meilleur = null, meilleureNote = Infinity;
  for (let masque = 0; masque < 8; masque++) {
    const m = base.map((l) => l.slice());
    for (let i = 0; i < taille; i++)
      for (let j = 0; j < taille; j++)
        if (!fige[i][j] && MASQUES[masque](i, j)) m[i][j] ^= 1;
    ecrireFormat(m, taille, masque);
    ecrireVersion(m, taille, version);
    const note = penalite(m, taille);
    if (note < meilleureNote) { meilleureNote = note; meilleur = m; }
  }

  return { taille, version, modules: meilleur };
}

/**
 * Le tracé SVG des modules noirs, en unités de module.
 * À utiliser dans un `<path d={...}/>` sur un viewBox qui inclut la marge.
 */
export function traceQR(modules) {
  const bouts = [];
  for (let i = 0; i < modules.length; i++)
    for (let j = 0; j < modules.length; j++)
      if (modules[i][j]) bouts.push(`M${j} ${i}h1v1h-1z`);
  return bouts.join('');
}

/**
 * Un SVG complet et autonome, prêt à être imprimé ou enregistré.
 * La marge de quatre modules n'est pas décorative : sans elle, beaucoup de
 * lecteurs ne trouvent pas le symbole.
 */
export function svgQR(texte, { marge = 4, taillePx = 512 } = {}) {
  const { taille, modules } = encoderQR(texte);
  const total = taille + 2 * marge;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${taillePx}" height="${taillePx}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#fff"/>` +
    `<g transform="translate(${marge} ${marge})" fill="#000"><path d="${traceQR(modules)}"/></g>` +
    `</svg>`;
}
