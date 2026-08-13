import React, { lazy } from 'react';
import { logError } from './track';

/* ════════════════════════════════════════════════════════════════════════════
   CHARGEMENT DES PAGES — résistance aux déploiements

   Chaque page est un chunk JS au nom haché (Store-D5R9MXAY.js). Après un
   déploiement, ces noms changent. Un onglet resté ouvert continue de pointer
   vers les anciens fichiers : dès que l'utilisateur navigue vers une page non
   encore chargée, le `import()` reçoit un 404 et l'application affiche une
   page blanche — d'où le Ctrl+Shift+R permanent.

   La parade : quand un chunk manque, on recharge la page une fois pour
   récupérer la version courante. Si l'échec persiste, on laisse remonter
   l'erreur vers l'écran de secours plutôt que de boucler.
   ════════════════════════════════════════════════════════════════════════════ */

const RELOAD_KEY = 'ofs_chunk_reload_at';
const RELOAD_COOLDOWN_MS = 15000;

const lastReloadAt = () => {
  try { return Number(sessionStorage.getItem(RELOAD_KEY)) || 0; } catch { return 0; }
};
const markReload = () => {
  try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* mode privé */ }
};

/** Recharge la page si on ne vient pas déjà de le faire. */
export const reloadForNewVersion = () => {
  if (Date.now() - lastReloadAt() < RELOAD_COOLDOWN_MS) return false;
  markReload();
  window.location.reload();
  return true;
};

/** `React.lazy`, mais qui se rattrape sur un chunk devenu introuvable. */
export const lazyWithRetry = (factory) =>
  lazy(() =>
    factory().catch((err) => {
      if (reloadForNewVersion()) {
        // Le rechargement est lancé : on garde la promesse en attente pour
        // ne pas afficher d'erreur pendant la fraction de seconde restante.
        return new Promise(() => {});
      }
      throw err;
    })
  );

/* ── Écran de secours ─────────────────────────────────────────────────────── */
export class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('[ROUTE]', error);
    // Sans remontée, une page blanche chez un client reste invisible : il
    // ferme l'onglet et personne n'apprend jamais pourquoi.
    logError(error, 'rendu de page');
    // Dernière chance : si l'erreur vient d'un chunk manquant et qu'aucun
    // rechargement récent n'a eu lieu, on retente automatiquement.
    if (/dynamically imported module|Importing a module script failed|Failed to fetch/i.test(error?.message || '')) {
      reloadForNewVersion();
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-[#FFF8D3] flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-rotate text-[#FF9900] text-xl" />
          </div>
          <p className="text-lg font-bold text-[#0F1111] dark:text-white mb-1">
            Cette page n'a pas pu se charger
          </p>
          <p className="text-sm text-[#565959] dark:text-zinc-400 mb-5">
            Une nouvelle version du site est peut-être disponible. Recharge la page pour continuer.
          </p>
          <button
            onClick={() => { markReload(); window.location.reload(); }}
            className="bg-[#FFD814] hover:bg-[#F7CA00] border border-[#FCD200] text-[#0F1111] font-medium text-sm px-8 py-2 rounded-full transition"
          >
            Recharger la page
          </button>
        </div>
      </div>
    );
  }
}
