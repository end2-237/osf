// ─────────────────────────────────────────────────────────
//  Discount configuration & helpers
//
//  Chaque vendeur choisit lui-même le pourcentage de remise
//  membre appliqué sur SA boutique (colonne vendors.member_discount_rate).
//  Les 20 % historiques restent la valeur par défaut quand la boutique
//  n'a rien défini.
// ─────────────────────────────────────────────────────────

export const DEFAULT_MEMBER_DISCOUNT_PERCENT = 20;
export const MAX_MEMBER_DISCOUNT_PERCENT     = 70;

// Rétro-compatibilité : ancienne constante utilisée par les bannières génériques.
export const MEMBER_DISCOUNT_RATE = DEFAULT_MEMBER_DISCOUNT_PERCENT / 100;

// Paliers proposés au vendeur dans son dashboard.
export const DISCOUNT_PRESETS = [5, 10, 15, 20, 25, 30, 40, 50];

/**
 * Normalise un pourcentage de remise (0 → 70).
 */
export function clampDiscountPercent(value) {
  const pct = Number(value);
  if (!Number.isFinite(pct)) return DEFAULT_MEMBER_DISCOUNT_PERCENT;
  return Math.min(Math.max(Math.round(pct), 0), MAX_MEMBER_DISCOUNT_PERCENT);
}

/**
 * Récupère le % de remise de la boutique à partir d'un vendeur, d'un produit
 * (avec `vendor` joint) ou d'un article de panier (champs aplatis).
 */
export function getVendorDiscountPercent(source) {
  if (!source) return DEFAULT_MEMBER_DISCOUNT_PERCENT;
  const raw =
    source.vendor_member_discount_rate ??
    source.vendor?.member_discount_rate ??
    source.member_discount_rate;
  if (raw === null || raw === undefined || raw === '') return DEFAULT_MEMBER_DISCOUNT_PERCENT;
  return clampDiscountPercent(raw);
}

/** Même chose, exprimé en fraction (0.20). */
export function getVendorDiscountRate(source) {
  return getVendorDiscountPercent(source) / 100;
}

/**
 * La boutique a-t-elle activé la remise membre ?
 */
export function isVendorDiscountEnabled(source) {
  if (!source) return false;
  return (
    source.vendor?.member_discount_enabled ??
    source.vendor_member_discount_enabled ??
    source.member_discount_enabled ??
    false
  );
}

/**
 * Prix remisé pour un membre, au taux propre à la boutique.
 */
export function applyVendorDiscount(originalPrice, source) {
  const base = Number(originalPrice) || 0;
  return Math.round(base * (1 - getVendorDiscountRate(source)));
}

/**
 * Returns the discounted price for authenticated (non-vendor) users.
 * Vendors are excluded — they interact with the platform differently.
 *
 * @param {number} originalPrice
 * @param {boolean} isAuthenticated  - user is logged in
 * @param {boolean} isVendor         - user has a vendor profile
 * @param {object}  [shop]           - vendeur / produit portant le taux de la boutique
 * @returns {number} final price
 */
export function getMemberPrice(originalPrice, isAuthenticated, isVendor = false, shop = null) {
  if (isAuthenticated && !isVendor) {
    return applyVendorDiscount(originalPrice, shop);
  }
  return originalPrice;
}

/**
 * Compute savings in absolute currency units.
 */
export function getSavings(originalPrice, isAuthenticated, isVendor = false, shop = null) {
  return originalPrice - getMemberPrice(originalPrice, isAuthenticated, isVendor, shop);
}

/**
 * Format FCFA amounts cleanly.
 */
export function formatPrice(amount) {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

/**
 * Apply member discount then stack a bundle/promo rate on top.
 *
 * @param {number} originalPrice
 * @param {boolean} isAuthenticated
 * @param {boolean} isVendor
 * @param {number} extraDiscountRate  - e.g. 0.10 for an extra 10%
 * @param {object} [shop]
 */
export function getStackedPrice(
  originalPrice,
  isAuthenticated,
  isVendor = false,
  extraDiscountRate = 0,
  shop = null
) {
  const afterMember = getMemberPrice(originalPrice, isAuthenticated, isVendor, shop);
  if (extraDiscountRate > 0) {
    return Math.round(afterMember * (1 - extraDiscountRate));
  }
  return afterMember;
}
