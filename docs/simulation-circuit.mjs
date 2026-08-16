#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   SIMULATION DU CIRCUIT COMPLET

   Rejoue un relais de bout en bout avec les mêmes règles que docs/sql/23 à 26,
   et chronomètre chaque geste pour chacun des quatre acteurs.

   Les durées ne sont pas des mesures : ce sont des estimations posées geste par
   geste — une frappe au clavier, une lecture d'écran, cent trente mètres à pied
   à 1,3 m/s. Elles servent à répondre à une seule question : est-ce que le
   commerçant peut faire ça devant un client qui attend ?

       node docs/simulation-circuit.mjs
   ══════════════════════════════════════════════════════════════════════════ */

const BAREME = { majoration: 1300, buyticle: 300, remise: 500, bon: 500, directe: 1000 };
const fcfa = (n) => `${Math.round(n).toLocaleString('fr-FR')} F`;
const pad  = (s, n) => String(s).padEnd(n);

/* ── Le rayon ────────────────────────────────────────────────────────────── */
const RAYON = { nom: 'Chaussure & Sport', zone: 'Marché Mboppi', plancher: 60 };
const BOUTIQUES = {
  essomba: { nom: 'Boutique Essomba', env: 26, rec: 21, rup: 0, rec7: 5, m: 0 },
  etoile:  { nom: 'Étoile du Sud',    env: 12, rec: 16, rup: 0, rec7: 4, m: 210 },
  second:  { nom: 'Second Life',      env: 21, rec: 14, rup: 0, rec7: 2, m: 130 },
  elegance:{ nom: 'Élégance Bonapriso', env: 10, rec: 12, rup: 1, rec7: 3, m: 340 },
};
const score = (b) => b.env - b.rec - 5 * b.rup;

/* ── Les prix ────────────────────────────────────────────────────────────── */
const decomposer = (net, relaye = true) => {
  const r = relaye ? BAREME.remise : BAREME.directe;
  return {
    net,
    affiche:  Math.round(net * (1 + BAREME.majoration / 1e4)),
    paye:     Math.round(net * (1 + (BAREME.majoration - r) / 1e4)),
    remise:   Math.round(net * r / 1e4),
    bon:      relaye ? Math.round(net * BAREME.bon / 1e4) : 0,
    buyticle: Math.round(net * BAREME.buyticle / 1e4),
  };
};

/* ── Le chronomètre ──────────────────────────────────────────────────────── */
const journal = [];
let t = 0;
const etape = (s, acteur, geste, detail) => {
  t += s;
  journal.push({ s, t, acteur, geste, detail });
};

/* ══════════════════════════════════════════════════════════════════════════
   LE CIRCUIT
   ══════════════════════════════════════════════════════════════════════════ */
console.log(`\n  ${RAYON.zone} — rayon ${RAYON.nom}\n  ${'─'.repeat(64)}\n`);

/* 1 · Le client demande. */
etape(12, 'client',  'Il demande l’article',
      '« Timberland 6-inch, pointure 45 »');

/* 2 · Le vendeur cherche. Son stock d'abord — c'est son métier, et il récupère
       les deux tiers des ruptures par sa propre substitution. */
etape(9,  'vendeur', 'Il cherche',
      'Son propre stock d’abord : rien en 45');
etape(6,  'vendeur', 'Il essaie de caser autre chose',
      'Le client veut ce modèle-là — c’est le dernier recours');

/* 3 · L'appel. L'article est au catalogue du rayon : appel FERMÉ, une fiche et
       deux boutons. C'est ce qui fait monter le taux de réponse, et c'est le
       taux de réponse qui décide de la couverture. */
etape(3,  'vendeur', 'Il lance l’appel',
      'Cas A — l’article est au catalogue, appel fermé vers 3 boutiques');

const repondants = [];
[['etoile', 6, 48000], ['second', 11, 48000], ['elegance', 19, 51000]].forEach(([k, s, net]) => {
  repondants.push({ ...BOUTIQUES[k], cle: k, delai: s, net });
});
etape(30, 'rayon',   'Les boutiques répondent',
      repondants.map((r) => `${r.nom} à ${r.delai}s`).join(' · '));

/* 4 · L'arbitrage. Le vendeur ne choisit pas : il voit un classement. */
const classe = [...repondants]
  .filter((r) => r.rup < 3)                                   // 3 ruptures = écartée 15 j
  .sort((a, b) => {
    const sa = a.rec < RAYON.plancher, sb = b.rec < RAYON.plancher;
    if (sa !== sb) return sb - sa;                            // plancher d'abord
    if (score(b) !== score(a)) return score(b) - score(a);    // qui a le plus donné
    if (a.rec7 !== b.rec7) return a.rec7 - b.rec7;            // départage
    return a.m - b.m;
  });

console.log('  L’arbitrage — « celui qui reçoit donne »\n');
console.log(`  ${pad('', 3)}${pad('boutique', 22)}${pad('envoyés', 9)}${pad('reçus', 7)}${pad('score', 7)}${pad('distance', 9)}prix net`);
classe.forEach((r, i) => {
  console.log(`  ${pad((i + 1) + '.', 3)}${pad(r.nom, 22)}${pad(r.env, 9)}${pad(r.rec, 7)}${pad(score(r), 7)}${pad(r.m + ' m', 9)}${fcfa(r.net)}`);
});
const gagnante = classe[0];
console.log(`\n  → ${gagnante.nom} : elle a envoyé ${gagnante.env} et reçu ${gagnante.rec}.\n`);

etape(5,  'vendeur', 'Il regarde le classement',
      `3 propositions, ${gagnante.nom} en tête`);

/* 5 · L'identification. On ne demande rien au client avant d'avoir quelque
       chose à lui donner : une fois sur dix, personne n'a l'article. */
etape(4,  'vendeur', 'Il montre l’affiche du comptoir',
      '« Scanne ça, tu auras ton chemin »');
etape(6,  'client',  'Il scanne avec son appareil photo',
      'Une page web s’ouvre — aucune application à installer');
etape(22, 'client',  'Il crée son compte',
      'Son numéro, un mot de passe. Pas de code SMS, pas de vérification');
etape(3,  'vendeur', 'Il attribue le relais',
      'Prix figés, code généré, 48 h de validité');

const P = decomposer(gagnante.net);
console.log('  Le prix, figé à cet instant\n');
const ligne = (l, v, note = '') => console.log(`    ${pad(l, 38)}${fcfa(v).padStart(10)}${note ? '   ' + note : ''}`);
ligne(`Prix net de ${gagnante.nom}`, P.net, 'il le touche en entier');
ligne('+ 3 % Buyticle', P.buyticle);
ligne('+ 5 % remise au client', P.remise);
ligne(`+ 5 % bon à ${BOUTIQUES.essomba.nom}`, P.bon);
console.log(`    ${'─'.repeat(48)}`);
ligne('Prix affiché sur Buyticle', P.affiche);
ligne('Ce que le client paie avec son bon', P.paye);
ligne('S’il revenait seul plus tard', decomposer(P.net, false).paye, 'moins cher qu’envoyé');
console.log('');

/* 6 · La marche. Elle appartient au relais, pas à un transit de commande :
       aucune commande n'existe encore. */
const marche = Math.round(gagnante.m / 1.3);
etape(8,   'client', 'Il lit son chemin',
      '3 étapes, la devanture en photo, son code en grand');
etape(marche, 'client', `Il marche ${gagnante.m} m`,
      'Le rabatteur l’intercepte et échoue : il ne peut pas honorer le code');

/* 7 · Le comptoir. */
etape(7,  'client',  'Il montre son code',
      'Six caractères, lisibles à voix haute dans une allée bruyante');
etape(6,  'receveur','Il valide le code',
      'État arrive — le bon est réservé, rien n’est encore crédité');
etape(40, 'receveur','Il sort l’article et le montre',
      'La vente se fait comme d’habitude');
etape(35, 'client',  'Il paie dans l’application',
      `${fcfa(P.paye)} en Mobile Money — son numéro est vérifié ici`);
etape(4,  'client',  'Il confirme avoir l’article',
      'C’est ici, et seulement ici, que l’argent bouge');

console.log('  L’argent, au moment de la remise\n');
console.log(`    ${pad(gagnante.nom, 24)}+ ${fcfa(P.net).padStart(9)}   son prix net, rien prélevé dessus`);
console.log(`    ${pad(BOUTIQUES.essomba.nom, 24)}+ ${fcfa(P.bon).padStart(9)}   son bon, pour un client qu’il ne pouvait pas servir`);
console.log(`    ${pad('Buyticle', 24)}+ ${fcfa(P.buyticle).padStart(9)}   commission, payée par l’acheteur`);
console.log(`    ${pad('Le client', 24)}  ${fcfa(P.remise).padStart(9)}   de remise, et il repart avec l’article\n`);
console.log(`    ${pad('', 24)}  ${' '.repeat(9)}   Celui qui reçoit ne paie rien.\n`);

/* 8 · L'avis. Jamais au comptoir : sous le regard du commerçant, ça ne produit
       pas un avis mais une politesse. */
etape(0, 'client', '— quelques heures plus tard —', '');
etape(45, 'client', 'Il laisse son avis',
      'Sur la boutique et sur le produit, lié à une commande livrée');

/* ══════════════════════════════════════════════════════════════════════════
   LE CHRONO
   ══════════════════════════════════════════════════════════════════════════ */
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

console.log(`  Le circuit, geste par geste\n  ${'─'.repeat(64)}\n`);
for (const e of journal) {
  if (!e.s) { console.log(`  ${' '.repeat(16)}${e.geste}`); continue; }
  console.log(`  ${pad(mmss(e.t), 7)}${pad('+' + e.s + 's', 6)}${pad(e.acteur, 10)}${pad(e.geste, 34)}${e.detail}`);
}

const parActeur = {};
for (const e of journal) parActeur[e.acteur] = (parActeur[e.acteur] || 0) + e.s;
const attente = journal.find((e) => e.acteur === 'rayon').s;

console.log(`\n  Temps passé par acteur\n  ${'─'.repeat(64)}\n`);
const lignes = [
  ['Le vendeur qui envoie', parActeur.vendeur,
   'du moment où il dit « je n’ai pas » à celui où le client part'],
  ['Le client',             parActeur.client,
   `dont ${marche}s de marche et 45s d’avis, plus tard`],
  ['Le commerçant qui reçoit', parActeur.receveur,
   'dont 40s de vente ordinaire, qu’il aurait faites de toute façon'],
  ['Le rayon (attente)',    attente,
   'les 30 secondes de l’appel, pendant lesquelles personne ne travaille'],
];
for (const [q, s, note] of lignes) {
  console.log(`  ${pad(q, 28)}${pad(mmss(s), 8)}${note}`);
}

console.log(`\n  ${pad('Le circuit complet', 28)}${pad(mmss(t), 8)}de la question du client à son avis`);
const sansAvis = t - 45;
console.log(`  ${pad('Sans l’avis', 28)}${pad(mmss(sansAvis), 8)}jusqu’à l’article en main\n`);

console.log(`  ${'─'.repeat(64)}\n`);
console.log('  Ce qu’il faut retenir\n');
console.log(`  · Le vendeur qui envoie y passe ${parActeur.vendeur} secondes. C’est le seul chiffre`);
console.log('    qui décide de l’adoption : au-delà d’une minute, il ne le fera pas');
console.log('    devant un client qui attend.');
console.log(`  · Les 30 secondes d’appel sont de l’attente, pas du travail. Il range`);
console.log('    son comptoir pendant ce temps-là.');
console.log(`  · Le commerçant qui reçoit ne fait rien de nouveau : 6 secondes pour le`);
console.log('    code, et sa vente habituelle. C’est pour ça qu’il accepte.');
console.log(`  · Le client marche ${marche}s. C’est la moitié de son temps, et c’est`);
console.log('    irréductible — le périmètre de 500 m existe pour ça.\n');
