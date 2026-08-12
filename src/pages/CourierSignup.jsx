import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { LOGO_URL } from "../lib/brand";
import LiveSelfie from "../components/LiveSelfie";

/* ════════════════════════════════════════════════════════════════════════════
   DEVENIR LIVREUR — parcours en étapes

   Un livreur porte des colis et parfois du cash. On ne l'inscrit donc pas
   comme un client : il monte un dossier qu'un administrateur examine avant
   d'ouvrir l'accès.

   En étapes plutôt qu'en formulaire d'un bloc : douze champs et quatre photos
   sur un seul écran font abandonner, surtout au téléphone. Chaque étape tient
   dans un pouce, et on ne peut pas avancer sans l'avoir remplie — l'erreur se
   voit là où on la fait, pas après avoir tout saisi.

   La photo du visage est prise EN DIRECT, comme pour les vendeurs : une image
   choisie dans la galerie ne prouve rien.
   ════════════════════════════════════════════════════════════════════════════ */

const INK = "#0F1111", DARK = "#131921", ACCENT = "#FF9900", MUTED = "#565959", BORDER = "#D5D9D9";

const VEHICLES = [
  { key: "moto",     label: "Moto",     icon: "fa-motorcycle" },
  { key: "tricycle", label: "Tricycle", icon: "fa-truck-pickup" },
  { key: "voiture",  label: "Voiture",  icon: "fa-car" },
  { key: "velo",     label: "Vélo",     icon: "fa-bicycle" },
  { key: "pieds",    label: "À pied",   icon: "fa-person-walking" },
];

const ID_TYPES = [
  { key: "cni",       label: "Carte nationale" },
  { key: "passeport", label: "Passeport" },
  { key: "permis",    label: "Permis de conduire" },
];

const EMPTY = {
  full_name: "", phone: "", email: "", password: "", confirm: "", city: "Douala",
  vehicle_type: "moto", vehicle_plate: "", id_type: "cni", id_number: "",
};

const inputCls = "w-full bg-white border rounded-xl px-4 py-3 text-[15px] outline-none focus:border-[#FF9900] transition-colors";

const Field = ({ label, hint, children }) => (
  <div>
    <label className="text-[10px] font-black uppercase tracking-widest block mb-1.5" style={{ color: MUTED }}>
      {label}
    </label>
    {children}
    {hint && <p className="text-[11px] mt-1.5" style={{ color: MUTED }}>{hint}</p>}
  </div>
);

/* Photo de document : la galerie est acceptée — on photographie souvent sa
   pièce d'identité à l'avance, et c'est le contenu qui compte, pas l'instant. */
const DocShot = ({ label, hint, file, onPick }) => {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <label className="block cursor-pointer">
      <span className="text-[10px] font-black uppercase tracking-widest block mb-1.5" style={{ color: MUTED }}>
        {label}
      </span>
      <div className="rounded-2xl border-2 border-dashed overflow-hidden"
        style={{ borderColor: file ? "#007600" : BORDER }}>
        {preview ? (
          <div className="relative">
            <img src={preview} alt="" className="w-full h-36 object-cover" />
            <span className="absolute bottom-2 right-2 bg-white/95 text-[10px] font-black uppercase px-2 py-1 rounded-lg"
              style={{ color: "#007600" }}><i className="fa-solid fa-check mr-1" />Ajoutée</span>
          </div>
        ) : (
          <div className="h-36 flex flex-col items-center justify-center gap-1.5" style={{ color: MUTED }}>
            <i className="fa-solid fa-camera text-xl" />
            <span className="text-[12px] font-bold">{hint}</span>
          </div>
        )}
      </div>
      <input type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => onPick(e.target.files?.[0] || null)} />
    </label>
  );
};

const Shell = ({ children }) => (
  <div className="min-h-screen py-6 px-4" style={{ background: "#F3F4F4" }}>
    <div className="mx-auto max-w-lg">
      <Link to="/" className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: DARK }}>
          <img src={LOGO_URL} alt="" className="w-5 h-5 object-contain" />
        </div>
        <span className="font-black text-[15px]" style={{ color: INK }}>
          Buyticle<span style={{ color: ACCENT }}>Delivery</span>
        </span>
      </Link>
      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "#E3E6E6" }}>
        {children}
      </div>
    </div>
  </div>
);

const CourierSignup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step,  setStep]  = useState(0);
  const [form,  setForm]  = useState(EMPTY);
  const [docs,  setDocs]  = useState({ id_front: null, id_back: null, licence: null });
  const [selfie, setSelfie] = useState(null);       // { blob, preview }
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");
  const [done,  setDone]  = useState(false);
  const [existing, setExisting] = useState(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("courier_applications")
      .select("status, review_note, submitted_at").eq("user_id", user.id)
      .order("submitted_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setExisting(data || null));
    setForm(f => ({ ...f, email: user.email || f.email }));
  }, [user]);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(""); };
  const needsVehicle = !["pieds", "velo"].includes(form.vehicle_type);
  const phone = form.phone.replace(/\D/g, "");

  // Un compte connecté saute l'étape « créer un compte ».
  const STEPS = [
    ...(user ? [] : [{ key: "compte",   label: "Compte",   icon: "fa-user-plus" }]),
    { key: "identite", label: "Identité", icon: "fa-id-card" },
    { key: "vehicule", label: "Véhicule", icon: "fa-motorcycle" },
    { key: "piece",    label: "Pièce",    icon: "fa-passport" },
    { key: "visage",   label: "Visage",   icon: "fa-camera" },
    { key: "envoi",    label: "Envoi",    icon: "fa-paper-plane" },
  ];
  const current = STEPS[step]?.key;

  // Ce qui manque à l'étape courante. On le dit à l'écran plutôt que de
  // désactiver un bouton sans expliquer pourquoi.
  const blocking = () => {
    if (current === "compte") {
      if (!form.email.trim())              return "Indique une adresse e-mail.";
      if (form.password.length < 6)        return "Le mot de passe doit faire 6 caractères au moins.";
      if (form.password !== form.confirm)  return "Les deux mots de passe ne correspondent pas.";
    }
    if (current === "identite") {
      if (form.full_name.trim().length < 3) return "Indique ton nom complet.";
      if (!/^[0-9]{8,15}$/.test(phone))     return "Le téléphone doit contenir 8 à 15 chiffres.";
    }
    if (current === "piece") {
      if (!form.id_number.trim()) return "Le numéro de ta pièce d'identité est obligatoire.";
      if (!docs.id_front)         return "Ajoute la photo recto de ta pièce.";
    }
    if (current === "visage" && !selfie) return "Prends ta photo avec la caméra.";
    return null;
  };

  const next = () => {
    const why = blocking();
    if (why) return setError(why);
    setError("");
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => { setError(""); setStep(s => Math.max(s - 1, 0)); };

  const submit = async () => {
    setBusy(true); setError("");
    try {
      let userId = user?.id || null;
      if (!userId) {
        const { data, error: e } = await supabase.auth.signUp({
          email: form.email.trim(), password: form.password,
          options: { data: { full_name: form.full_name.trim() } },
        });
        if (e) throw new Error(e.message);
        userId = data?.user?.id || null;
      }

      const base = `couriers/${userId || phone}-${Date.now()}`;
      const put = async (name, file, opts) => {
        if (!file) return null;
        const { error: e } = await supabase.storage
          .from("kyc-documents").upload(`${base}/${name}`, file, { upsert: true, ...opts });
        if (e) throw new Error("Envoi des documents impossible : " + e.message);
        return supabase.storage.from("kyc-documents").getPublicUrl(`${base}/${name}`).data.publicUrl;
      };

      const ext = (f) => (f?.name?.split(".").pop() || "jpg").toLowerCase();
      const idFront = await put(`id-front.${ext(docs.id_front)}`, docs.id_front);
      const idBack  = await put(`id-back.${ext(docs.id_back)}`,  docs.id_back);
      const licence = await put(`licence.${ext(docs.licence)}`,  docs.licence);
      const face    = await put("selfie.jpg", selfie?.blob, { contentType: "image/jpeg" });

      const { error: e2 } = await supabase.from("courier_applications").insert({
        user_id: userId,
        full_name: form.full_name.trim(),
        phone,
        email: form.email.trim() || null,
        city: form.city.trim() || "Douala",
        vehicle_type: form.vehicle_type,
        vehicle_plate: needsVehicle ? (form.vehicle_plate.trim() || null) : null,
        id_type: form.id_type,
        id_number: form.id_number.trim(),
        id_front_url: idFront, id_back_url: idBack,
        selfie_url: face, licence_url: licence,
      });
      if (e2) throw new Error(e2.message);
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  /* ── Dossier déjà là ────────────────────────────────────────────────── */
  if (done || existing?.status === "pending") return (
    <Shell>
      <div className="p-8 text-center">
        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "#FFF8D3" }}>
          <i className="fa-solid fa-hourglass-half text-xl" style={{ color: "#B26200" }} />
        </div>
        <h1 className="font-black text-lg mb-2" style={{ color: INK }}>Dossier reçu</h1>
        <p className="text-[13px] leading-relaxed mb-6" style={{ color: MUTED }}>
          Buyticle vérifie ton identité. Réponse sous 48 h ouvrées. Une fois validé,
          la console de livraison s'ouvre avec ton compte habituel.
        </p>
        <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px] text-white"
          style={{ background: DARK }}><i className="fa-solid fa-house text-[12px]" />Retour à l'accueil</Link>
      </div>
    </Shell>
  );

  if (existing?.status === "approved") return (
    <Shell>
      <div className="p-8 text-center">
        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "#E8F5E8" }}>
          <i className="fa-solid fa-check text-xl" style={{ color: "#007600" }} />
        </div>
        <h1 className="font-black text-lg mb-2" style={{ color: INK }}>Tu es livreur Buyticle</h1>
        <p className="text-[13px] leading-relaxed mb-6" style={{ color: MUTED }}>
          Ton dossier a été validé. Tes courses t'attendent dans la console.
        </p>
        <button onClick={() => navigate("/delivery")}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px] text-white"
          style={{ background: ACCENT }}><i className="fa-solid fa-truck-fast text-[12px]" />Ouvrir mes courses</button>
      </div>
    </Shell>
  );

  /* ── Le parcours ────────────────────────────────────────────────────── */
  return (
    <Shell>
      {/* Progression */}
      <div className="px-5 pt-5">
        <div className="flex items-center gap-1.5 mb-4">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.key}>
              {i > 0 && <span className="flex-1 h-[3px] rounded-full"
                style={{ background: i <= step ? ACCENT : "#EDEFEF" }} />}
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] flex-shrink-0"
                title={s.label}
                style={i < step ? { background: ACCENT, color: "#fff" }
                     : i === step ? { background: "#FFF3E0", color: "#B26200" }
                     : { background: "#EDEFEF", color: "#C9CDCD" }}>
                <i className={`fa-solid ${i < step ? "fa-check" : s.icon}`} />
              </span>
            </React.Fragment>
          ))}
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.25em] mb-1" style={{ color: ACCENT }}>
          Étape {step + 1} sur {STEPS.length}
        </p>
      </div>

      {existing?.status === "rejected" && step === 0 && (
        <div className="mx-5 mb-3 rounded-xl px-4 py-3" style={{ background: "#FEE7E5", border: "1px solid rgba(177,39,4,.3)" }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "#B12704" }}>
            Dossier précédent refusé
          </p>
          <p className="text-[12px]" style={{ color: INK }}>{existing.review_note}</p>
        </div>
      )}

      <div className="px-5 pb-5 space-y-4">
        {current === "compte" && (
          <>
            <h1 className="font-black text-xl leading-tight" style={{ color: INK }}>Crée ton compte</h1>
            <p className="text-[13px]" style={{ color: MUTED }}>
              Il te servira à ouvrir la console et à suivre tes courses.
            </p>
            <Field label="E-mail">
              <input value={form.email} onChange={e => set("email", e.target.value)} type="email"
                placeholder="toi@exemple.com" className={inputCls} style={{ borderColor: BORDER }} />
            </Field>
            <Field label="Mot de passe">
              <input value={form.password} onChange={e => set("password", e.target.value)} type="password"
                placeholder="6 caractères minimum" className={inputCls} style={{ borderColor: BORDER }} />
            </Field>
            <Field label="Confirme le mot de passe">
              <input value={form.confirm} onChange={e => set("confirm", e.target.value)} type="password"
                placeholder="Le même" className={inputCls} style={{ borderColor: BORDER }} />
            </Field>
          </>
        )}

        {current === "identite" && (
          <>
            <h1 className="font-black text-xl leading-tight" style={{ color: INK }}>Qui es-tu ?</h1>
            <p className="text-[13px]" style={{ color: MUTED }}>
              Le nom doit être celui de ta pièce d'identité.
            </p>
            <Field label="Nom complet">
              <input value={form.full_name} onChange={e => set("full_name", e.target.value)}
                placeholder="Robert Ndongo" className={inputCls} style={{ borderColor: BORDER }} />
            </Field>
            <Field label="Téléphone" hint="C'est par là que les boutiques t'appellent.">
              <input value={form.phone} onChange={e => set("phone", e.target.value)} inputMode="tel"
                placeholder="237 6XX XXX XXX" className={inputCls} style={{ borderColor: BORDER }} />
            </Field>
            <Field label="Ville">
              <input value={form.city} onChange={e => set("city", e.target.value)}
                placeholder="Douala" className={inputCls} style={{ borderColor: BORDER }} />
            </Field>
          </>
        )}

        {current === "vehicule" && (
          <>
            <h1 className="font-black text-xl leading-tight" style={{ color: INK }}>Comment tu livres ?</h1>
            <p className="text-[13px]" style={{ color: MUTED }}>
              Ça décide des courses qu'on peut te confier.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {VEHICLES.map(v => (
                <button key={v.key} type="button" onClick={() => set("vehicle_type", v.key)}
                  className="px-4 py-3.5 rounded-xl text-[13px] font-bold border-2 text-left flex items-center gap-3 transition-colors"
                  style={form.vehicle_type === v.key
                    ? { background: DARK, color: "#fff", borderColor: DARK }
                    : { background: "#fff", color: INK, borderColor: BORDER }}>
                  <i className={`fa-solid ${v.icon}`}
                    style={{ color: form.vehicle_type === v.key ? ACCENT : MUTED }} />
                  {v.label}
                </button>
              ))}
            </div>
            {needsVehicle && (
              <Field label="Plaque d'immatriculation" hint="Facultatif, mais ça rassure les boutiques.">
                <input value={form.vehicle_plate} onChange={e => set("vehicle_plate", e.target.value)}
                  placeholder="LT 1234 AB" className={inputCls} style={{ borderColor: BORDER }} />
              </Field>
            )}
          </>
        )}

        {current === "piece" && (
          <>
            <h1 className="font-black text-xl leading-tight" style={{ color: INK }}>Ta pièce d'identité</h1>
            <p className="text-[13px]" style={{ color: MUTED }}>
              Visible seulement par l'équipe Buyticle. Elle sert à te retrouver si un colis disparaît.
            </p>
            <div className="flex gap-2 flex-wrap">
              {ID_TYPES.map(t => (
                <button key={t.key} type="button" onClick={() => set("id_type", t.key)}
                  className="px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border-2"
                  style={form.id_type === t.key
                    ? { background: DARK, color: ACCENT, borderColor: DARK }
                    : { background: "#fff", color: MUTED, borderColor: BORDER }}>
                  {t.label}
                </button>
              ))}
            </div>
            <Field label="Numéro de la pièce">
              <input value={form.id_number} onChange={e => set("id_number", e.target.value)}
                placeholder="110234567" className={inputCls} style={{ borderColor: BORDER }} />
            </Field>
            <DocShot label="Recto" hint="La face avec ta photo"
              file={docs.id_front} onPick={f => { setDocs(d => ({ ...d, id_front: f })); setError(""); }} />
            <DocShot label="Verso (facultatif)" hint="L'autre face"
              file={docs.id_back} onPick={f => setDocs(d => ({ ...d, id_back: f }))} />
            {needsVehicle && (
              <DocShot label="Permis de conduire (facultatif)" hint="Si tu en as un"
                file={docs.licence} onPick={f => setDocs(d => ({ ...d, licence: f }))} />
            )}
          </>
        )}

        {current === "visage" && (
          <>
            <h1 className="font-black text-xl leading-tight" style={{ color: INK }}>Ta photo</h1>
            <p className="text-[13px]" style={{ color: MUTED }}>
              Prise maintenant, avec ta caméra. Elle sera comparée à ta pièce d'identité.
            </p>
            <LiveSelfie value={selfie} onCapture={(v) => { setSelfie(v); setError(""); }} accent={ACCENT} />
          </>
        )}

        {current === "envoi" && (
          <>
            <h1 className="font-black text-xl leading-tight" style={{ color: INK }}>Vérifie, puis envoie</h1>
            <div className="rounded-2xl border divide-y" style={{ borderColor: BORDER }}>
              {[
                ["Nom",       form.full_name],
                ["Téléphone", form.phone],
                ["Ville",     form.city],
                ["Véhicule",  VEHICLES.find(v => v.key === form.vehicle_type)?.label
                              + (form.vehicle_plate ? ` · ${form.vehicle_plate}` : "")],
                ["Pièce",     `${ID_TYPES.find(t => t.key === form.id_type)?.label} n° ${form.id_number}`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: MUTED }}>{k}</span>
                  <span className="text-[13px] font-bold text-right" style={{ color: INK }}>{v || "—"}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[["Recto", docs.id_front], ["Verso", docs.id_back], ["Visage", selfie?.blob]].map(([k, f]) => (
                <div key={k} className="rounded-xl border px-2 py-3 text-center" style={{ borderColor: BORDER }}>
                  <i className={`fa-solid ${f ? "fa-circle-check" : "fa-circle-minus"} text-[15px]`}
                    style={{ color: f ? "#007600" : "#C9CDCD" }} />
                  <p className="text-[10px] font-black uppercase tracking-wider mt-1" style={{ color: MUTED }}>{k}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] leading-snug" style={{ color: MUTED }}>
              <i className="fa-solid fa-lock mr-1.5" />
              Tes documents ne sont visibles que par l'équipe Buyticle.
            </p>
          </>
        )}

        {error && (
          <p className="text-[12px] font-bold" style={{ color: "#B12704" }}>
            <i className="fa-solid fa-circle-exclamation mr-1.5" />{error}
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="px-5 py-4 border-t flex gap-2" style={{ borderColor: "#EAEDED", background: "#FAFAFA" }}>
        {step > 0 && (
          <button onClick={back} disabled={busy}
            className="px-4 py-3 rounded-xl text-[12px] font-bold" style={{ color: MUTED }}>
            <i className="fa-solid fa-chevron-left mr-1.5" />Retour
          </button>
        )}
        {current === "envoi" ? (
          <button onClick={submit} disabled={busy}
            className="flex-1 py-3 rounded-xl font-black text-[13px] disabled:opacity-50"
            style={{ background: ACCENT, color: INK }}>
            {busy ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Envoi du dossier…</>
                  : <><i className="fa-solid fa-paper-plane mr-2" />Envoyer mon dossier</>}
          </button>
        ) : (
          <button onClick={next}
            className="flex-1 py-3 rounded-xl font-black text-[13px] text-white"
            style={{ background: DARK }}>
            Continuer<i className="fa-solid fa-chevron-right ml-1.5" />
          </button>
        )}
      </div>
    </Shell>
  );
};

export default CourierSignup;
