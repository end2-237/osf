import { describe, it, expect } from "vitest";
import { agreger, noteAffichable } from "./productRatings";

describe("agreger", () => {
  it("fait la moyenne et compte les avis par produit", () => {
    const out = agreger([
      { product_id: "a", rating: 5 },
      { product_id: "a", rating: 4 },
      { product_id: "b", rating: 3 },
    ]);
    expect(out.a).toEqual({ moy: 4.5, n: 2 });
    expect(out.b).toEqual({ moy: 3, n: 1 });
  });

  it("arrondit la moyenne au dixième", () => {
    const out = agreger([
      { product_id: "a", rating: 5 },
      { product_id: "a", rating: 4 },
      { product_id: "a", rating: 4 },
    ]);
    expect(out.a.moy).toBe(4.3);           // 4,333… → 4,3
  });

  it("ignore les notes hors barème et les lignes sans produit", () => {
    const out = agreger([
      { product_id: "a", rating: 5 },
      { product_id: "a", rating: 0 },      // hors barème
      { product_id: "a", rating: 9 },      // hors barème
      { product_id: "a", rating: null },
      { product_id: null, rating: 5 },
      null,
    ]);
    expect(out.a).toEqual({ moy: 5, n: 1 });
  });

  it("ne renvoie rien pour une liste vide", () => {
    expect(agreger([])).toEqual({});
    expect(agreger()).toEqual({});
  });
});

describe("noteAffichable", () => {
  it("préfère les avis Buyticle à ceux du fournisseur", () => {
    const r = noteAffichable({ rating_avg: 4.8, review_count: 300 }, { moy: 3, n: 2 });
    expect(r).toEqual({ rating: 3, count: 2, source: "buyticle" });
  });

  it("retombe sur le fournisseur quand aucun avis Buyticle", () => {
    const r = noteAffichable({ rating_avg: 4.8, review_count: 300 }, { moy: 0, n: 0 });
    expect(r).toEqual({ rating: 4.8, count: 300, source: "fournisseur" });
  });

  it("ne renvoie rien quand personne n'a noté — jamais de note inventée", () => {
    expect(noteAffichable({}, { moy: 0, n: 0 })).toBeNull();
    expect(noteAffichable({ rating_avg: 4.2, review_count: 0 }, { moy: 0, n: 0 })).toBeNull();
    expect(noteAffichable(null, null)).toBeNull();
  });

  it("ignore un compte fournisseur nul même si une moyenne traîne", () => {
    // C'est précisément le cas qui affichait « 4,2 étoiles (0 avis) ».
    expect(noteAffichable({ rating_avg: 4.2, review_count: 0 }, null)).toBeNull();
  });
});
