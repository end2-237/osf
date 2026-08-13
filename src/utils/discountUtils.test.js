import { describe, it, expect } from "vitest";
import {
  clampDiscountPercent,
  getVendorDiscountPercent,
  getVendorDiscountRate,
  isVendorDiscountEnabled,
  applyVendorDiscount,
  getMemberPrice,
  getSavings,
  DEFAULT_MEMBER_DISCOUNT_PERCENT,
  MAX_MEMBER_DISCOUNT_PERCENT,
} from "./discountUtils";

/* Ces fonctions décident du prix affiché à un client. Une erreur ici ne fait
   pas planter la page : elle vend au mauvais prix, en silence, jusqu'à ce
   qu'un vendeur s'en aperçoive sur son solde. C'est exactement le genre de
   chose qu'un test doit tenir. */

describe("clampDiscountPercent", () => {
  it("garde un pourcentage valide tel quel", () => {
    expect(clampDiscountPercent(15)).toBe(15);
    expect(clampDiscountPercent("30")).toBe(30);
  });

  it("plafonne au maximum autorisé", () => {
    expect(clampDiscountPercent(95)).toBe(MAX_MEMBER_DISCOUNT_PERCENT);
  });

  it("refuse le négatif", () => {
    expect(clampDiscountPercent(-10)).toBe(0);
  });

  it("retombe sur la valeur par défaut quand ce n'est pas un nombre", () => {
    expect(clampDiscountPercent("abc")).toBe(DEFAULT_MEMBER_DISCOUNT_PERCENT);
    expect(clampDiscountPercent(undefined)).toBe(DEFAULT_MEMBER_DISCOUNT_PERCENT);
    expect(clampDiscountPercent(NaN)).toBe(DEFAULT_MEMBER_DISCOUNT_PERCENT);
  });

  it("arrondit les décimales", () => {
    expect(clampDiscountPercent(12.6)).toBe(13);
  });
});

describe("getVendorDiscountPercent", () => {
  it("lit le taux du vendeur, quelle que soit la forme de l'objet", () => {
    expect(getVendorDiscountPercent({ member_discount_rate: 25 })).toBe(25);
    expect(getVendorDiscountPercent({ vendor: { member_discount_rate: 30 } })).toBe(30);
    expect(getVendorDiscountPercent({ vendor_member_discount_rate: 12 })).toBe(12);
  });

  it("préfère la forme aplatie du panier quand les deux existent", () => {
    expect(getVendorDiscountPercent({
      vendor_member_discount_rate: 10,
      vendor: { member_discount_rate: 40 },
    })).toBe(10);
  });

  it("accepte zéro comme un vrai taux, pas comme une absence", () => {
    // Le piège classique : `|| DEFAULT` transformerait 0 % en 20 %, donc le
    // vendeur qui a délibérément mis 0 verrait ses prix baisser tout seuls.
    expect(getVendorDiscountPercent({ member_discount_rate: 0 })).toBe(0);
  });

  it("retombe sur la valeur par défaut quand rien n'est renseigné", () => {
    expect(getVendorDiscountPercent(null)).toBe(DEFAULT_MEMBER_DISCOUNT_PERCENT);
    expect(getVendorDiscountPercent({})).toBe(DEFAULT_MEMBER_DISCOUNT_PERCENT);
    expect(getVendorDiscountPercent({ member_discount_rate: "" })).toBe(DEFAULT_MEMBER_DISCOUNT_PERCENT);
  });
});

describe("isVendorDiscountEnabled", () => {
  it("est faux par défaut — on n'applique pas une remise que personne n'a demandée", () => {
    expect(isVendorDiscountEnabled(null)).toBe(false);
    expect(isVendorDiscountEnabled({})).toBe(false);
  });

  it("lit l'interrupteur sous ses trois formes", () => {
    expect(isVendorDiscountEnabled({ member_discount_enabled: true })).toBe(true);
    expect(isVendorDiscountEnabled({ vendor: { member_discount_enabled: true } })).toBe(true);
    expect(isVendorDiscountEnabled({ vendor_member_discount_enabled: true })).toBe(true);
  });
});

describe("applyVendorDiscount", () => {
  it("applique le taux de la boutique", () => {
    expect(applyVendorDiscount(10000, { member_discount_rate: 20 })).toBe(8000);
    expect(applyVendorDiscount(10000, { member_discount_rate: 15 })).toBe(8500);
  });

  it("arrondit au franc — il n'existe pas de centime en FCFA", () => {
    expect(Number.isInteger(applyVendorDiscount(3333, { member_discount_rate: 15 }))).toBe(true);
  });

  it("ne descend jamais en dessous de 30 % du prix, plafond de remise oblige", () => {
    expect(applyVendorDiscount(10000, { member_discount_rate: 99 })).toBe(3000);
  });

  it("traite un prix absent comme zéro plutôt que NaN", () => {
    expect(applyVendorDiscount(undefined, {})).toBe(0);
    expect(applyVendorDiscount("abc", {})).toBe(0);
  });
});

describe("getMemberPrice", () => {
  const boutique = { member_discount_rate: 20 };

  it("remise pour un membre connecté", () => {
    expect(getMemberPrice(10000, true, false, boutique)).toBe(8000);
  });

  it("plein tarif pour un visiteur non connecté", () => {
    expect(getMemberPrice(10000, false, false, boutique)).toBe(10000);
  });

  it("plein tarif pour un vendeur — il n'est pas le client", () => {
    expect(getMemberPrice(10000, true, true, boutique)).toBe(10000);
  });

  it("l'économie affichée correspond à la différence réelle", () => {
    expect(getSavings(10000, true, false, boutique)).toBe(2000);
    expect(getSavings(10000, false, false, boutique)).toBe(0);
  });
});

describe("cohérence taux / pourcentage", () => {
  it("le taux est le pourcentage divisé par cent", () => {
    for (const p of [0, 5, 20, 50, 70]) {
      expect(getVendorDiscountRate({ member_discount_rate: p })).toBeCloseTo(p / 100, 10);
    }
  });
});
