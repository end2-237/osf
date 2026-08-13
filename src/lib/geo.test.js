import { describe, it, expect } from "vitest";
import { haversineKm, formatKm, formatDuration, DEFAULT_CENTER } from "./geo";

/* La distance sert à afficher un trajet et à donner un ordre de grandeur du
   prix avant que la base ne tranche. Une erreur de facteur ici se voit tout de
   suite sur une carte, mais pas forcément sur un chiffre — d'où ces repères
   réels, mesurables sur n'importe quelle carte. */

describe("haversineKm", () => {
  it("donne zéro entre un point et lui-même", () => {
    expect(haversineKm(DEFAULT_CENTER, DEFAULT_CENTER)).toBe(0);
  });

  it("mesure Douala → Yaoundé autour de 200 km à vol d'oiseau", () => {
    const douala  = { lat: 4.0511, lng: 9.7679 };
    const yaounde = { lat: 3.8480, lng: 11.5021 };
    const d = haversineKm(douala, yaounde);
    expect(d).toBeGreaterThan(190);
    expect(d).toBeLessThan(210);
  });

  it("mesure une course urbaine en kilomètres, pas en centaines", () => {
    const akwa     = { lat: 4.0470, lng: 9.7040 };
    const bonaberi = { lat: 4.0700, lng: 9.6800 };
    const d = haversineKm(akwa, bonaberi);
    expect(d).toBeGreaterThan(2);
    expect(d).toBeLessThan(6);
  });

  it("est symétrique", () => {
    const a = { lat: 4.05, lng: 9.76 }, b = { lat: 3.87, lng: 11.52 };
    expect(haversineKm(a, b)).toBe(haversineKm(b, a));
  });

  it("rend null plutôt que NaN quand un point manque", () => {
    // Un null se teste ; un NaN se propage silencieusement dans un prix.
    expect(haversineKm(null, DEFAULT_CENTER)).toBeNull();
    expect(haversineKm(DEFAULT_CENTER, undefined)).toBeNull();
  });

  it("arrondit au décamètre", () => {
    const d = haversineKm({ lat: 4.0511, lng: 9.7679 }, { lat: 4.0611, lng: 9.7779 });
    expect(Math.round(d * 100)).toBe(d * 100);
  });
});

describe("formatKm", () => {
  it("passe en mètres sous le kilomètre", () => {
    expect(formatKm(0.4)).toBe("400 m");
    expect(formatKm(0.05)).toBe("50 m");
  });

  it("garde une décimale au-delà", () => {
    expect(formatKm(1)).toBe("1.0 km");
    expect(formatKm(12.34)).toBe("12.3 km");
  });

  it("affiche un tiret quand la distance est inconnue", () => {
    expect(formatKm(null)).toBe("—");
    expect(formatKm(undefined)).toBe("—");
  });

  it("affiche zéro en mètres, pas un tiret", () => {
    // Zéro kilomètre est une information ; l'absence de mesure en est une autre.
    expect(formatKm(0)).toBe("0 m");
  });
});

describe("formatDuration", () => {
  it("reste en minutes sous l'heure", () => {
    expect(formatDuration(25)).toBe("25 min");
  });

  it("passe en heures au-delà, avec les minutes sur deux chiffres", () => {
    expect(formatDuration(60)).toBe("1 h 00");
    expect(formatDuration(95)).toBe("1 h 35");
    expect(formatDuration(125)).toBe("2 h 05");
  });

  it("affiche un tiret quand la durée est inconnue", () => {
    expect(formatDuration(null)).toBe("—");
  });
});
