import { supabase } from "./supabase";

/* ════════════════════════════════════════════════════════════════════════════
   MESURE

   La plateforme ne savait rien d'elle-même : combien de visiteurs arrivent,
   combien vont jusqu'au panier, combien commandent. Sans ces trois chiffres,
   dépenser en acquisition revient à dépenser au hasard.

   Trois principes tiennent ce fichier :

   1. ÇA NE CASSE JAMAIS RIEN. Une mesure qui fait planter une page vaut moins
      que pas de mesure du tout. Tout est enveloppé, tout échoue en silence.

   2. AUCUNE DONNÉE PERSONNELLE. On tire un identifiant de session au hasard.
      Il ne dit pas qui est la personne, il dit que ces vingt clics sont la
      même visite. C'est tout ce qu'il faut pour un entonnoir.

   3. L'ORIGINE SE RETIENT. Le lien partagé par une boutique n'est cliqué
      qu'à l'arrivée ; la commande vient dix pages plus tard. On garde donc
      l'origine dans la session pour que la boutique qui a amené l'acheteur
      soit créditée de sa vente.
   ════════════════════════════════════════════════════════════════════════════ */

const CLE_SESSION = "bt_sess";
const CLE_SOURCE  = "bt_src";
const CLE_VENDEUR = "bt_src_vendor";

const stockage = (() => {
  // Navigation privée, stockage plein, cookies bloqués : on retombe sur une
  // mémoire de page plutôt que de lever une exception à chaque appel.
  try {
    const t = "__bt";
    window.localStorage.setItem(t, "1");
    window.localStorage.removeItem(t);
    return window.localStorage;
  } catch {
    const m = new Map();
    return {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: k => m.delete(k),
    };
  }
})();

const idSession = () => {
  let s = stockage.getItem(CLE_SESSION);
  if (!s) {
    s = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).slice(0, 40);
    stockage.setItem(CLE_SESSION, s);
  }
  return s;
};

/**
 * Retient d'où vient la visite : `?ref=`, `?src=` ou `?utm_source=`.
 * La première origine gagne — c'est elle qui a fait venir la personne, les
 * suivantes ne font que la déplacer dans le site.
 */
export const capterOrigine = (search = window.location.search) => {
  try {
    const q = new URLSearchParams(search);
    const src = q.get("ref") || q.get("src") || q.get("utm_source");
    if (src && !stockage.getItem(CLE_SOURCE)) {
      stockage.setItem(CLE_SOURCE, src.slice(0, 64));
    }
  } catch { /* une URL bizarre ne doit pas casser la page */ }
};

/** Rattache l'origine à une boutique quand on la connaît. */
export const attribuerBoutique = (vendorId) => {
  try {
    if (vendorId && stockage.getItem(CLE_SOURCE) && !stockage.getItem(CLE_VENDEUR)) {
      stockage.setItem(CLE_VENDEUR, vendorId);
    }
  } catch { /* sans effet */ }
};

export const origineActuelle = () => stockage.getItem(CLE_SOURCE) || null;

// Deux pages vues identiques à la suite (un re-rendu React, un retour arrière)
// ne sont pas deux visites. On laisse passer une seconde entre deux mêmes
// événements.
const derniers = new Map();
const trop_recent = (cle) => {
  const t = Date.now();
  const p = derniers.get(cle) || 0;
  if (t - p < 1000) return true;
  derniers.set(cle, t);
  return false;
};

/**
 * Enregistre un événement. Ne renvoie rien, n'attend rien, ne lève rien.
 *
 * @param {string} name   'page_view', 'add_to_cart', 'order_placed', 'signup'…
 * @param {object} props  ce qui aide à comprendre — jamais de donnée personnelle
 */
export const track = (name, props = {}) => {
  try {
    if (!name) return;
    if (trop_recent(`${name}|${props?.path || window.location.pathname}`)) return;

    supabase.rpc("track_event", {
      p_session:   idSession(),
      p_name:      name,
      p_path:      (props.path || window.location.pathname || "").slice(0, 300),
      p_referrer:  (props.referrer ?? document.referrer ?? "").slice(0, 300) || null,
      p_source:    stockage.getItem(CLE_SOURCE),
      p_vendor_id: props.vendor_id || stockage.getItem(CLE_VENDEUR) || null,
      p_props:     props.data || {},
    }).then(() => {}, () => {});     // le silence est volontaire
  } catch { /* une mesure ne casse pas une page */ }
};

/* ── Les plantages ────────────────────────────────────────────────────────── */
// Sans ça, une erreur sur le téléphone d'un client est invisible : il part, et
// personne n'apprend jamais pourquoi. Le regroupement se fait en base, par
// empreinte — ici on se contente de ne pas inonder le réseau.
const vues = new Set();

export const logError = (err, contexte = "") => {
  try {
    const message = `${contexte ? contexte + " — " : ""}${err?.message || String(err)}`.slice(0, 500);
    const cle = message + "|" + window.location.pathname;
    if (vues.has(cle)) return;          // une fois par session suffit
    vues.add(cle);

    supabase.rpc("log_client_error", {
      p_message: message,
      p_stack:   (err?.stack || "").slice(0, 4000) || null,
      p_path:    window.location.pathname,
      p_ua:      (navigator.userAgent || "").slice(0, 300),
    }).then(() => {}, () => {});
  } catch { /* sans effet */ }
};

/** Branche les deux filets globaux. À appeler une fois au démarrage. */
export const installerFilets = () => {
  window.addEventListener("error", (e) => logError(e.error || e.message, "window.error"));
  window.addEventListener("unhandledrejection", (e) => logError(e.reason, "promesse non gérée"));
};
