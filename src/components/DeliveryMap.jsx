import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ════════════════════════════════════════════════════════════════════════════
   CARTE — Leaflet + tuiles OpenStreetMap, sans clé ni compte

   Deux fonds au choix : `dark` pour le module de suivi, `light` pour la saisie
   d'adresse où le client doit reconnaître son quartier.

   Les marqueurs par défaut de Leaflet chargent des images depuis le dossier du
   paquet, ce qui casse une fois le site bundlé. On dessine donc les nôtres en
   HTML (divIcon) : pas d'images à charger, et ils suivent nos couleurs.
   ════════════════════════════════════════════════════════════════════════════ */

const TILES = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
  },
};

// Épingle en HTML : un cercle coloré, une icône dedans, une pointe dessous.
const pinIcon = (color, icon, label) => L.divIcon({
  className: "",
  html: `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center">
      <div style="width:34px;height:34px;border-radius:12px;background:${color};
                  display:flex;align-items:center;justify-content:center;
                  box-shadow:0 4px 14px rgba(0,0,0,.35);border:2px solid #fff">
        <i class="fa-solid ${icon}" style="color:#fff;font-size:13px"></i>
      </div>
      <div style="width:2px;height:10px;background:${color}"></div>
      ${label ? `<div style="margin-top:2px;background:#fff;color:#0F1111;font-size:10px;
                   font-weight:800;padding:2px 7px;border-radius:999px;white-space:nowrap;
                   box-shadow:0 2px 8px rgba(0,0,0,.2)">${label}</div>` : ""}
    </div>`,
  iconSize:   [34, label ? 62 : 46],
  iconAnchor: [17, label ? 62 : 46],
});

const DeliveryMap = ({
  markers  = [],          // [{ lat, lng, color, icon, label, id }]
  route    = null,        // [[lat, lng], …]
  center   = null,
  zoom     = 13,
  theme    = "dark",
  routeColor = "#FF9900",
  onPick   = null,        // (lat, lng) → clic sur la carte
  onReady  = null,        // (map) → pour piloter le zoom depuis l'extérieur
  draggableMarker = false,
  className = "",
  interactive = true,
}) => {
  const host      = useRef(null);
  const mapRef    = useRef(null);
  const layerRef  = useRef(null);
  const lineRef   = useRef(null);
  const onPickRef  = useRef(onPick);
  const onReadyRef = useRef(onReady);

  useEffect(() => { onPickRef.current  = onPick;  }, [onPick]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  // Création : une seule fois. Leaflet n'aime pas être recréé à chaque rendu.
  useEffect(() => {
    if (!host.current || mapRef.current) return;
    const t = TILES[theme] || TILES.dark;
    const map = L.map(host.current, {
      zoomControl: false,
      attributionControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
    }).setView([center?.lat ?? 4.0511, center?.lng ?? 9.7679], zoom);

    L.tileLayer(t.url, { attribution: t.attribution, maxZoom: 19 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    onReadyRef.current?.(map);

    map.on("click", (e) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));

    // Le conteneur est souvent encore en train de se dimensionner au montage.
    const fix = () => map.invalidateSize();
    const ro = new ResizeObserver(fix);
    ro.observe(host.current);
    setTimeout(fix, 200);

    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // Marqueurs
  useEffect(() => {
    const map = mapRef.current, group = layerRef.current;
    if (!map || !group) return;
    group.clearLayers();

    markers
      .filter(m => Number.isFinite(m?.lat) && Number.isFinite(m?.lng))
      .forEach(m => {
        const mk = L.marker([m.lat, m.lng], {
          icon: pinIcon(m.color || "#FF9900", m.icon || "fa-location-dot", m.label),
          draggable: !!(draggableMarker && m.draggable !== false),
        }).addTo(group);
        if (m.title) mk.bindPopup(m.title);
        if (draggableMarker && m.draggable !== false) {
          mk.on("dragend", (e) => {
            const { lat, lng } = e.target.getLatLng();
            onPickRef.current?.(lat, lng);
          });
        }
      });
  }, [markers, draggableMarker]);

  // Tracé
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lineRef.current) { lineRef.current.remove(); lineRef.current = null; }
    if (!route?.length) return;

    lineRef.current = L.polyline(route, {
      color: routeColor, weight: 5, opacity: 0.9, lineJoin: "round",
    }).addTo(map);
  }, [route, routeColor]);

  // Cadrage : on englobe tout ce qu'il y a à voir.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pts = [
      ...markers.filter(m => Number.isFinite(m?.lat) && Number.isFinite(m?.lng))
                .map(m => [m.lat, m.lng]),
      ...(route || []),
    ];
    if (pts.length > 1)      map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 16 });
    else if (pts.length === 1) map.setView(pts[0], Math.max(zoom, 15));
    else if (center)         map.setView([center.lat, center.lng], zoom);
  }, [markers, route, center, zoom]);

  return <div ref={host} className={className} style={{ background: theme === "dark" ? "#1a1a1a" : "#e8e8e8" }} />;
};

export default DeliveryMap;
