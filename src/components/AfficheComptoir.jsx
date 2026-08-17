import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { encoderQR, traceQR, svgQR } from '../lib/qrcode';
import { SITE_URL } from '../lib/brand';

/* ══════════════════════════════════════════════════════════════════════════
   L'AFFICHE DU COMPTOIR

   C'est le seul canal d'acquisition du modèle : le client ne découvre pas
   Buyticle sur une publicité, il le découvre collé sur le comptoir d'un
   commerçant qui vient de lui dire « je ne l'ai pas ».

   D'où trois partis pris.

   Le code est écrit en toutes lettres sous le QR. Beaucoup de téléphones
   d'occasion n'ouvrent pas les liens depuis l'appareil photo, et un client
   qui n'arrive pas à scanner doit pouvoir taper l'adresse.

   La promesse est au-dessus du QR, pas en dessous. On scanne ce qu'on a déjà
   décidé de scanner.

   Et l'affiche s'imprime en noir sur blanc, sans aplat : une cartouche
   d'encre couleur coûte plus cher qu'un mois d'abonnement.
   ══════════════════════════════════════════════════════════════════════════ */

const IMPRESSION = `
@media print {
  @page { margin: 12mm; }
  /* L'affiche est enfouie dans l'arbre React : on ne peut pas la sortir du
     flux en masquant les frères de <body>. On masque donc tout, on rend
     visible la seule branche qui nous intéresse, et on la remonte en haut
     de la page — c'est le seul procédé qui marche à n'importe quelle
     profondeur, et il marche dans tous les navigateurs. */
  body * { visibility: hidden !important; }
  .affiche-impression, .affiche-impression * { visibility: visible !important; }
  .affiche-impression {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    margin: 0 !important;
    background: #fff !important;
  }
  .sans-impression, .sans-impression * { display: none !important; }
}
`;

/** Le QR, en SVG : net à n'importe quelle taille d'impression. */
function CodeQR({ valeur, className = '' }) {
  const { taille, chemin } = useMemo(() => {
    const { taille, modules } = encoderQR(valeur);
    return { taille, chemin: traceQR(modules) };
  }, [valeur]);
  const marge = 2;                       // la marge blanche fait partie du symbole
  const total = taille + 2 * marge;
  return (
    <svg viewBox={`0 0 ${total} ${total}`} className={className}
         shapeRendering="crispEdges" role="img" aria-label={`Code QR vers ${valeur}`}>
      <rect width={total} height={total} fill="#fff" />
      <g transform={`translate(${marge} ${marge})`} fill="#000">
        <path d={chemin} />
      </g>
    </svg>
  );
}

export default function AfficheComptoir() {
  const { vendor } = useAuth();
  const [copie, setCopie] = useState('');

  const code = (vendor?.referral_code || '').toUpperCase();
  const lien = `${SITE_URL}/r/${code}`;

  if (!vendor) return null;

  if (!code) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <p className="text-sm font-bold text-amber-900">Ta boutique n’a pas encore de code</p>
        <p className="text-[13px] text-amber-800 mt-1.5 leading-relaxed">
          Sans code, ton affiche ne pointerait sur rien et aucun client ne
          pourrait être rattaché à tes relais. Il est attribué automatiquement —
          déconnecte-toi et reconnecte-toi pour le récupérer.
        </p>
      </div>
    );
  }

  const copier = (texte, quoi) => {
    navigator.clipboard?.writeText(texte)
      .then(() => { setCopie(quoi); setTimeout(() => setCopie(''), 1800); })
      .catch(() => {});
  };

  const telecharger = () => {
    const blob = new Blob([svgQR(lien, { taillePx: 1024 })], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buyticle-qr-${code}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <style>{IMPRESSION}</style>

      {/* Ce qui ne s'imprime pas : les commandes et l'explication. */}
      <div className="sans-impression rounded-2xl border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-900">Ton affiche de comptoir</h3>
        <p className="text-[13px] text-gray-600 mt-1.5 leading-relaxed">
          Imprime-la et colle-la sur ton comptoir, à hauteur des yeux du client.
          C’est elle qui lui donne son code quand tu l’envoies chez un voisin —
          sans elle, tu ne peux rattacher personne à un relais.
        </p>

        <div className="mt-3.5 flex flex-wrap gap-2">
          <button onClick={() => window.print()}
            className="bg-gray-900 text-white rounded-xl px-4 py-2.5 text-[13px] font-bold">
            Imprimer l’affiche
          </button>
          <button onClick={telecharger}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-gray-700">
            Télécharger le QR
          </button>
          <button onClick={() => copier(lien, 'lien')}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-gray-700">
            {copie === 'lien' ? 'Lien copié' : 'Copier le lien'}
          </button>
          <button onClick={() => copier(code, 'code')}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-gray-700">
            {copie === 'code' ? 'Code copié' : 'Copier le code'}
          </button>
        </div>

        <div className="mt-3.5 rounded-xl bg-gray-50 border border-gray-200 px-3.5 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
            Ton code de boutique
          </p>
          <p className="text-2xl font-black tracking-[0.18em] text-gray-900 mt-0.5">{code}</p>
          <p className="text-[12px] text-gray-500 mt-1 break-all">{lien}</p>
        </div>

        <p className="text-[12px] text-gray-500 mt-3 leading-relaxed">
          Un client qui n’arrive pas à scanner peut aussi taper ce code
          lui-même, depuis « Mon relais » sur son téléphone. Dis-le-lui : c’est
          plus rapide que de recommencer le scan.
        </p>
      </div>

      {/* L'affiche elle-même. Elle est aussi la seule chose qui s'imprime. */}
      <div className="affiche-impression">
        <div className="mx-auto max-w-[520px] border-2 border-gray-900 rounded-2xl px-7 py-8 text-center bg-white print:border-2 print:rounded-none">
          <p className="text-[12px] font-bold uppercase tracking-[0.3em] text-gray-900">
            Buyticle
          </p>

          <h1 className="text-[30px] leading-[1.12] font-black text-gray-900 mt-4">
            Tu ne trouves pas<br />ce que tu cherches ?
          </h1>
          <p className="text-[15px] text-gray-700 mt-3 leading-relaxed">
            Scanne. On te dit qui l’a juste à côté,<br />
            et tu le paies <b>moins cher</b> qu’au prix affiché.
          </p>

          <div className="mt-6 flex justify-center">
            <CodeQR valeur={lien} className="w-[230px] h-[230px]" />
          </div>

          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-gray-500 mt-5">
            Ou tape ce code
          </p>
          <p className="text-[40px] leading-none font-black tracking-[0.16em] text-gray-900 mt-1.5">
            {code}
          </p>
          <p className="text-[13px] text-gray-600 mt-2">
            sur <b>buyticle.store</b>
          </p>

          <div className="mt-6 pt-4 border-t border-gray-300">
            <p className="text-[13px] font-bold text-gray-900">{vendor.shop_name}</p>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
              Rien à installer · Ton numéro et un mot de passe suffisent
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
