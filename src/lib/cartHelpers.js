// src/lib/cartHelpers.js

import { applyVendorDiscount, isVendorDiscountEnabled } from '../utils/discountUtils';

const BUNDLE_DISCOUNT = 0.20;

/**
 * Prix unitaire effectif d'un article.
 * Remise appliquée si l'utilisateur est membre ET le vendeur a activé la promo.
 * Le pourcentage est celui défini par le vendeur pour sa boutique.
 */
export const getUnitPrice = (item, isMember) => {
  const base = Number(item.price) || 0;
  if (isMember && isVendorDiscountEnabled(item)) {
    return applyVendorDiscount(base, item);
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
