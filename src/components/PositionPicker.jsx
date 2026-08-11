import React, { useState, useEffect, useCallback } from "react";
import DeliveryMap from "./DeliveryMap";
import { currentPosition, reverseGeocode, DEFAULT_CENTER } from "../lib/geo";

/* ════════════════════════════════════════════════════════════════════════════
   ENREGISTRER UN POINT SUR LA CARTE

   Une adresse écrite ne suffit pas à un livreur : « Rue Njo Njo » compte des
   dizaines de portails. Ce bloc capture le point exact, par le GPS ou en
   déplaçant l'épingle, et retrouve l'adresse correspondante pour que la
   personne reconnaisse l'endroit avant d'enregistrer.

   Le composant ne parle à aucune base : il remonte { lat, lng, label } et
   laisse l'écran qui l'accueille décider quoi en faire.
   ════════════════════════════════════════════════════════════════════════════ */

const PositionPicker = ({
  value,                      // { lat, lng, label } | null
  onChange,
  onAddressFound = null,      // (adresse détaillée) → pré-remplir un formulaire
  height = 200,
  accent = "#FF9900",
  title = "Position exacte",
  hint  = "Le livreur ira à ce point précis, pas au milieu du quartier.",
}) => {
  const [busy,   setBusy]   = useState(false);
  const [error,  setError]  = useState("");
  const [label,  setLabel]  = useState(value?.label || "");
  const [open,   setOpen]   = useState(!!value?.lat);

  const hasPoint = Number.isFinite(value?.lat) && Number.isFinite(value?.lng);

  // Retrouver l'adresse d'un point. Silencieux en cas d'échec : le point reste
  // valable même si Nominatim ne répond pas.
  const describe = useCallback(async (lat, lng) => {
    const a = await reverseGeocode(lat, lng);
    if (!a) return;
    setLabel(a.label || "");
    onChange?.({ lat, lng, label: a.label || null });
    onAddressFound?.(a);
  }, [onChange, onAddressFound]);

  useEffect(() => {
    if (hasPoint && !label) describe(value.lat, value.lng);
  }, [hasPoint]);   // eslint-disable-line react-hooks/exhaustive-deps

  const locate = async () => {
    setBusy(true); setError("");
    try {
      const pos = await currentPosition();
      setOpen(true);
      onChange?.({ lat: pos.lat, lng: pos.lng, label: null });
      await describe(pos.lat, pos.lng);
    } catch (e) {
      setError(e.message);
      setOpen(true);          // on ouvre quand même : l'épingle reste posable à la main
    } finally { setBusy(false); }
  };

  const place = (lat, lng) => {
    setError("");
    onChange?.({ lat, lng, label: null });
    describe(lat, lng);
  };

  const clear = () => { onChange?.(null); setLabel(""); setError(""); };

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#D5D9D9" }}>
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: "#F7F8F8" }}>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "#0F1111" }}>
            {title}
            {hasPoint && (
              <span className="ml-2 text-[9px] px-2 py-0.5 rounded-full"
                style={{ background: "#E8F5E8", color: "#007600" }}>Enregistrée</span>
            )}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "#565959" }}>{hint}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={locate} disabled={busy}
            className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg text-white disabled:opacity-50"
            style={{ background: accent }}>
            <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-crosshairs"} mr-1.5`} />
            {busy ? "Localisation…" : "Ma position"}
          </button>
          <button type="button" onClick={() => setOpen(o => !o)}
            className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border"
            style={{ borderColor: "#D5D9D9", color: "#565959" }}>
            {open ? "Masquer" : "Carte"}
          </button>
        </div>
      </div>

      {open && (
        <>
          {/* Hauteur portée par l'enveloppe : une règle CSS globale sur
              .leaflet-container écraserait toutes les autres cartes de la page. */}
          <div style={{ height }}>
            <DeliveryMap
              theme="light" zoom={hasPoint ? 16 : 12}
              center={hasPoint ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER}
              markers={hasPoint ? [{ lat: value.lat, lng: value.lng, color: accent, icon: "fa-house" }] : []}
              draggableMarker onPick={place}
              className="w-full h-full"
            />
          </div>

          <div className="px-4 py-3 space-y-1.5">
            {error && (
              <p className="text-[10px] font-bold" style={{ color: "#B12704" }}>
                <i className="fa-solid fa-circle-exclamation mr-1.5" />{error}
              </p>
            )}
            {hasPoint ? (
              <>
                <p className="text-[11px] leading-snug" style={{ color: "#0F1111" }}>
                  {label || "Adresse en cours de recherche…"}
                </p>
                <div className="flex items-center gap-3">
                  <p className="text-[10px] font-mono" style={{ color: "#565959" }}>
                    {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
                  </p>
                  <button type="button" onClick={clear}
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: "#B12704" }}>Retirer</button>
                </div>
              </>
            ) : (
              <p className="text-[11px]" style={{ color: "#565959" }}>
                Touche la carte, ou déplace l'épingle, pour poser le point.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PositionPicker;
