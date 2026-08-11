/* ════════════════════════════════════════════════════════════════════════════
   GÉOLOCALISATION — services ouverts, sans clé ni compte

   · Nominatim (OpenStreetMap) : adresse ⇄ coordonnées
   · OSRM (projet OpenStreetMap) : tracé routier réel entre deux points

   Les deux sont gratuits et sans authentification, mais publics : leur usage
   demande de la retenue. On limite donc les appels à 1/s, on met en cache ce
   qui a déjà été demandé, et on abandonne au bout de 8 s plutôt que de laisser
   une carte tourner dans le vide.

   Aucun de ces deux services n'est nécessaire au calcul du prix : celui-ci est
   fait en base par `quote_delivery`. S'ils tombent, la commande passe quand
   même — seule l'aide visuelle disparaît.
   ════════════════════════════════════════════════════════════════════════════ */

const NOMINATIM = "https://nominatim.openstreetmap.org";
const OSRM      = "https://router.project-osrm.org";

// Douala par défaut : la majorité des boutiques y sont.
export const DEFAULT_CENTER = { lat: 4.0511, lng: 9.7679, label: "Douala, Cameroun" };

/* ── File d'attente : un appel par seconde, pas plus ──────────────────────── */
let lastCall = 0;
const throttle = async (ms = 1100) => {
  const wait = Math.max(0, lastCall + ms - Date.now());
  if (wait) await new Promise(r => setTimeout(r, wait));
  lastCall = Date.now();
};

const cache = new Map();
const cached = async (key, fn) => {
  if (cache.has(key)) return cache.get(key);
  const value = await fn();
  cache.set(key, value);
  return value;
};

const fetchJson = async (url, timeout = 8000) => {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
};

/* ── Distance à vol d'oiseau, en km ───────────────────────────────────────────
   Même formule qu'en base (`geo_km`), pour que l'écran et la facture ne se
   contredisent jamais. Sert à l'affichage ; le prix reste calculé en base. */
export const haversineKm = (a, b) => {
  if (!a || !b) return null;
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(h)) * 100) / 100;
};

/* ── Position de l'appareil ──────────────────────────────────────────────────
   Rejette avec un message lisible : « code 1 » n'aide personne. */
export const currentPosition = (options = {}) =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error("Ton navigateur ne sait pas donner ta position."));
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy || 0),
      }),
      err => reject(new Error(
        err.code === 1 ? "Tu as refusé le partage de position. Autorise-le dans les réglages du navigateur."
        : err.code === 2 ? "Position introuvable. Vérifie que le GPS est actif."
        : err.code === 3 ? "La localisation a pris trop de temps. Réessaie."
        : "Impossible de récupérer ta position."
      )),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000, ...options }
    );
  });

/* ── Coordonnées → adresse ───────────────────────────────────────────────── */
export const reverseGeocode = async (lat, lng) => {
  const key = `r:${lat.toFixed(5)},${lng.toFixed(5)}`;
  return cached(key, async () => {
    await throttle();
    try {
      const d = await fetchJson(
        `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=fr&zoom=18`
      );
      const a = d.address || {};
      return {
        label:        d.display_name || null,
        street:       a.road || a.pedestrian || a.footway || "",
        neighborhood: a.neighbourhood || a.suburb || a.quarter || a.city_district || "",
        city:         a.city || a.town || a.village || a.municipality || "",
      };
    } catch { return null; }   // l'adresse est un confort, pas une condition
  });
};

/* ── Adresse → coordonnées ───────────────────────────────────────────────── */
export const searchAddress = async (query, { country = "cm", limit = 5 } = {}) => {
  const q = String(query || "").trim();
  if (q.length < 3) return [];
  return cached(`s:${country}:${q.toLowerCase()}`, async () => {
    await throttle();
    try {
      const d = await fetchJson(
        `${NOMINATIM}/search?format=jsonv2&q=${encodeURIComponent(q)}` +
        `&countrycodes=${country}&limit=${limit}&accept-language=fr&addressdetails=1`
      );
      return (d || []).map(x => ({
        lat: Number(x.lat), lng: Number(x.lon),
        label: x.display_name,
        short: x.name || String(x.display_name || "").split(",")[0],
      }));
    } catch { return []; }
  });
};

/* ── Tracé routier entre plusieurs points ────────────────────────────────────
   Renvoie la ligne à dessiner, la distance et la durée. En cas d'échec, on
   renvoie la ligne droite : une carte avec un trait approximatif reste plus
   utile qu'une carte vide. */
export const routeBetween = async (points) => {
  const valid = (points || []).filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (valid.length < 2) return null;

  const straight = {
    coords: valid.map(p => [p.lat, p.lng]),
    km: valid.slice(1).reduce((s, p, i) => s + (haversineKm(valid[i], p) || 0), 0),
    minutes: null,
    approximate: true,
  };

  const path = valid.map(p => `${p.lng},${p.lat}`).join(";");
  return cached(`o:${path}`, async () => {
    await throttle(400);   // OSRM est plus tolérant que Nominatim
    try {
      const d = await fetchJson(
        `${OSRM}/route/v1/driving/${path}?overview=full&geometries=geojson`
      );
      const r = d?.routes?.[0];
      if (!r) return straight;
      return {
        // GeoJSON donne [lng, lat] ; Leaflet attend [lat, lng].
        coords: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        km: Math.round((r.distance / 1000) * 100) / 100,
        minutes: Math.round(r.duration / 60),
        approximate: false,
      };
    } catch { return straight; }
  });
};

/* ── Mise en forme ───────────────────────────────────────────────────────── */
export const formatKm = (km) =>
  km == null ? "—" : km < 1 ? `${Math.round(km * 1000)} m` : `${Number(km).toFixed(1)} km`;

export const formatDuration = (minutes) => {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
};
