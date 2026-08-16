import { supabase } from './supabase';

/* ══════════════════════════════════════════════════════════════════════════
   LE RELAIS, CÔTÉ NAVIGATEUR

   Une fonction par appel de base. Aucune règle métier ici : elles vivent
   toutes dans docs/sql/24, 25 et 26, parce qu'un navigateur se contourne.

   supabase-js ne lève pas d'exception : l'erreur est dans `error`, jamais
   attrapée par un try/catch. Chaque fonction renvoie donc { data, error } et
   l'appelant regarde `error`.
   ══════════════════════════════════════════════════════════════════════════ */

const rpc = (nom, args) => supabase.rpc(nom, args);

/* ── Côté vendeur ────────────────────────────────────────────────────────── */

/** Son propre stock d'abord, puis celui du rayon. L'ordre n'est pas cosmétique :
    il récupère les deux tiers des ruptures par sa propre substitution. */
export const chercherDansRayon = (vendorId, texte) =>
  rpc('chercher_dans_rayon', { p_vendor_id: vendorId, p_texte: texte });

/** Lance l'appel. L'application décide seule du cas A, B ou C. */
export const lancerAppel = (vendorId, libelle, opts = {}) =>
  rpc('lancer_appel', {
    p_vendor_id:  vendorId,
    p_libelle:    libelle,
    p_famille_id: opts.familleId ?? null,
    p_product_id: opts.productId ?? null,
    p_contrainte: opts.contrainte ?? null,
    p_budget:     opts.budget ?? null,
  });

export const repondreAppel = (appelId, vendorId, disponible, opts = {}) =>
  rpc('repondre_appel', {
    p_appel_id:   appelId,
    p_vendor_id:  vendorId,
    p_disponible: disponible,
    p_product_id: opts.productId ?? null,
    p_prix_net:   opts.prixNet ?? null,
  });

/** Le classement de l'arbitrage. La première est celle qui a le plus donné. */
export const classerRepondants = (appelId) =>
  rpc('classer_repondants', { p_appel_id: appelId });

export const attribuerRelais = (appelId, receveurId, clientId, prixNet, opts = {}) =>
  rpc('attribuer_relais', {
    p_appel_id:    appelId,
    p_receveur_id: receveurId,
    p_client_id:   clientId,
    p_prix_net:    prixNet,
    p_product_id:  opts.productId ?? null,
    p_mode:        opts.mode ?? 'marche',
    p_rang_choisi: opts.rangChoisi ?? 1,
    p_motif:       opts.motif ?? null,
  });

export const validerCode = (code, vendorId) =>
  rpc('valider_code', { p_code: code, p_vendor_id: vendorId });

export const declarerRupture = (relaisId, vendorId) =>
  rpc('declarer_rupture', { p_relais_id: relaisId, p_vendor_id: vendorId });

export const relaisDuComptoir = (vendorId) =>
  rpc('relais_du_comptoir', { p_vendor_id: vendorId });

export const soldeBon = (vendorId) => rpc('solde_bon', { p_vendor_id: vendorId });

export const releveBoutique = (vendorId, jours = 30) =>
  rpc('releve_boutique', { p_vendor_id: vendorId, p_jours: jours });

export const compteurs = (vendorId) => rpc('compteurs_boutique', { p_vendor_id: vendorId });

/* ── Côté client ─────────────────────────────────────────────────────────── */

export const monRelais = () => rpc('mon_relais');

export const payerRelais = (relaisId, reference = null) =>
  rpc('payer_relais', { p_relais_id: relaisId, p_reference: reference });

export const confirmerRemise = (relaisId) => rpc('confirmer_remise', { p_relais_id: relaisId });

export const annulerRelais = (relaisId) => rpc('annuler_relais', { p_relais_id: relaisId });

/* ── Petites choses ──────────────────────────────────────────────────────── */

export const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} F`;

/** « 2 h 14 » — ce qu'il reste avant que le bon expire. */
export function resteAvant(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

/** Trois étapes plutôt qu'une carte : le client marche, il ne navigue pas. */
export function etapes(relais) {
  if (!relais) return [];
  const d = relais.distance_m;
  return [
    { t: 'Sors de la boutique', s: relais.envoye_par ? `Tu étais chez ${relais.envoye_par}` : null },
    { t: d ? `Marche ${d} m` : 'Marche jusqu’à la boutique', s: 'Reste dans l’allée' },
    { t: `Entre chez ${relais.boutique}`, s: relais.repere || 'Montre ton code au comptoir' },
  ];
}
