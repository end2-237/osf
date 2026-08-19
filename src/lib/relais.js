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

/** Les familles ouvertes du rayon, pour la question ouverte quand rien n'est
    référencé nulle part. Les familles fermées ne sont pas proposées. */
export const famillesDuRayon = (vendorId) =>
  rpc('familles_du_rayon', { p_vendor_id: vendorId });

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

/** Les appels en cours qui la concernent et auxquels elle n'a pas répondu.
    C'est la moitié du mécanisme : sans elle, personne ne répond jamais. */
export const appelsEnAttente = (vendorId) =>
  rpc('appels_en_attente', { p_vendor_id: vendorId });

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
    p_code_client: opts.codeClient ?? null,
  });

/* ── La présence au comptoir ─────────────────────────────────────────────────
   Deux codes différents, et il ne faut pas les confondre. Celui de PRÉSENCE,
   quatre caractères, sert au client à dire « c'est moi » au vendeur qui envoie ;
   il vit quinze minutes. Celui de RELAIS, six caractères, sert à dire « c'est
   bien moi » au comptoir de la boutique qui reçoit ; il vit 48 heures.
   ──────────────────────────────────────────────────────────────────────────── */

/** Le client vient de scanner l'affiche du comptoir — ou d'en taper le code. */
export const signalerPresence = (referralCode) =>
  rpc('signaler_presence', { p_referral_code: referralCode });

/** Quelle boutique porte ce code — pour l'afficher avant de valider. */
export const boutiqueParCode = (code) =>
  rpc('boutique_par_code', { p_code: code });

/** Son code personnel, tant qu'aucun relais ne lui a été attribué. */
export const maPresence = () => rpc('ma_presence');

/** Qui vient de scanner ce comptoir — le plus récent en premier. */
export const presencesDuComptoir = (vendorId) =>
  rpc('presences_du_comptoir', { p_vendor_id: vendorId });

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

export const mesNotifications = (vendorId, limite = 30) =>
  rpc('mes_notifications', { p_vendor_id: vendorId, p_limite: limite });

/* Les relais à livrer : ce qu'un commerçant de services a demandé et que cette
   boutique doit porter jusqu'à lui. Le client est immobilisé — dans un fauteuil,
   ou la voiture sur le pont — donc l'ordre est chronologique et rien d'autre. */
export const relaisALivrer = (vendorId) =>
  supabase
    .from('relais')
    .select('id, libelle, code, etat, prix_net, prix_paye, distance_m, created_at, emetteur:vendors!relais_emetteur_id_fkey(shop_name, pickup_label)')
    .eq('receveur_id', vendorId)
    .eq('mode', 'livre')
    .in('etat', ['attribue', 'arrive', 'paye'])
    .order('created_at', { ascending: true });

/* L'appel vient de partir : on pousse tout de suite, sans attendre la tâche
   planifiée. Les trente secondes commencent maintenant, pas dans une minute.
   Sans réponse, on ne fait rien : la file sera vidée par le cron. */
export const pousserNotifications = () =>
  supabase.functions.invoke('relais-notify').catch(() => {});

/* ── Côté client ─────────────────────────────────────────────────────────── */

export const monRelais = () => rpc('mon_relais');

/* Crée la commande en attente de paiement. Elle ne vaut rien tant que
   l'opérateur n'a pas confirmé : c'est son webhook qui fait avancer le
   relais, jamais cet écran. */
export const payerRelais = (relaisId, moyen = 'orange_money', reference = null) =>
  rpc('payer_relais', { p_relais_id: relaisId, p_reference: reference, p_moyen: moyen });

export const confirmerRemise = (relaisId) => rpc('confirmer_remise', { p_relais_id: relaisId });

export const annulerRelais = (relaisId) => rpc('annuler_relais', { p_relais_id: relaisId });

/** Il est venu, il n'a pas payé, il repart. L'article part dans son panier. */
export const renoncerAuComptoir = (relaisId) =>
  rpc('renoncer_au_comptoir', { p_relais_id: relaisId });

/** L'état des commandes, sans aucune donnée client — le même que le panier. */
export const etatCommandes = (ids) => rpc('orders_status', { p_ids: ids });

/* ── Le paiement Mobile Money ────────────────────────────────────────────────
   Exactement le circuit du panier : `monetbil-init` pousse l'USSD, l'opérateur
   rappelle le webhook, et le webhook écrit `paid`. On ne fait que déclencher
   et attendre.
   ──────────────────────────────────────────────────────────────────────────── */

export const OPERATEURS = [
  ['orange_money', 'Orange Money', 'CM_ORANGEMONEY'],
  ['mtn_momo',     'MTN MoMo',     'CM_MTNMOBILEMONEY'],
];

/** 6XX XX XX XX → 237XXXXXXXXX, la seule forme que Monetbil accepte. */
export function numeroMonetbil(tel) {
  let p = String(tel || '').replace(/[\s\-.()]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (/^6\d{8}$/.test(p)) p = '237' + p;
  return p;
}

export async function pousserUssd({ orderId, montant, tel, moyen }) {
  const url  = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const op   = OPERATEURS.find(([k]) => k === moyen)?.[2] || 'CM_ORANGEMONEY';

  const res = await fetch(`${url}/functions/v1/monetbil-init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anon}`,
      'apikey': anon,
    },
    body: JSON.stringify({
      order_ids: [orderId],
      amount: Math.round(montant),
      phone: numeroMonetbil(tel),
      operator: op,
    }),
  });

  const brut = await res.text();
  let out;
  try { out = JSON.parse(brut); }
  catch { throw new Error(`Réponse serveur invalide (${res.status})`); }
  if (!out.success) throw new Error(out.error || `Erreur ${res.status}`);
  return out;
}

/* ── Le panier ───────────────────────────────────────────────────────────────
   S'il ne paie pas, l'article ne doit pas disparaître. On l'écrit dans le
   panier du navigateur — le même que partout ailleurs — et on prévient
   l'application, qui tient sa propre copie en mémoire.

   Au prix normal du catalogue, pas au prix du relais : la remise payait le
   déplacement au comptoir. S'il repart sans acheter, il n'y a plus de
   déplacement à récompenser, et le bon de l'envoyeur n'existera jamais.
   ──────────────────────────────────────────────────────────────────────────── */

export function mettreAuPanier(article) {
  let panier = [];
  try { panier = JSON.parse(localStorage.getItem('ofs_cart') || '[]'); } catch { panier = []; }

  const i = panier.findIndex((x) => x.id === article.id);
  if (i > -1) panier[i].quantity = (Number(panier[i].quantity) || 1) + 1;
  else panier.push({ ...article, quantity: 1 });

  try {
    localStorage.setItem('ofs_cart', JSON.stringify(panier));
    localStorage.setItem('ofs_cart_ts', Date.now().toString());
  } catch { return false; }
  window.dispatchEvent(new CustomEvent('ofs:cartUpdated'));
  return true;
}

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
