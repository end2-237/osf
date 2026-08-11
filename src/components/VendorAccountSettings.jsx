import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

/* ════════════════════════════════════════════════════════════════════════════
   RÉGLAGES VENDEUR — compte de connexion et profil créateur

   Le dashboard n'affiche pas la navbar : sans ces sections, un vendeur devait
   quitter son espace pour changer son mot de passe ou remplir son profil
   public. Les deux blocs vivent donc ici, avec un lien vers la page profil
   complète pour le reste (commandes, adresses, parrainage…).
   ════════════════════════════════════════════════════════════════════════════ */

const input = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-900 transition-colors";
const label = "text-[11px] font-bold uppercase tracking-wide text-gray-400 block mb-1.5";

const Feedback = ({ msg }) => !msg ? null : (
  <p className={`text-[12px] ${msg.type === "error" ? "text-red-500" : "text-emerald-600"}`}>
    <i className={`fa-solid ${msg.type === "error" ? "fa-circle-exclamation" : "fa-circle-check"} mr-1.5`} />
    {msg.text}
  </p>
);

/* ── COMPTE & CONNEXION ───────────────────────────────────────────────────── */
export const AccountSection = ({ user, sectionRef }) => {
  const [email, setEmail]     = useState(user?.email || "");
  const [emailMsg, setEmailMsg] = useState(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [pw, setPw]     = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => { setEmail(user?.email || ""); }, [user?.email]);

  const emailChanged = email.trim().toLowerCase() !== (user?.email || "").toLowerCase();

  const changeEmail = async () => {
    const next = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      return setEmailMsg({ type: "error", text: "Adresse e-mail invalide." });
    }
    setEmailBusy(true); setEmailMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw error;
      setEmailMsg({
        type: "ok",
        text: `Un lien de confirmation a été envoyé à ${next}. L'adresse changera une fois le lien ouvert.`,
      });
    } catch (e) {
      setEmailMsg({ type: "error", text: e.message });
    } finally { setEmailBusy(false); }
  };

  const changePassword = async () => {
    setPwMsg(null);
    if (!pw.current.trim())      return setPwMsg({ type: "error", text: "Saisis ton mot de passe actuel." });
    if (pw.next.length < 8)      return setPwMsg({ type: "error", text: "Le nouveau mot de passe doit faire au moins 8 caractères." });
    if (pw.next !== pw.confirm)  return setPwMsg({ type: "error", text: "Les deux mots de passe ne correspondent pas." });

    setPwBusy(true);
    try {
      // Ré-authentification : sans ça, n'importe quelle session ouverte
      // permettrait de changer le mot de passe sans connaître l'ancien.
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email, password: pw.current,
      });
      if (authError) { setPwMsg({ type: "error", text: "Mot de passe actuel incorrect." }); return; }

      const { error } = await supabase.auth.updateUser({ password: pw.next });
      if (error) throw error;
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg({ type: "ok", text: "Mot de passe mis à jour." });
    } catch (e) {
      setPwMsg({ type: "error", text: e.message });
    } finally { setPwBusy(false); }
  };

  const strength = pw.next.length < 8 ? 0 : pw.next.length < 12 ? 1 : pw.next.length < 16 ? 2 : 3;

  return (
    <div id="compte" ref={sectionRef} className="scroll-mt-24 bg-white border border-gray-200/80 rounded-2xl p-5 space-y-5">
      <div>
        <p className="font-bold text-[15px] mb-1">E-mail et mot de passe</p>
        <p className="text-[13px] text-gray-500">Identifiants utilisés pour accéder à ton espace vendeur.</p>
      </div>

      {/* E-mail */}
      <div className="space-y-2">
        <label className={label}>Adresse e-mail</label>
        <div className="flex items-center gap-2">
          <input value={email} onChange={e => { setEmail(e.target.value); setEmailMsg(null); }}
            type="email" inputMode="email" className={input} />
          <button onClick={changeEmail} disabled={emailBusy || !emailChanged}
            className="bg-gray-900 text-white text-[12px] font-bold px-4 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-40 flex-shrink-0">
            {emailBusy ? "Envoi…" : "Modifier"}
          </button>
        </div>
        <Feedback msg={emailMsg} />
        {!emailMsg && (
          <p className="text-[11px] text-gray-400">
            Un lien de confirmation sera envoyé à la nouvelle adresse avant tout changement.
          </p>
        )}
      </div>

      {/* Mot de passe */}
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <label className={label}>Mot de passe</label>
        {[
          { k: "current", ph: "Mot de passe actuel" },
          { k: "next",    ph: "Nouveau mot de passe (8 caractères min.)" },
          { k: "confirm", ph: "Confirme le nouveau mot de passe" },
        ].map(f => (
          <input key={f.k} type="password" autoComplete="new-password" placeholder={f.ph}
            value={pw[f.k]} onChange={e => { setPw(p => ({ ...p, [f.k]: e.target.value })); setPwMsg(null); }}
            onKeyDown={e => e.key === "Enter" && changePassword()}
            className={input} />
        ))}

        {pw.next && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1 flex-1">
              {[0, 1, 2].map(i => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${
                  strength > i ? (strength === 1 ? "bg-red-400" : strength === 2 ? "bg-orange-400" : "bg-emerald-500") : "bg-gray-200"
                }`} />
              ))}
            </div>
            <span className="text-[11px] text-gray-400">
              {["Trop court", "Faible", "Moyen", "Fort"][strength]}
            </span>
          </div>
        )}

        <Feedback msg={pwMsg} />

        <button onClick={changePassword} disabled={pwBusy}
          className="bg-gray-900 text-white text-[12px] font-bold px-5 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-40">
          {pwBusy ? "Mise à jour…" : "Changer le mot de passe"}
        </button>
      </div>

      {/* Renvoi vers la page profil complète */}
      <div className="border-t border-gray-100 pt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-gray-500">
          Adresses de livraison, commandes personnelles, parrainage et notifications se gèrent
          depuis ton profil.
        </p>
        <a href="/profile?tab=security"
          className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-900 text-[12px] font-bold px-4 py-2.5 rounded-xl flex-shrink-0">
          <i className="fa-solid fa-arrow-up-right-from-square" />Ouvrir mon profil
        </a>
      </div>
    </div>
  );
};

/* ── PROFIL CRÉATEUR ──────────────────────────────────────────────────────── */
const SOCIALS = [
  { k: "instagram", label: "Instagram", icon: "fa-brands fa-instagram", ph: "@ton_compte",       color: "text-pink-500"    },
  { k: "tiktok",    label: "TikTok",    icon: "fa-brands fa-tiktok",    ph: "@ton_compte",       color: "text-gray-900"    },
  { k: "whatsapp",  label: "WhatsApp",  icon: "fa-brands fa-whatsapp",  ph: "237 6XX XXX XXX",   color: "text-emerald-500" },
  { k: "website",   label: "Site web",  icon: "fa-solid fa-globe",      ph: "https://…",         color: "text-blue-500"    },
];

const emptyCreator = (p) => ({
  bio:       p?.bio       || "",
  city:      p?.city      || "",
  instagram: p?.instagram || "",
  tiktok:    p?.tiktok    || "",
  whatsapp:  p?.whatsapp  || "",
  website:   p?.website   || "",
});

export const CreatorProfileSection = ({ user, vendor, showToast, sectionRef }) => {
  const [profile, setProfile] = useState(null);
  const [form, setForm]       = useState(emptyCreator(null));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);
  const [msg, setMsg]         = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, bio, city, instagram, tiktok, whatsapp, website, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!alive) return;
      setProfile(data || null);
      setForm(emptyCreator(data));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setMsg(null); };
  const dirty = Object.keys(form).some(k => (form[k] || "") !== (profile?.[k] || ""));

  const save = async () => {
    if (form.website && !/^https?:\/\/.+/i.test(form.website.trim())) {
      return setMsg({ type: "error", text: "Le site web doit commencer par http:// ou https://" });
    }
    setBusy(true); setMsg(null);
    try {
      const patch = {
        bio:       form.bio.trim()   || null,
        city:      form.city.trim()  || null,
        // Les pseudos sont stockés sans « @ » : les liens publics le rajoutent.
        instagram: form.instagram.trim().replace(/^@/, "") || null,
        tiktok:    form.tiktok.trim().replace(/^@/, "")    || null,
        whatsapp:  form.whatsapp.trim() || null,
        website:   form.website.trim()  || null,
      };
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, ...patch }, { onConflict: "id" });
      if (error) throw error;
      setProfile(p => ({ ...(p || { id: user.id }), ...patch }));
      setForm(emptyCreator(patch));
      showToast?.("Profil créateur mis à jour");
    } catch (e) {
      setMsg({ type: "error", text: e.message });
      showToast?.("Erreur", e.message, "error");
    } finally { setBusy(false); }
  };

  const handle = vendor?.shop_name ? encodeURIComponent(vendor.shop_name) : "";

  return (
    <div id="createur" ref={sectionRef} className="scroll-mt-24 bg-white border border-gray-200/80 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-bold text-[15px] mb-1">Ta présence de créateur</p>
          <p className="text-[13px] text-gray-500">
            Ce que voient les spectateurs de tes lives et les visiteurs de ta page créateur.
          </p>
        </div>
        {handle && (
          <a href={`/creator/${handle}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-900 text-[12px] font-bold px-4 py-2.5 rounded-xl flex-shrink-0">
            <i className="fa-solid fa-arrow-up-right-from-square" />Voir ma page créateur
          </a>
        )}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-20 bg-gray-100 rounded-xl" />
          <div className="h-10 bg-gray-100 rounded-xl" />
        </div>
      ) : (
        <>
          <div>
            <label className={label}>Bio</label>
            <textarea value={form.bio} onChange={e => set("bio", e.target.value)} rows={3}
              maxLength={280} className={`${input} resize-none`}
              placeholder="Qui es-tu, ce que tu vends, ce qui te distingue…" />
            <p className="text-[11px] text-gray-400 mt-1 text-right">{form.bio.length}/280</p>
          </div>

          <div>
            <label className={label}>Ville</label>
            <input value={form.city} onChange={e => set("city", e.target.value)}
              className={input} placeholder="Douala" />
          </div>

          <div>
            <label className={label}>Liens</label>
            <div className="space-y-2">
              {SOCIALS.map(s => (
                <div key={s.k} className="flex items-center gap-2">
                  <span className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <i className={`${s.icon} ${s.color}`} />
                  </span>
                  <input value={form[s.k]} onChange={e => set(s.k, e.target.value)}
                    className={input} placeholder={`${s.label} — ${s.ph}`} />
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-gray-400">
            <i className="fa-solid fa-circle-info mr-1" />
            Ta photo de créateur est celle de ta boutique, définie dans « Identité visuelle ».
          </p>

          <Feedback msg={msg} />

          <div className="flex items-center gap-2">
            <button onClick={save} disabled={busy || !dirty}
              className="bg-gray-900 text-white text-[12px] font-bold px-5 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-40">
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
            {dirty && (
              <button onClick={() => { setForm(emptyCreator(profile)); setMsg(null); }} disabled={busy}
                className="text-[12px] font-bold px-4 py-2.5 rounded-xl text-gray-500 hover:bg-gray-100">
                Annuler
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
