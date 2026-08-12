import React, { useState, useRef, useEffect } from "react";
import SignaturePad from "signature_pad";
import { supabase } from "../lib/supabase";
import { currentPosition } from "../lib/geo";

/* ════════════════════════════════════════════════════════════════════════════
   FICHE DE REMISE

   Quand le client ne peut pas donner son code — téléphone déchargé, colis
   reçu par un voisin, personne qui ne lit pas d'écran — la course doit
   pouvoir se clore quand même, mais pas dans le vide.

   Cette fiche fait office de preuve. Elle demande trois choses qu'on ne
   fabrique pas de loin : une identité, une signature, et une photo du colis
   remis. La base refuse la fiche si l'une manque — autant le dire ici, sur
   le pas de la porte, plutôt qu'au moment du litige.

   Deux façons de la remplir :
     · à l'écran — le réceptionnaire signe du doigt ;
     · sur papier — on photographie la fiche signée avec le colis.
   ════════════════════════════════════════════════════════════════════════════ */

const INK = "#0F1111", MUTED = "#565959", BORDER = "#E3E6E6", ACCENT = "#FF9900";

const ID_TYPES = [
  { key: "cni",       label: "CNI" },
  { key: "passeport", label: "Passeport" },
  { key: "permis",    label: "Permis" },
  { key: "autre",     label: "Autre" },
];

const inputCls = "w-full bg-white border rounded-lg px-3 py-2.5 text-[13px] outline-none focus:border-[#FF9900]";

/* ── Zone de signature ────────────────────────────────────────────────────
   `signature_pad` gère le lissage du trait et le redimensionnement écran ;
   le refaire à la main donnerait un gribouillis anguleux sur mobile. */
const SignatureBox = ({ onChange }) => {
  const canvasRef = useRef(null);
  const padRef    = useRef(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const data = padRef.current && !padRef.current.isEmpty() ? padRef.current.toData() : null;
      canvas.width  = canvas.offsetWidth  * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d").scale(ratio, ratio);
      padRef.current?.clear();
      if (data) padRef.current.fromData(data);
    };

    padRef.current = new SignaturePad(canvas, {
      backgroundColor: "#ffffff", penColor: "#0F1111", minWidth: 0.8, maxWidth: 2.2,
    });
    padRef.current.addEventListener("endStroke", () => {
      setEmpty(false);
      onChange(padRef.current.toDataURL("image/png"));
    });

    resize();
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); padRef.current?.off(); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const clear = () => { padRef.current?.clear(); setEmpty(true); onChange(null); };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: MUTED }}>
          Signature du réceptionnaire
        </span>
        {!empty && (
          <button type="button" onClick={clear} className="text-[10px] font-black uppercase" style={{ color: "#B12704" }}>
            Effacer
          </button>
        )}
      </div>
      <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: empty ? BORDER : "#007600" }}>
        <canvas ref={canvasRef} className="w-full block touch-none" style={{ height: 130 }} />
      </div>
      {empty && (
        <p className="text-[10px] mt-1" style={{ color: MUTED }}>
          Fais signer du doigt sur l'écran.
        </p>
      )}
    </div>
  );
};

/* ── Photo ─────────────────────────────────────────────────────────────── */
const PhotoBox = ({ label, hint, file, onPick }) => {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <label className="block cursor-pointer">
      <span className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color: MUTED }}>
        {label}
      </span>
      <div className="rounded-xl border-2 border-dashed overflow-hidden"
        style={{ borderColor: file ? "#007600" : BORDER }}>
        {preview
          ? <img src={preview} alt="" className="w-full h-28 object-cover" />
          : (
            <div className="h-28 flex flex-col items-center justify-center gap-1" style={{ color: MUTED }}>
              <i className="fa-solid fa-camera text-lg" />
              <span className="text-[11px] font-bold">{hint}</span>
            </div>
          )}
      </div>
      <input type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => onPick(e.target.files?.[0] || null)} />
    </label>
  );
};

const dataUrlToBlob = (dataUrl) => {
  const [head, body] = dataUrl.split(",");
  const mime = head.match(/:(.*?);/)[1];
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
};

const DeliverySlipForm = ({ order, onClose, onDone }) => {
  const [mode,  setMode]  = useState("screen");   // screen | paper
  const [form,  setForm]  = useState({
    recipient_name: order?.client_name || "", recipient_phone: order?.client_phone || "",
    recipient_id_type: "cni", recipient_id_number: "",
    is_third_party: false, relationship: "", note: "",
  });
  const [signature, setSignature] = useState(null);
  const [parcel,    setParcel]    = useState(null);
  const [paper,     setPaper]     = useState(null);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(""); };

  const submit = async () => {
    if (form.recipient_name.trim().length < 3) return setError("Note le nom de la personne qui reçoit.");
    if (!form.recipient_id_number.trim())      return setError("Note le numéro de sa pièce d'identité.");
    if (mode === "screen" && !parcel)          return setError("Prends une photo du colis remis.");
    if (mode === "paper"  && !paper)           return setError("Photographie la fiche papier signée, avec le colis.");

    setBusy(true); setError("");
    try {
      const base = `slips/${order.id}`;
      const put = async (name, blob, ext) => {
        if (!blob) return null;
        const path = `${base}/${name}.${ext}`;
        const { error: e } = await supabase.storage
          .from("delivery-proofs").upload(path, blob, { upsert: true });
        if (e) throw new Error("Envoi des pièces impossible : " + e.message);
        return path;   // seau privé : on garde le chemin, pas une URL publique
      };

      const signatureUrl = signature ? await put("signature", dataUrlToBlob(signature), "png") : null;
      const parcelUrl    = parcel ? await put("parcel", parcel, (parcel.name.split(".").pop() || "jpg")) : null;
      const paperUrl     = paper  ? await put("paper",  paper,  (paper.name.split(".").pop()  || "jpg")) : null;

      // La position au moment de la remise : un élément de plus si l'affaire
      // se discute, et gratuit à récupérer.
      let pos = null;
      try { pos = await currentPosition({ timeout: 6000 }); } catch { /* facultatif */ }

      const { error: e } = await supabase.rpc("advance_course", {
        p_order_id: order.id, p_step: "finish", p_lat: null, p_lng: null, p_code: null,
        p_slip: {
          recipient_name:      form.recipient_name.trim(),
          recipient_phone:     form.recipient_phone.trim() || null,
          recipient_id_type:   form.recipient_id_type,
          recipient_id_number: form.recipient_id_number.trim(),
          is_third_party:      form.is_third_party,
          relationship:        form.relationship.trim() || null,
          signature_url:       signatureUrl,
          parcel_photo_url:    parcelUrl,
          paper_slip_url:      paperUrl,
          lat: pos?.lat ?? null, lng: pos?.lng ?? null,
          note: form.note.trim() || null,
        },
      });
      if (e) throw new Error(e.message);
      onDone?.();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-[1350] flex items-end sm:items-center justify-center p-3"
      style={{ background: "rgba(15,17,17,.5)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-start justify-between gap-3" style={{ borderColor: BORDER }}>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: ACCENT }}>
              Le client ne peut pas donner son code
            </p>
            <p className="font-black text-[15px]" style={{ color: INK }}>Fiche de remise</p>
            <p className="text-[11px] truncate" style={{ color: MUTED }}>
              #{order.order_number || String(order.id).slice(0, 8)} · {order.client_name}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex-shrink-0" style={{ color: MUTED }}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Qui reçoit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color: MUTED }}>
                Nom du réceptionnaire *
              </label>
              <input value={form.recipient_name} onChange={e => set("recipient_name", e.target.value)}
                className={inputCls} style={{ borderColor: BORDER }} placeholder="Comme sur sa pièce d'identité" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color: MUTED }}>
                Téléphone
              </label>
              <input value={form.recipient_phone} onChange={e => set("recipient_phone", e.target.value)}
                inputMode="tel" className={inputCls} style={{ borderColor: BORDER }} placeholder="237 6XX…" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color: MUTED }}>
                N° de pièce *
              </label>
              <input value={form.recipient_id_number} onChange={e => set("recipient_id_number", e.target.value)}
                className={inputCls} style={{ borderColor: BORDER }} placeholder="110234567" />
            </div>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {ID_TYPES.map(t => (
              <button key={t.key} type="button" onClick={() => set("recipient_id_type", t.key)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border"
                style={form.recipient_id_type === t.key
                  ? { background: "#131921", color: ACCENT, borderColor: "#131921" }
                  : { background: "#fff", color: MUTED, borderColor: BORDER }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tiers */}
          <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer"
            style={{ borderColor: BORDER, background: "#F7F8F8" }}>
            <input type="checkbox" checked={form.is_third_party}
              onChange={e => set("is_third_party", e.target.checked)}
              className="w-4 h-4 accent-[#FF9900]" />
            <span>
              <span className="block text-[12px] font-bold" style={{ color: INK }}>
                Ce n'est pas le client lui-même
              </span>
              <span className="block text-[10px]" style={{ color: MUTED }}>
                Voisin, gardien, membre de la famille…
              </span>
            </span>
          </label>
          {form.is_third_party && (
            <input value={form.relationship} onChange={e => set("relationship", e.target.value)}
              className={inputCls} style={{ borderColor: BORDER }}
              placeholder="Lien avec le client — voisine, frère, gardien…" />
          )}

          {/* Fiche à l'écran ou sur papier */}
          <div className="border-t pt-4" style={{ borderColor: "#EAEDED" }}>
            <div className="flex gap-2 mb-3">
              {[["screen", "fa-signature", "Signer à l'écran"], ["paper", "fa-file-lines", "Fiche papier"]].map(([k, ic, lb]) => (
                <button key={k} type="button" onClick={() => { setMode(k); setError(""); }}
                  className="flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border"
                  style={mode === k
                    ? { background: "#131921", color: ACCENT, borderColor: "#131921" }
                    : { background: "#fff", color: MUTED, borderColor: BORDER }}>
                  <i className={`fa-solid ${ic} mr-1.5`} />{lb}
                </button>
              ))}
            </div>

            {mode === "screen" ? (
              <div className="space-y-3">
                <SignatureBox onChange={setSignature} />
                <PhotoBox label="Photo du colis remis *" hint="Le colis, chez le client"
                  file={parcel} onPick={setParcel} />
              </div>
            ) : (
              <PhotoBox label="Fiche papier signée, avec le colis *"
                hint="Photographie la fiche et le colis ensemble"
                file={paper} onPick={setPaper} />
            )}
          </div>

          <div>
            <label className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color: MUTED }}>
              Remarque
            </label>
            <textarea value={form.note} onChange={e => set("note", e.target.value)} rows={2}
              placeholder="Ex : client absent, colis remis à sa sœur au portail"
              className={`${inputCls} resize-none`} style={{ borderColor: BORDER }} />
          </div>

          {error && (
            <p className="text-[12px] font-bold" style={{ color: "#B12704" }}>
              <i className="fa-solid fa-circle-exclamation mr-1.5" />{error}
            </p>
          )}

          <p className="text-[10px] leading-snug" style={{ color: MUTED }}>
            <i className="fa-solid fa-shield-halved mr-1" />
            Cette fiche vaut preuve de remise au même titre que le code. Elle n'est
            visible que par Buyticle, la boutique et le client.
          </p>
        </div>

        <div className="px-5 py-4 border-t flex gap-2" style={{ borderColor: BORDER }}>
          <button onClick={onClose} disabled={busy}
            className="text-[12px] font-bold px-4 py-3 rounded-xl" style={{ color: MUTED }}>
            Annuler
          </button>
          <button onClick={submit} disabled={busy}
            className="flex-1 text-white text-[13px] font-black py-3 rounded-xl disabled:opacity-50"
            style={{ background: "#007600" }}>
            {busy ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Enregistrement…</>
                  : <><i className="fa-solid fa-flag-checkered mr-2" />Clore avec la fiche</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeliverySlipForm;
