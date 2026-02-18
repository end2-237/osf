// ─────────────────────────────────────────────────────────
//  Discount configuration & helpers
// ─────────────────────────────────────────────────────────

export const MEMBER_DISCOUNT_RATE = 0.20; // 10% off for authenticated users

/**
 * Returns the discounted price for authenticated (non-vendor) users.
 * Vendors are excluded — they interact with the platform differently.
 *
 * @param {number} originalPrice
 * @param {boolean} isAuthenticated  - user is logged in
 * @param {boolean} isVendor         - user has a vendor profile
 * @returns {number} final price
 */
export function getMemberPrice(originalPrice, isAuthenticated, isVendor = false) {
  if (isAuthenticated && !isVendor) {
    return Math.round(originalPrice * (1 - MEMBER_DISCOUNT_RATE));
  }
  return originalPrice;
}

/**
 * Compute savings in absolute currency units.
 */
export function getSavings(originalPrice, isAuthenticated, isVendor = false) {
  return originalPrice - getMemberPrice(originalPrice, isAuthenticated, isVendor);
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
 */
export function getStackedPrice(
  originalPrice,
  isAuthenticated,
  isVendor = false,
  extraDiscountRate = 0
) {
  const afterMember = getMemberPrice(originalPrice, isAuthenticated, isVendor);
  if (extraDiscountRate > 0) {
    return Math.round(afterMember * (1 - extraDiscountRate));
  }
  return afterMember;
}