// src/lib/cartHelpers.js

const MEMBER_DISCOUNT = 0.25;
const BUNDLE_DISCOUNT = 0.20;

/**
 * Prix unitaire effectif d'un article.
 * −25% si l'utilisateur est membre ET le vendeur a activé la promo.
 */
export const getUnitPrice = (item, isMember) => {
  const base = Number(item.price) || 0;
  const vendorHasPromo =
    item.vendor?.member_discount_enabled ??
    item.vendor_member_discount_enabled ??
    false;
  if (isMember && vendorHasPromo) {
    return Math.round(base * (1 - MEMBER_DISCOUNT));
  }
  return base;
};

/**
 * Calcule tous les totaux du panier.
 */
export const computeCartTotals = (cart, isMember) => {
  const rawTotal = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity, 0
  );

  const subtotalAfterMember = cart.reduce(
    (sum, item) => sum + getUnitPrice(item, isMember) * item.quantity, 0
  );

  const memberSavings    = rawTotal - subtotalAfterMember;
  const hasMemberSavings = memberSavings > 0;

  const hasBundle      = cart.length >= 2;
  const bundleDiscount = hasBundle ? Math.round(subtotalAfterMember * BUNDLE_DISCOUNT) : 0;
  const finalTotal     = subtotalAfterMember - bundleDiscount;

  return {
    rawTotal,
    memberSavings,
    subtotalAfterMember,
    bundleDiscount,
    finalTotal,
    hasMemberSavings,
    hasBundle,
  };
};