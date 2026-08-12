import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { LOGO_URL } from "../lib/brand";

/* ════════════════════════════════════════════════════════════════════════════
   DEVENIR LIVREUR

   Un livreur porte des colis et parfois du cash. On ne l'inscrit donc pas
   comme un client : il dépose un dossier — identité recto-verso, visage,
   véhicule — qu'un administrateur examine avant d'ouvrir l'accès.

   Le formulaire marche pour quelqu'un qui n'a pas encore de compte : il en
   crée un au passage. Déjà connecté, on saute cette étape plutôt que de
   redemander un mot de passe.

   Les pièces partent dans `kyc-documents`, qui est privé. Rien de tout ça
   n'est public, et le dossier ne devient une fiche livreur qu'à l'approbation.
   ════════════════════════════════════════════════════════════════════════════ */

const INK = "#0F1111", DARK = "#131921", ACCENT = "#FF9900", MUTED = "#565959", BORDER = "#D5D9D9";

const VEHICLES = [
  { key: "moto",     label: "Moto",       icon: "fa-motorcycle" },
  { key: "tricycle", label: "Tricycle",   icon: "fa-truck-pickup" },
  { key: "voiture",  label: "Voiture",    icon: "fa-car" },
  { key: "velo",     label: "Vélo",       icon: "fa-bicycle" },
  { key: "pieds",    label: "À pied",     icon: "fa-person-walking" },
];

const ID_TYPES = [
  { key: "cni",       label: "Carte nationale" },
  { key: "passeport", label: "Passeport" },
  { key: "permis",    label: "Permis de conduire" },
];

const EMPTY = {
  full_name: "", phone: "", email: "", password: "", city: "Douala",
  vehicle_type: "moto", vehicle_plate: "",
  id_type: "cni", id_number: "",
};

const Field = ({ label, hint, children }) => (
  <div>
    <label className="text-[9px] font-black uppercase tracking-widest block mb-1.5" style={{ color: MUTED }}>
      {label}
    </label>
    {children}
    {hint && <p className="text-[10px] mt-1" style={{ color: MUTED }}>{hint}</p>}
  </div>
);

const inputCls = "w-full bg-white border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#FF9900] transition-colors";

/* Une pièce jointe : aperçu immédiat, parce qu'une photo de CNI floue se
   repère à l'œil et pas au nom de fichier. */
const FileDrop = ({ label, file, onPick, required }) => {
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
        {label}{required && " *"}
      </span>
      <div className="rounded-xl border-2 border-dashed overflow-hidden transition-colors"
        style={{ borderColor: file ? "#007600" : BORDER }}>
        {preview ? (
          <div className="relative">
            <img src={preview} alt="" className="w-full h-32 object-cover" />
            <span className="absolute bottom-2 right-2 bg-white/95 text-[10px] font-black uppercase px-2 py-1 rounded-lg"
              style={{ color: "#007600" }}>
              <i className="fa-solid fa-check mr-1" />Ajoutée
            </span>
          </div>
        ) : (
          <div className="h-32 flex flex-col items-center justify-center gap-1.5" style={{ color: MUTED }}>
            <i className="fa-solid fa-camera text-xl" />
            <span className="text-[11px] font-bold">Prendre ou choisir une photo</span>
          </div>
        )}
      </div>
      <input type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => onPick(e.target.files?.[0] || null)} />
    </label>
  );
};

const CourierSignup = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form,  setForm]  = useState(EMPTY);
  const [docs,  setDocs]  = useState({ id_front: null, id_back: null, selfie: null, licence: null });
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");
  const [done,  setDone]  = useState(false);
  const [existing, setExisting] = useState(null);

  // Un candidat déjà passé par là ne recommence pas : on lui montre où en est
  // son dossier.
  useEffect(() => {
    if (!user) return;
    supabase.from("courier_applications")
      .select("status, review_note, submitted_at")
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setExisting(data || null));
    setForm(f => ({ ...f, email: user.email || f.email }));
  }, [user]);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError(""); };
  const needsVehicle = !["pieds", "velo"].includes(form.vehicle_type);

  const submit = async () => {
    const phone = form.phone.replace(/\D/g, "");
    if (form.full_name.trim().length < 3) return setError("Indique ton nom complet.");
    if (!/^[0-9]{8,15}$/.test(phone))     return setError("Le téléphone doit contenir 8 à 15 chiffres.");
    if (!form.id_number.trim())           return setError("Le numéro de ta pièce d'identité est obligatoire.");
    if (!docs.id_front)                   return setError("Ajoute la photo recto de ta pièce d'identité.");
    if (!docs.selfie)                     return setError("Ajoute une photo de ton visage.");
    if (!user && form.password.length < 6) return setError("Choisis un mot de passe d'au moins 6 caractères.");
    if (!user && !form.email.trim())      return setError("Une adresse e-mail est nécessaire pour créer ton compte.");

    setBusy(true); setError("");
    try {
      // 1 · Le compte, s'il n'existe pas déjà.
      let userId = user?.id || null;
      if (!userId) {
        const { data, error: e } = await supabase.auth.signUp({
          email: form.email.trim(),
          password: form.password,
          options: { data: { full_name: form.full_name.trim() } },
        });
        if (e) throw new Error(e.message);
        userId = data?.user?.id || null;
      }

      // 2 · Les pièces, dans le seau privé.
      const base = `couriers/${userId || phone}-${Date.now()}`;
      const put = async (name, file) => {
        if (!file) return null;
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${base}/${name}.${ext}`;
        const { error: e } = await supabase.storage
          .from("kyc-documents").upload(path, file, { upsert: true });
        if (e) throw new Error("Envoi des documents impossible : " + e.message);
        return supabase.storage.from("kyc-documents").getPublicUrl(path).data.publicUrl;
      };

      const [idFront, idBack, selfie, licence] = [
        await put("id-front", docs.id_front),
        await put("id-back",  docs.id_back),
        await put("selfie",   docs.selfie),
        await put("licence",  docs.licence),
      ];

      // 3 · Le dossier.
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
        selfie_url: selfie, licence_url: licence,
      });
      if (e2) throw new Error(e2.message);
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  /* ── Dossier déjà déposé ────────────────────────────────────────────── */
  if (done || existing?.status === "pending") return (
    <Shell>
      <div className="text-center">
        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: "#FFF8D3" }}>
          <i className="fa-solid fa-hourglass-half text-xl" style={{ color: "#B26200" }} />
        </div>
        <h1 className="font-black text-lg mb-2" style={{ color: INK }}>Dossier reçu</h1>
        <p className="text-[13px] leading-relaxed mb-6" style={{ color: MUTED }}>
          Buyticle vérifie ton identité. Tu recevras une réponse sous 48 h ouvrées.
          Une fois validé, la console de livraison s'ouvrira avec ton compte habituel.
        </p>
        <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px] text-white"
          style={{ background: DARK }}>
          <i className="fa-solid fa-house text-[12px]" />Retour à l'accueil
        </Link>
      </div>
    </Shell>
  );

  if (existing?.status === "approved") return (
    <Shell>
      <div className="text-center">
        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: "#E8F5E8" }}>
          <i className="fa-solid fa-check text-xl" style={{ color: "#007600" }} />
        </div>
        <h1 className="font-black text-lg mb-2" style={{ color: INK }}>Tu es livreur Buyticle</h1>
        <p className="text-[13px] leading-relaxed mb-6" style={{ color: MUTED }}>
          Ton dossier a été validé. Tes courses t'attendent dans la console.
        </p>
        <button onClick={() => navigate("/delivery")}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px] text-white"
          style={{ background: ACCENT }}>
          <i className="fa-solid fa-truck-fast text-[12px]" />Ouvrir mes courses
        </button>
      </div>
    </Shell>
  );

  /* ── Le formulaire ──────────────────────────────────────────────────── */
  return (
    <Shell wide>
      {existing?.status === "rejected" && (
        <div className="rounded-xl px-4 py-3 mb-5" style={{ background: "#FEE7E5", border: "1px solid rgba(177,39,4,.3)" }}>
          <p className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: "#B12704" }}>
            Dossier précédent refusé
          </p>
          <p className="text-[12px]" style={{ color: INK }}>{existing.review_note}</p>
          <p className="text-[11px] mt-1" style={{ color: MUTED }}>
            Corrige ce qui est signalé et redépose ton dossier ci-dessous.
          </p>
        </div>
      )}

      <div className="mb-6">
        <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-1" style={{ color: ACCENT }}>
          Buyticle Delivery
        </p>
        <h1 className="font-black text-2xl leading-tight" style={{ color: INK }}>Devenir livreur</h1>
        <p className="text-[13px] mt-1.5" style={{ color: MUTED }}>
          Tu transportes des colis et parfois de l'argent. On vérifie donc qui tu es
          avant de t'ouvrir l'accès — comme pour les boutiques.
        </p>
      </div>

      <div className="space-y-5">
        {/* Identité */}
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: INK }}>
            1 · Qui es-tu
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nom complet *">
              <input value={form.full_name} onChange={e => set("full_name", e.target.value)}
                placeholder="Robert Ndongo" className={inputCls} style={{ borderColor: BORDER }} />
            </Field>
            <Field label="Téléphone *" hint="C'est par là que les boutiques t'appelleront.">
              <input value={form.phone} onChange={e => set("phone", e.target.value)}
                placeholder="237 6XX XXX XXX" inputMode="tel" className={inputCls} style={{ borderColor: BORDER }} />
            </Field>
            <Field label="Ville">
              <input value={form.city} onChange={e => set("city", e.target.value)}
                placeholder="Douala" className={inputCls} style={{ borderColor: BORDER }} />
            </Field>
            <Field label={user ? "E-mail du compte" : "E-mail *"}>
              <input value={form.email} onChange={e => set("email", e.target.value)}
                disabled={!!user} type="email" placeholder="toi@exemple.com"
                className={`${inputCls} disabled:opacity-60`} style={{ borderColor: BORDER }} />
            </Field>
          </div>
          {!user && (
            <Field label="Mot de passe *" hint="Il te servira à ouvrir la console de livraison.">
              <input value={form.password} onChange={e => set("password", e.target.value)}
                type="password" placeholder="6 caractères minimum"
                className={inputCls} style={{ borderColor: BORDER }} />
            </Field>
          )}
        </section>

        {/* Véhicule */}
        <section className="space-y-3 border-t pt-5" style={{ borderColor: "#EAEDED" }}>
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: INK }}>
            2 · Comment tu livres
          </p>
          <div className="flex gap-2 flex-wrap">
            {VEHICLES.map(v => (
              <button key={v.key} type="button" onClick={() => set("vehicle_type", v.key)}
                className="px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-colors"
                style={form.vehicle_type === v.key
                  ? { background: DARK, color: ACCENT, borderColor: DARK }
                  : { background: "#fff", color: MUTED, borderColor: BORDER }}>
                <i className={`fa-solid ${v.icon} mr-1.5`} />{v.label}
              </button>
            ))}
          </div>
          {needsVehicle && (
            <Field label="Plaque d'immatriculation">
              <input value={form.vehicle_plate} onChange={e => set("vehicle_plate", e.target.value)}
                placeholder="LT 1234 AB" className={inputCls} style={{ borderColor: BORDER }} />
            </Field>
          )}
        </section>

        {/* Pièces */}
        <section className="space-y-3 border-t pt-5" style={{ borderColor: "#EAEDED" }}>
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: INK }}>
            3 · Tes pièces
          </p>
          <div className="flex gap-2 flex-wrap">
            {ID_TYPES.map(t => (
              <button key={t.key} type="button" onClick={() => set("id_type", t.key)}
                className="px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-colors"
                style={form.id_type === t.key
                  ? { background: DARK, color: ACCENT, borderColor: DARK }
                  : { background: "#fff", color: MUTED, borderColor: BORDER }}>
                {t.label}
              </button>
            ))}
          </div>
          <Field label="Numéro de la pièce *">
            <input value={form.id_number} onChange={e => set("id_number", e.target.value)}
              placeholder="110234567" className={inputCls} style={{ borderColor: BORDER }} />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <FileDrop label="Pièce d'identité — recto" required
              file={docs.id_front} onPick={f => setDocs(d => ({ ...d, id_front: f }))} />
            <FileDrop label="Pièce d'identité — verso"
              file={docs.id_back} onPick={f => setDocs(d => ({ ...d, id_back: f }))} />
            <FileDrop label="Photo de ton visage" required
              file={docs.selfie} onPick={f => setDocs(d => ({ ...d, selfie: f }))} />
            {needsVehicle && (
              <FileDrop label="Permis de conduire"
                file={docs.licence} onPick={f => setDocs(d => ({ ...d, licence: f }))} />
            )}
          </div>
          <p className="text-[11px]" style={{ color: MUTED }}>
            <i className="fa-solid fa-lock mr-1.5" />
            Ces documents ne sont visibles que par l'équipe Buyticle. Ils servent à vérifier
            ton identité, et à te retrouver si un colis disparaît.
          </p>
        </section>

        {error && (
          <p className="text-[12px] font-bold" style={{ color: "#B12704" }}>
            <i className="fa-solid fa-circle-exclamation mr-1.5" />{error}
          </p>
        )}

        <button onClick={submit} disabled={busy}
          className="w-full py-3.5 rounded-xl font-black text-[13px] disabled:opacity-50"
          style={{ background: ACCENT, color: INK }}>
          {busy ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Envoi du dossier…</>
                : <><i className="fa-solid fa-paper-plane mr-2" />Envoyer mon dossier</>}
        </button>

        <p className="text-[11px] text-center" style={{ color: MUTED }}>
          Déjà livreur ? <Link to="/delivery" className="font-bold underline" style={{ color: INK }}>
            Ouvre tes courses
          </Link>
        </p>
      </div>
    </Shell>
  );
};

const Shell = ({ children, wide }) => (
  <div className="min-h-screen py-8 px-4" style={{ background: "#F3F4F4" }}>
    <div className={`mx-auto ${wide ? "max-w-2xl" : "max-w-md"}`}>
      <Link to="/" className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: DARK }}>
          <img src={LOGO_URL} alt="" className="w-5 h-5 object-contain" />
        </div>
        <span className="font-black text-[15px]" style={{ color: INK }}>
          Buyticle<span style={{ color: ACCENT }}>Delivery</span>
        </span>
      </Link>
      <div className="bg-white rounded-2xl p-5 sm:p-7 border" style={{ borderColor: "#E3E6E6" }}>
        {children}
      </div>
    </div>
  </div>
);

export default CourierSignup;
