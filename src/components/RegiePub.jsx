import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

/* ═══════════════════════════════════════════════════════════════════════════
   LA RÉGIE PUBLICITAIRE

   Deux choses qui se ressemblent et ne se gèrent pas pareil, d'où deux
   panneaux et non un seul écran mélangé.

   LES CRÉATIONS sont de l'affichage : une image, un texte, une destination,
   un emplacement. On les écrit, on les programme, on les éteint.

   LES MISES EN AVANT sont du commerce : telle boutique est poussée du tel
   jour au tel jour, pour tel montant. Elles n'ont pas de visuel — elles
   changent le classement. Les avoir mélangées aurait rendu impossible la
   seule question qui compte à la facturation : combien de jours cette
   boutique a-t-elle été réellement mise en avant.

   Ce qui est délibérément ABSENT : aucune création ne se publie sans
   emplacement ni titre, et le bouton d'enregistrement reste éteint tant que
   les deux manquent. Une campagne à moitié écrite qui part en production
   s'affiche sur des milliers de téléphones avant que quiconque s'en aperçoive.
   ═══════════════════════════════════════════════════════════════════════════ */

const EMPLACEMENTS = [
  { cle: "slide",   label: "Diapositive large",  aide: "Rail horizontal, entre deux sections. Mobile : accueil et catalogue." },
  { cle: "carte",   label: "Carte de grille",    aide: "Prend une case parmi les articles. Mobile : accueil, catalogue, recherche." },
  { cle: "story",   label: "Story",              aide: "Plein écran, dans le rail du haut." },
  { cle: "bandeau", label: "Bandeau du site",    aide: "La bande fine, sur le web." },
];

const CIBLES = [
  { cle: "route",    label: "Une page de l'app", exemple: "/relais, /catalogue, /fidelite" },
  { cle: "boutique", label: "Une boutique",      exemple: "choisir ci-dessous" },
  { cle: "produit",  label: "Un article",        exemple: "identifiant de l'article" },
  { cle: "externe",  label: "Un lien externe",   exemple: "https://…" },
];

const ICONES = ["relais", "eclair", "camion", "cadeau", "personnes", "boutique",
                "catalogue", "etoile", "fusee", "live", "colis", "cible"];

const COULEURS = [
  ["#141B4D", "Marine"], ["#FF6B00", "Orange"], ["#00695C", "Vert"],
  ["#2C6BED", "Bleu"],   ["#7B1FA2", "Violet"], ["#E53935", "Rouge"],
];

const VIDE = {
  emplacement: "slide", eyebrow: "", titre: "", sous_titre: "", action: "",
  image_url: "", fond: "#141B4D", teinte: "", icone: "eclair",
  cible_type: "route", cible_id: null, cible_url: "",
  debut: "", fin: "", actif: true, poids: 100, vendor_id: null,
};

const jour = (v) => (v ? new Date(v).toISOString().slice(0, 10) : "");
const versDate = (v) => (v ? new Date(v + "T00:00:00Z").toISOString() : null);

/* ── L'aperçu ───────────────────────────────────────────────────────────────
   Il n'est pas décoratif. Une régie sans aperçu se pilote à l'aveugle, et le
   premier retour arrive par un client qui a vu la campagne de travers. */
function Apercu({ p }) {
  const carte = p.emplacement === "carte";
  return (
    <div
      className="relative rounded-2xl overflow-hidden flex-shrink-0"
      style={{
        background: p.fond || "#141B4D",
        width: carte ? 170 : 320,
        height: carte ? 240 : 132,
      }}
    >
      {p.image_url && (
        <img src={p.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {!p.image_url && !carte && (
        <div
          className="absolute rounded-full"
          style={{
            background: p.teinte || "rgba(255,255,255,0.12)",
            width: 128, height: 128, right: -18, top: -18,
          }}
        />
      )}
      <div className="relative p-4 h-full flex flex-col">
        {p.eyebrow && (
          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/70">
            {p.eyebrow}
          </p>
        )}
        <p className={`font-black text-white leading-tight mt-1 ${carte ? "text-[13px]" : "text-[15px]"}`}
           style={{ whiteSpace: "pre-line" }}>
          {p.titre || "Sans titre"}
        </p>
        {carte && <div className="flex-1" />}
        {p.sous_titre && (
          <p className="text-[10px] text-white/80 mt-1 leading-snug">{p.sous_titre}</p>
        )}
        {p.action && (
          <span className="self-start mt-2 bg-white text-[#1A1A1A] text-[10px] font-bold rounded-full px-3 py-1">
            {p.action}
          </span>
        )}
        <span className="absolute right-2 bottom-1.5 text-[8px] text-white/55">Sponsorisé</span>
      </div>
    </div>
  );
}

/* ── Le formulaire d'une création ───────────────────────────────────────── */
function Editeur({ valeur, boutiques, onFerme, onEnregistre }) {
  const [p, setP] = useState({ ...VIDE, ...valeur });
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const fichier = useRef(null);

  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const pret = p.titre.trim() && p.emplacement;

  const televerser = async (f) => {
    if (!f) return;
    setBusy(true); setErreur("");
    const nom = `${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error } = await supabase.storage.from("pub-media").upload(nom, f, { upsert: false });
    if (error) { setErreur("Le visuel n'est pas parti : " + error.message); setBusy(false); return; }
    const { data } = supabase.storage.from("pub-media").getPublicUrl(nom);
    set("image_url", data.publicUrl);
    setBusy(false);
  };

  const enregistrer = async () => {
    setBusy(true); setErreur("");
    const corps = {
      emplacement: p.emplacement,
      eyebrow: p.eyebrow.trim() || null,
      titre: p.titre.trim(),
      sous_titre: p.sous_titre.trim() || null,
      action: p.action.trim() || null,
      image_url: p.image_url || null,
      fond: p.fond || "#141B4D",
      teinte: p.teinte || null,
      icone: p.icone || null,
      cible_type: p.cible_type,
      cible_id: p.cible_type === "boutique" || p.cible_type === "produit" ? p.cible_id || null : null,
      cible_url: p.cible_type === "route" || p.cible_type === "externe" ? p.cible_url.trim() || null : null,
      debut: versDate(p.debut),
      fin: versDate(p.fin),
      actif: !!p.actif,
      poids: Number(p.poids) || 100,
      vendor_id: p.vendor_id || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = p.id
      ? await supabase.from("pubs").update(corps).eq("id", p.id)
      : await supabase.from("pubs").insert(corps);
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    onEnregistre();
  };

  const champ = "w-full bg-white border border-[#D5D9D9] rounded-lg px-3 py-2 text-[13px] text-[#0F1111] focus:outline-none focus:border-[#FF9900]";
  const label = "text-[9px] font-black uppercase tracking-widest text-[#565959] mb-1 block";

  return (
    <div className="fixed inset-0 z-[300] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-[#F7F8F8] w-full sm:max-w-4xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl">
        <div className="sticky top-0 bg-[#131921] px-5 py-4 flex items-center justify-between z-10">
          <h3 className="text-white font-black text-sm">
            {p.id ? "Modifier la campagne" : "Nouvelle campagne"}
          </h3>
          <button onClick={onFerme} className="text-[#ADBAC7] hover:text-white">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-5 grid md:grid-cols-[1fr_340px] gap-6">
          <div className="space-y-4">
            <div>
              <span className={label}>Emplacement</span>
              <div className="grid sm:grid-cols-2 gap-2">
                {EMPLACEMENTS.map((e) => (
                  <button key={e.cle} onClick={() => set("emplacement", e.cle)}
                    className={`text-left px-3 py-2 rounded-lg border transition-all ${
                      p.emplacement === e.cle
                        ? "border-[#FF9900] bg-[#FFF6E9]"
                        : "border-[#D5D9D9] bg-white hover:border-[#ADB1B8]"}`}>
                    <p className="text-[12px] font-bold text-[#0F1111]">{e.label}</p>
                    <p className="text-[10px] text-[#565959] leading-snug mt-0.5">{e.aide}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <span className={label}>Sur-titre</span>
                <input className={champ} value={p.eyebrow}
                  onChange={(e) => set("eyebrow", e.target.value)}
                  placeholder="Ventes flash" />
              </div>
              <div>
                <span className={label}>Libellé du bouton</span>
                <input className={champ} value={p.action}
                  onChange={(e) => set("action", e.target.value)}
                  placeholder="J'en profite" />
              </div>
            </div>

            <div>
              <span className={label}>Titre *</span>
              <textarea rows={2} className={champ} value={p.titre}
                onChange={(e) => set("titre", e.target.value)}
                placeholder={"Jusqu'à −33 %\nsur des milliers d'articles"} />
              <p className="text-[10px] text-[#565959] mt-1">
                Un retour à la ligne coupe le titre au bon endroit. Deux lignes au maximum : la troisième est tronquée à l'affichage.
              </p>
            </div>

            <div>
              <span className={label}>Sous-titre</span>
              <input className={champ} value={p.sous_titre}
                onChange={(e) => set("sous_titre", e.target.value)}
                placeholder="Jusqu'à dimanche minuit" />
            </div>

            <div>
              <span className={label}>Visuel</span>
              <div className="flex items-center gap-3">
                <button onClick={() => fichier.current?.click()} disabled={busy}
                  className="bg-white border border-[#D5D9D9] rounded-lg px-4 py-2 text-[12px] font-bold text-[#0F1111] hover:border-[#FF9900] disabled:opacity-50">
                  <i className="fa-solid fa-image mr-2" />
                  {p.image_url ? "Remplacer" : "Choisir une image"}
                </button>
                {p.image_url && (
                  <button onClick={() => set("image_url", "")}
                    className="text-[12px] text-[#B12704] font-bold">Retirer</button>
                )}
                <input ref={fichier} type="file" accept="image/*" className="hidden"
                  onChange={(e) => televerser(e.target.files?.[0])} />
              </div>
              <p className="text-[10px] text-[#565959] mt-1">
                Sans image, la campagne s'habille de sa couleur et de son icône. C'est le cas normal au début — une couleur bien choisie vaut mieux qu'un visuel bâclé.
              </p>
            </div>

            {!p.image_url && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <span className={label}>Couleur de fond</span>
                  <div className="flex flex-wrap gap-2">
                    {COULEURS.map(([c, n]) => (
                      <button key={c} onClick={() => set("fond", c)} title={n}
                        className={`w-8 h-8 rounded-lg border-2 ${p.fond === c ? "border-[#FF9900]" : "border-transparent"}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
                <div>
                  <span className={label}>Icône</span>
                  <select className={champ} value={p.icone || ""}
                    onChange={(e) => set("icone", e.target.value)}>
                    {ICONES.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div>
              <span className={label}>Où elle mène</span>
              <div className="flex flex-wrap gap-2 mb-2">
                {CIBLES.map((c) => (
                  <button key={c.cle} onClick={() => set("cible_type", c.cle)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${
                      p.cible_type === c.cle
                        ? "bg-[#131921] text-white border-[#131921]"
                        : "bg-white text-[#0F1111] border-[#D5D9D9]"}`}>
                    {c.label}
                  </button>
                ))}
              </div>
              {p.cible_type === "boutique" ? (
                <select className={champ} value={p.cible_id || ""}
                  onChange={(e) => set("cible_id", e.target.value || null)}>
                  <option value="">— choisir une boutique —</option>
                  {boutiques.map((b) => (
                    <option key={b.id} value={b.id}>{b.shop_name}</option>
                  ))}
                </select>
              ) : (
                <input className={champ}
                  value={p.cible_type === "produit" ? (p.cible_id || "") : p.cible_url}
                  onChange={(e) => p.cible_type === "produit"
                    ? set("cible_id", e.target.value || null)
                    : set("cible_url", e.target.value)}
                  placeholder={CIBLES.find((c) => c.cle === p.cible_type)?.exemple} />
              )}
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <span className={label}>Début</span>
                <input type="date" className={champ} value={jour(p.debut)}
                  onChange={(e) => set("debut", e.target.value)} />
              </div>
              <div>
                <span className={label}>Fin</span>
                <input type="date" className={champ} value={jour(p.fin)}
                  onChange={(e) => set("fin", e.target.value)} />
              </div>
              <div>
                <span className={label}>Poids</span>
                <input type="number" className={champ} value={p.poids}
                  onChange={(e) => set("poids", e.target.value)} />
              </div>
            </div>
            <p className="text-[10px] text-[#565959] -mt-2">
              Dates vides = campagne permanente. Le poids décide de l'ordre : le plus élevé passe en premier.
            </p>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={p.actif}
                onChange={(e) => set("actif", e.target.checked)} className="w-4 h-4" />
              <span className="text-[13px] text-[#0F1111]">Campagne allumée</span>
            </label>

            {erreur && (
              <p className="text-[12px] text-[#B12704] bg-[#FEE7E5] rounded-lg px-3 py-2">{erreur}</p>
            )}
          </div>

          <div className="space-y-3">
            <span className={label}>Aperçu</span>
            <Apercu p={p} />
            <p className="text-[10px] text-[#565959] leading-relaxed">
              C'est très exactement ce que verra le client, à la police près. La mention « Sponsorisé » n'est pas retirable : une réclame dit toujours ce qu'elle est.
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-[#D5D9D9] px-5 py-3 flex gap-3 justify-end">
          <button onClick={onFerme}
            className="px-5 py-2 rounded-lg border border-[#D5D9D9] text-[13px] font-bold text-[#0F1111]">
            Annuler
          </button>
          <button onClick={enregistrer} disabled={!pret || busy}
            className="px-6 py-2 rounded-lg bg-[#FF9900] text-[#0F1111] text-[13px] font-black disabled:opacity-40 disabled:cursor-not-allowed">
            {busy ? "…" : p.id ? "Enregistrer" : "Publier"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Le panneau des mises en avant ──────────────────────────────────────── */
function Sponsorisations({ boutiques }) {
  const [liste, setListe] = useState(null);
  const [f, setF] = useState({ vendor_id: "", portee: "boutique", fin: "", montant: "", poids: 100, note: "" });
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("sponsorisations")
      .select("*, vendor:vendors!vendor_id(shop_name, logo_url)")
      .order("created_at", { ascending: false });
    setListe(data || []);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const ajouter = async () => {
    if (!f.vendor_id) { setErreur("Choisis une boutique."); return; }
    setBusy(true); setErreur("");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("sponsorisations").insert({
      vendor_id: f.vendor_id,
      portee: f.portee,
      fin: versDate(f.fin),
      montant: f.montant ? Number(f.montant) : null,
      poids: Number(f.poids) || 100,
      note: f.note.trim() || null,
      cree_par: u?.user?.id || null,
    });
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    setF({ vendor_id: "", portee: "boutique", fin: "", montant: "", poids: 100, note: "" });
    charger();
  };

  const basculer = async (s) => {
    await supabase.from("sponsorisations").update({ actif: !s.actif }).eq("id", s.id);
    charger();
  };

  const supprimer = async (s) => {
    await supabase.from("sponsorisations").delete().eq("id", s.id);
    charger();
  };

  const champ = "w-full bg-white border border-[#D5D9D9] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#FF9900]";
  const label = "text-[9px] font-black uppercase tracking-widest text-[#565959] mb-1 block";

  const enCours = (s) =>
    s.actif && new Date(s.debut) <= new Date() && (!s.fin || new Date(s.fin) >= new Date());

  return (
    <div className="bg-white rounded-xl border border-[#D5D9D9] overflow-hidden">
      <div className="bg-[#131921] px-5 py-3">
        <h3 className="text-white font-black text-sm">Boutiques mises en avant</h3>
        <p className="text-[#ADBAC7] text-[11px] mt-0.5">
          Une mise en avant n'a pas de visuel : elle remonte la boutique dans les listes.
          « Contenu » remonte aussi ses articles dans les grilles — ça touche beaucoup plus de pages.
        </p>
      </div>

      <div className="p-5 border-b border-[#EBEBEB] grid md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2">
          <span className={label}>Boutique</span>
          <select className={champ} value={f.vendor_id}
            onChange={(e) => setF({ ...f, vendor_id: e.target.value })}>
            <option value="">— choisir —</option>
            {boutiques.map((b) => <option key={b.id} value={b.id}>{b.shop_name}</option>)}
          </select>
        </div>
        <div>
          <span className={label}>Portée</span>
          <select className={champ} value={f.portee}
            onChange={(e) => setF({ ...f, portee: e.target.value })}>
            <option value="boutique">La boutique</option>
            <option value="contenu">Boutique + articles</option>
          </select>
        </div>
        <div>
          <span className={label}>Jusqu'au</span>
          <input type="date" className={champ} value={f.fin}
            onChange={(e) => setF({ ...f, fin: e.target.value })} />
        </div>
        <div>
          <span className={label}>Montant (F)</span>
          <input type="number" className={champ} value={f.montant}
            onChange={(e) => setF({ ...f, montant: e.target.value })} placeholder="15000" />
        </div>
        <button onClick={ajouter} disabled={busy}
          className="bg-[#FF9900] text-[#0F1111] font-black text-[13px] rounded-lg px-4 py-2 disabled:opacity-40">
          Mettre en avant
        </button>
      </div>

      {erreur && <p className="px-5 py-2 text-[12px] text-[#B12704]">{erreur}</p>}

      <div className="divide-y divide-[#EBEBEB]">
        {liste === null ? (
          <p className="px-5 py-6 text-[13px] text-[#565959]">Chargement…</p>
        ) : liste.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-[#565959]">
            Aucune boutique mise en avant. Le bandeau du site tire alors une boutique active au hasard.
          </p>
        ) : liste.map((s) => (
          <div key={s.id} className="px-5 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F0F2F2] overflow-hidden flex items-center justify-center flex-shrink-0">
              {s.vendor?.logo_url
                ? <img src={s.vendor.logo_url} alt="" className="w-full h-full object-cover" />
                : <i className="fa-solid fa-store text-[#ADB1B8]" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[#0F1111] truncate">
                {s.vendor?.shop_name || "Boutique supprimée"}
              </p>
              <p className="text-[11px] text-[#565959]">
                {s.portee === "contenu" ? "Boutique + articles" : "Boutique seule"}
                {" · depuis le "}{new Date(s.debut).toLocaleDateString("fr-FR")}
                {s.fin ? ` jusqu'au ${new Date(s.fin).toLocaleDateString("fr-FR")}` : " — sans fin"}
                {s.montant ? ` · ${Number(s.montant).toLocaleString("fr-FR")} F` : ""}
              </p>
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${
              enCours(s) ? "bg-[#E8F5E8] text-[#007600]" : "bg-[#EAEDED] text-[#565959]"}`}>
              {enCours(s) ? "En cours" : s.actif ? "Programmée" : "Éteinte"}
            </span>
            <button onClick={() => basculer(s)}
              className="text-[12px] font-bold text-[#0F1111] px-2">
              {s.actif ? "Éteindre" : "Rallumer"}
            </button>
            <button onClick={() => supprimer(s)} className="text-[12px] font-bold text-[#B12704] px-2">
              Supprimer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── L'écran ────────────────────────────────────────────────────────────── */
export default function RegiePub() {
  const [pubs, setPubs] = useState(null);
  const [boutiques, setBoutiques] = useState([]);
  const [editee, setEditee] = useState(null);
  const [filtre, setFiltre] = useState("tous");

  const charger = useCallback(async () => {
    const [{ data: p }, { data: v }] = await Promise.all([
      supabase.from("pubs").select("*").order("poids", { ascending: false }),
      supabase.from("vendors").select("id, shop_name, logo_url").eq("is_active", true).order("shop_name"),
    ]);
    setPubs(p || []);
    setBoutiques(v || []);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const basculer = async (p) => {
    await supabase.from("pubs").update({ actif: !p.actif }).eq("id", p.id);
    charger();
  };

  const supprimer = async (p) => {
    await supabase.from("pubs").delete().eq("id", p.id);
    charger();
  };

  const visibles = (pubs || []).filter((p) => filtre === "tous" || p.emplacement === filtre);

  return (
    <div className="space-y-6">

      <div className="bg-[#131921] rounded-xl px-5 py-4 flex items-start gap-3">
        <i className="fa-solid fa-bullhorn text-[#FF9900] mt-0.5" />
        <p className="text-[11px] text-[#ADBAC7] leading-relaxed">
          Tout ce qui s'affiche ici part <strong className="text-white">immédiatement</strong> dans
          l'application mobile et sur le site — sans déploiement, sans mise à jour à installer.
          Une campagne éteinte disparaît au prochain chargement de l'écran concerné.
        </p>
      </div>

      {/* Les créations */}
      <div className="bg-white rounded-xl border border-[#D5D9D9] overflow-hidden">
        <div className="bg-[#131921] px-5 py-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-white font-black text-sm">Les créations</h3>
            <p className="text-[#ADBAC7] text-[11px] mt-0.5">
              Visuels, bannières et redirections de tous les emplacements publicitaires.
            </p>
          </div>
          <button onClick={() => setEditee({ ...VIDE })}
            className="bg-[#FF9900] text-[#0F1111] font-black text-[12px] rounded-lg px-4 py-2 whitespace-nowrap">
            <i className="fa-solid fa-plus mr-1.5" />Nouvelle campagne
          </button>
        </div>

        <div className="px-5 py-3 border-b border-[#EBEBEB] flex gap-2 overflow-x-auto">
          {[{ cle: "tous", label: "Tous" }, ...EMPLACEMENTS].map((e) => (
            <button key={e.cle} onClick={() => setFiltre(e.cle)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap border ${
                filtre === e.cle
                  ? "bg-[#131921] text-white border-[#131921]"
                  : "bg-white text-[#0F1111] border-[#D5D9D9]"}`}>
              {e.label}
            </button>
          ))}
        </div>

        {pubs === null ? (
          <p className="px-5 py-8 text-[13px] text-[#565959]">Chargement…</p>
        ) : visibles.length === 0 ? (
          <p className="px-5 py-8 text-[13px] text-[#565959]">
            Aucune campagne à cet emplacement. Les écrans concernés afficheront alors leurs valeurs de repli.
          </p>
        ) : (
          <div className="divide-y divide-[#EBEBEB]">
            {visibles.map((p) => {
              const expiree = p.fin && new Date(p.fin) < new Date();
              const future = p.debut && new Date(p.debut) > new Date();
              return (
                <div key={p.id} className="px-5 py-4 flex flex-col sm:flex-row gap-4">
                  <div className="scale-[0.72] origin-top-left -mb-8 sm:mb-0 flex-shrink-0"
                       style={{ width: p.emplacement === "carte" ? 124 : 232 }}>
                    <Apercu p={p} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#565959] bg-[#F0F2F2] rounded px-2 py-0.5">
                        {EMPLACEMENTS.find((e) => e.cle === p.emplacement)?.label || p.emplacement}
                      </span>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                        !p.actif ? "bg-[#EAEDED] text-[#565959]"
                        : expiree ? "bg-[#FEE7E5] text-[#B12704]"
                        : future ? "bg-[#FFF3CD] text-[#8A6D00]"
                        : "bg-[#E8F5E8] text-[#007600]"}`}>
                        {!p.actif ? "Éteinte" : expiree ? "Terminée" : future ? "Programmée" : "En ligne"}
                      </span>
                      <span className="text-[10px] text-[#565959]">poids {p.poids}</span>
                    </div>

                    <p className="text-[13px] font-bold text-[#0F1111] mt-1.5 whitespace-pre-line">{p.titre}</p>
                    <p className="text-[11px] text-[#565959] mt-0.5">
                      {p.debut ? `du ${new Date(p.debut).toLocaleDateString("fr-FR")}` : "permanente"}
                      {p.fin ? ` au ${new Date(p.fin).toLocaleDateString("fr-FR")}` : ""}
                      {" · "}
                      {p.cible_type === "boutique"
                        ? `→ ${boutiques.find((b) => b.id === p.cible_id)?.shop_name || "boutique"}`
                        : `→ ${p.cible_url || p.cible_id || "aucune destination"}`}
                    </p>
                    <p className="text-[11px] text-[#565959] mt-1">
                      <strong className="text-[#0F1111]">{(p.vues || 0).toLocaleString("fr-FR")}</strong> vues
                      {" · "}
                      <strong className="text-[#0F1111]">{(p.clics || 0).toLocaleString("fr-FR")}</strong> clics
                      {p.vues > 0 && ` · ${((p.clics / p.vues) * 100).toFixed(1)} %`}
                    </p>
                  </div>

                  <div className="flex sm:flex-col gap-2 justify-end">
                    <button onClick={() => setEditee(p)}
                      className="px-3 py-1.5 rounded-lg border border-[#D5D9D9] text-[12px] font-bold text-[#0F1111] whitespace-nowrap">
                      Modifier
                    </button>
                    <button onClick={() => basculer(p)}
                      className="px-3 py-1.5 rounded-lg border border-[#D5D9D9] text-[12px] font-bold text-[#0F1111] whitespace-nowrap">
                      {p.actif ? "Éteindre" : "Rallumer"}
                    </button>
                    <button onClick={() => supprimer(p)}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-[#B12704] whitespace-nowrap">
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Sponsorisations boutiques={boutiques} />

      {editee && (
        <Editeur valeur={editee} boutiques={boutiques}
          onFerme={() => setEditee(null)}
          onEnregistre={() => { setEditee(null); charger(); }} />
      )}
    </div>
  );
}
