import { supabase } from './supabase';

/* ══════════════════════════════════════════════════════════════════════════
   LE RELAIS, CÔTÉ TÉLÉPHONE

   Les mêmes fonctions que sur le web, appelées sur la même base. Rien n'est
   réimplémenté ici : toute la règle — le barème, l'arbitrage, les douze
   états — vit dans PostgreSQL, et c'est ce qui garantit que le comptoir sur
   Android et le comptoir dans un navigateur ne peuvent pas diverger.
   ══════════════════════════════════════════════════════════════════════════ */

const rpc = (nom, args) => supabase.rpc(nom, args);

/* ── Le comptoir ─────────────────────────────────────────────────────────── */

export const chercherDansRayon = (vendorId, texte) =>
  rpc('chercher_dans_rayon', { p_vendor_id: vendorId, p_texte: texte });

export const famillesDuRayon = (vendorId) =>
  rpc('familles_du_rayon', { p_vendor_id: vendorId });

export const lancerAppel = (vendorId, libelle, opts = {}) =>
  rpc('lancer_appel', {
    p_vendor_id: vendorId,
    p_libelle: libelle,
    p_product_id: opts.productId ?? null,
    p_famille_id: opts.familleId ?? null,
    p_contrainte: opts.contrainte ?? null,
    p_budget: opts.budget ?? null,
  });

export const appelsEnAttente = (vendorId) =>
  rpc('appels_en_attente', { p_vendor_id: vendorId });

export const repondreAppel = (appelId, vendorId, disponible, opts = {}) =>
  rpc('repondre_appel', {
    p_appel_id: appelId,
    p_vendor_id: vendorId,
    p_disponible: disponible,
    p_product_id: opts.productId ?? null,
    p_libelle: opts.libelle ?? null,
    p_prix_net: opts.prixNet ?? null,
  });

export const classerRepondants = (appelId) =>
  rpc('classer_repondants', { p_appel_id: appelId });

export const attribuerRelais = (appelId, receveurId, clientId, prixNet, opts = {}) =>
  rpc('attribuer_relais', {
    p_appel_id: appelId,
    p_receveur_id: receveurId,
    p_client_id: clientId,
    p_prix_net: prixNet,
    p_product_id: opts.productId ?? null,
    p_libelle: opts.libelle ?? null,
    p_mode: opts.mode ?? 'marche',
    p_rang_propose: opts.rangPropose ?? 1,
    p_rang_choisi: opts.rangChoisi ?? 1,
    p_motif_ecart: opts.motifEcart ?? null,
    p_code_client: opts.codeClient ?? null,
  });

export const presencesDuComptoir = (vendorId) =>
  rpc('presences_du_comptoir', { p_vendor_id: vendorId });

export const validerCode = (code, vendorId) =>
  rpc('valider_code', { p_code: code, p_vendor_id: vendorId });

export const declarerRupture = (relaisId, vendorId) =>
  rpc('declarer_rupture', { p_relais_id: relaisId, p_vendor_id: vendorId });

export const relaisDuComptoir = (vendorId) =>
  rpc('relais_du_comptoir', { p_vendor_id: vendorId });

export const relaisALivrer = (vendorId) =>
  rpc('relais_a_livrer', { p_vendor_id: vendorId });

export const soldeBon = (vendorId) => rpc('solde_bon', { p_vendor_id: vendorId });

export const pousserNotifications = () =>
  supabase.functions.invoke('relais-notify').catch(() => {});

/* ── Le client ───────────────────────────────────────────────────────────── */

export const monRelais = () => rpc('mon_relais');
export const maPresence = () => rpc('ma_presence');

export const signalerPresence = (referralCode) =>
  rpc('signaler_presence', { p_referral_code: referralCode });

export const boutiqueParCode = (code) =>
  rpc('boutique_par_code', { p_code: code });

export const payerRelais = (relaisId, moyen = 'orange_money', reference = null) =>
  rpc('payer_relais', { p_relais_id: relaisId, p_reference: reference, p_moyen: moyen });

export const confirmerRemise = (relaisId) =>
  rpc('confirmer_remise', { p_relais_id: relaisId });

export const annulerRelais = (relaisId) =>
  rpc('annuler_relais', { p_relais_id: relaisId });

export const renoncerAuComptoir = (relaisId) =>
  rpc('renoncer_au_comptoir', { p_relais_id: relaisId });

export const etatCommandes = (ids) => rpc('orders_status', { p_ids: ids });

/* ── Le paiement Mobile Money ────────────────────────────────────────────── */

export const OPERATEURS = [
  ['orange_money', 'Orange Money', 'CM_ORANGEMONEY'],
  ['mtn_momo', 'MTN MoMo', 'CM_MTNMOBILEMONEY'],
];

export function numeroMonetbil(tel) {
  let p = String(tel || '').replace(/[\s\-.()]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (/^6\d{8}$/.test(p)) p = '237' + p;
  return p;
}

export async function pousserUssd({ orderId, montant, tel, moyen }) {
  const op = OPERATEURS.find(([k]) => k === moyen)?.[2] || 'CM_ORANGEMONEY';
  const { data, error } = await supabase.functions.invoke('monetbil-init', {
    body: {
      order_ids: [orderId],
      amount: Math.round(montant),
      phone: numeroMonetbil(tel),
      operator: op,
    },
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || 'Le paiement n’a pas pu démarrer.');
  return data;
}

/* ── Petites choses ──────────────────────────────────────────────────────── */

export const fcfa = (n) =>
  `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} F`;

export function resteAvant(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}

export function etapes(relais) {
  if (!relais) return [];
  const d = relais.distance_m;
  return [
    { t: 'Sors de la boutique', s: relais.envoye_par ? `Tu étais chez ${relais.envoye_par}` : null },
    { t: d ? `Marche ${d} m` : 'Marche jusqu’à la boutique', s: 'Reste dans l’allée' },
    { t: `Entre chez ${relais.boutique}`, s: relais.repere || 'Montre ton code au comptoir' },
  ];
}
