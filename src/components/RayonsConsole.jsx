import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import DeliveryMap from "./DeliveryMap";

/* ════════════════════════════════════════════════════════════════════════════
   LA CONSOLE DES RAYONS — super admin

   Un rayon n'est pas une catégorie, c'est un groupe de boutiques d'un même
   périmètre de marche. Tant qu'on ne le voit pas sur une carte, on ne sait pas
   s'il en est un : deux boutiques à huit cents mètres l'une de l'autre ne
   forment pas un rayon, quels que soient leurs produits.

   D'où l'ordre de cet écran : la carte d'abord, les sous-rayons ensuite, les
   boutiques en dernier. On regarde la géographie avant les chiffres.

   Toutes les écritures passent par les fonctions admin_* de docs/sql/27 :
   aucune politique d'écriture n'est ouverte sur les tables.
   ════════════════════════════════════════════════════════════════════════════ */

const PROFILS = [
  ["receveuse",   "Receveuse",   "bien fournie, très fréquentée — elle absorbe"],
  ["emettrice",   "Émettrice",   "du passage, un stock troué — elle alimente"],
  ["specialiste", "Spécialiste", "étroite mais profonde — elle sécurise une famille"],
  ["service",     "Service",     "vend peu, immobilise le client — elle envoie"],
];
const COULEUR_PROFIL = {
  receveuse: "#007600", emettrice: "#FF9900", specialiste: "#7c3aed", service: "#0EA5E9",
};

const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} F`;
const pct  = (n) => n == null ? "—" : `${Math.round(Number(n) * 100)} %`;

const Carte = ({ children, titre, sous, action }) => (
  <div className="bg-white rounded-xl border border-[#D5D9D9] overflow-hidden">
    {(titre || action) && (
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#E7E9EA]">
        <div>
          <h3 className="text-[13px] font-black text-[#0F1111]">{titre}</h3>
          {sous && <p className="text-[11px] text-[#565959] mt-0.5">{sous}</p>}
        </div>
        {action}
      </div>
    )}
    {children}
  </div>
);

export default function RayonsConsole() {
  const [rayons, setRayons]   = useState([]);
  const [actif, setActif]     = useState(null);
  const [carte, setCarte]     = useState([]);
  const [familles, setFams]   = useState([]);
  const [libres, setLibres]   = useState([]);
  const [recherche, setRech]  = useState("");
  const [msg, setMsg]         = useState("");
  const [busy, setBusy]       = useState(false);
  const [affecter, setAff]    = useState(null);   // boutique en cours d'affectation
  const [editRayon, setEditR] = useState(false);
  const [editFam, setEditF]   = useState(null);

  const err = (e) => setMsg(e?.message || "");

  const chargerRayons = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_rayons");
    if (error) return err(error);
    setRayons(data || []);
    setActif((a) => a || data?.[0]?.id || null);
  }, []);

  const chargerRayon = useCallback(async (id) => {
    if (!id) return;
    const [c, f] = await Promise.all([
      supabase.rpc("admin_rayon_carte", { p_rayon_id: id }),
      supabase.rpc("admin_familles",    { p_rayon_id: id }),
    ]);
    if (c.error) return err(c.error);
    if (f.error) return err(f.error);
    setCarte(c.data || []);
    setFams(f.data || []);
  }, []);

  const chargerLibres = useCallback(async (q) => {
    const { data, error } = await supabase.rpc("admin_boutiques_libres", { p_recherche: q || null });
    if (error) return err(error);
    setLibres(data || []);
  }, []);

  useEffect(() => { chargerRayons(); chargerLibres(""); }, [chargerRayons, chargerLibres]);
  useEffect(() => { chargerRayon(actif); }, [actif, chargerRayon]);

  const rayon = rayons.find((r) => r.id === actif);

  /* Le centre du rayon est le barycentre de ses boutiques : il n'y a pas de
     point fixe dans un marché, et c'est autour de lui que se juge le périmètre. */
  const centre = useMemo(() => {
    const pts = carte.filter((b) => b.lat != null && b.lng != null);
    if (!pts.length) return null;
    return {
      lat: pts.reduce((s, b) => s + b.lat, 0) / pts.length,
      lng: pts.reduce((s, b) => s + b.lng, 0) / pts.length,
    };
  }, [carte]);

  const marqueurs = useMemo(() => carte
    .filter((b) => b.lat != null && b.lng != null)
    .map((b) => ({
      lat: b.lat, lng: b.lng,
      color: b.hors_perimetre ? "#B12704" : (COULEUR_PROFIL[b.profil] || "#FF9900"),
      icon: b.genre === "service" ? "fa-scissors" : "fa-store",
      label: b.shop_name,
      title: `<b>${b.shop_name}</b><br>${b.categorie}<br>${b.distance_centre_m ?? "?"} m du centre`,
    })), [carte]);

  const cercles = useMemo(() =>
    centre && rayon ? [{ ...centre, radius: rayon.perimetre_m, color: "#FF9900" }] : [],
    [centre, rayon]);

  const sansPosition = carte.filter((b) => b.lat == null);
  const dehors = carte.filter((b) => b.hors_perimetre);

  /* ── actions ── */
  const agir = async (fn) => {
    setBusy(true); setMsg("");
    const { error } = await fn();
    setBusy(false);
    if (error) return err(error);
    await chargerRayons();
    await chargerRayon(actif);
    await chargerLibres(recherche);
  };

  const retirer = (vendorId) =>
    agir(() => supabase.rpc("admin_retirer_boutique", { p_vendor_id: vendorId, p_rayon_id: actif }));

  const ouvrir = () =>
    agir(() => supabase.rpc("admin_maj_rayon", { p_rayon_id: actif, p_statut: "actif" }));

  return (
    <div className="space-y-4">
      {msg && (
        <div className="bg-[#FFF3F3] border border-[#F5C6CB] text-[#B12704] text-[12px] rounded-lg px-4 py-2.5">
          {msg}
        </div>
      )}

      {/* ── LE CHOIX DU RAYON ── */}
      <div className="flex flex-wrap gap-2">
        {rayons.map((r) => (
          <button key={r.id} onClick={() => setActif(r.id)}
            className={`px-4 py-2.5 rounded-xl text-left transition-all border ${
              actif === r.id
                ? "bg-[#232F3E] text-white border-[#232F3E]"
                : "bg-white text-[#0F1111] border-[#D5D9D9] hover:border-[#FF9900]"}`}>
            <p className="text-[12px] font-black">{r.nom}</p>
            <p className={`text-[10px] ${actif === r.id ? "text-[#ADBAC7]" : "text-[#565959]"}`}>
              {r.zone} · {r.boutiques} boutique{r.boutiques > 1 ? "s" : ""} ·{" "}
              {r.statut === "actif" ? "actif" : "en construction"}
            </p>
          </button>
        ))}
        <CreerRayon onFait={chargerRayons} />
      </div>

      {!rayon && (
        <Carte>
          <p className="p-6 text-[13px] text-[#565959] text-center">
            Aucun rayon pour l’instant. Crée-en un, puis affecte-lui des boutiques.
          </p>
        </Carte>
      )}

      {rayon && (
        <>
          {/* ── L'ÉTAT DU RAYON ── */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-black text-[#0F1111]">{rayon.nom}</h2>
              <p className="text-[11px] text-[#565959]">{rayon.zone} · {rayon.ville}</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setEditR((v) => !v)}
                className="text-[11px] font-bold text-[#007185] hover:underline">
                {editRayon ? "Fermer" : "Modifier le rayon"}
              </button>
              {rayon.statut === "actif" && (
                <button onClick={() => agir(() => supabase.rpc("admin_maj_rayon", { p_rayon_id: actif, p_statut: "suspendu" }))}
                  className="text-[11px] font-bold text-[#B12704] hover:underline">
                  Suspendre
                </button>
              )}
              {rayon.statut === "suspendu" && (
                <button onClick={ouvrir}
                  className="text-[11px] font-bold text-[#007600] hover:underline">
                  Réactiver
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              ["Boutiques", `${rayon.boutiques}`, `plancher ${rayon.min_boutiques} · plafond ${rayon.max_boutiques}`],
              ["Sous-rayons", `${rayon.familles_ouvertes}/${rayon.familles}`, "ouverts"],
              ["Couverture", pct(rayon.couverture), "de la famille motrice"],
              ["Périmètre", `${rayon.perimetre_m} m`, "à pied"],
              ["Statut", rayon.statut === "actif" ? "Actif" : "Construction",
                rayon.ouvert_le ? `depuis le ${rayon.ouvert_le}` : "pas encore ouvert"],
            ].map(([k, v, s]) => (
              <div key={k} className="bg-white rounded-xl border border-[#D5D9D9] px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#565959]">{k}</p>
                <p className="text-lg font-black text-[#0F1111] mt-0.5">{v}</p>
                <p className="text-[10px] text-[#565959]">{s}</p>
              </div>
            ))}
          </div>

          {editRayon && (
            <EditerRayon rayon={rayon}
              onClose={() => setEditR(false)}
              onFait={async () => { setEditR(false); await chargerRayons(); await chargerRayon(actif); }} />
          )}

          {rayon.statut !== "actif" && (
            <div className={`rounded-xl px-4 py-3 text-[12px] border ${
              rayon.prete ? "bg-[#F0FBF4] border-[#B7E4C7] text-[#0B5D2E]"
                          : "bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]"}`}>
              {rayon.prete ? (
                <div className="flex items-center justify-between gap-3">
                  <span>
                    Les familles motrices ont leurs porteurs et le plancher est atteint.
                    Le rayon peut ouvrir : les prix passeront en majoré et le relais s’activera.
                  </span>
                  <button onClick={ouvrir} disabled={busy}
                    className="bg-[#0B5D2E] text-white rounded-lg px-4 py-2 text-[12px] font-bold whitespace-nowrap disabled:opacity-40">
                    Ouvrir le rayon
                  </button>
                </div>
              ) : (
                <>
                  Le rayon ne peut pas encore ouvrir. Une famille motrice sous son
                  seuil produit des relais ratés — et un commerçant qui se plante
                  deux fois n’utilise plus jamais le mécanisme.
                </>
              )}
            </div>
          )}

          {/* ── LA CARTE ── */}
          <Carte titre="Le rayon sur la carte"
                 sous={centre
                   ? `Cercle : le périmètre de ${rayon.perimetre_m} m autour du barycentre des boutiques`
                   : "Aucune boutique positionnée — le rayon n’existe pas encore géographiquement"}>
            <DeliveryMap
              markers={marqueurs}
              circles={cercles}
              center={centre}
              zoom={16}
              theme="light"
              className="w-full h-[420px]"
            />
            <div className="flex flex-wrap gap-3 px-5 py-3 border-t border-[#E7E9EA] text-[11px]">
              {PROFILS.map(([k, l]) => (
                <span key={k} className="flex items-center gap-1.5 text-[#565959]">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: COULEUR_PROFIL[k] }} />
                  {l}
                </span>
              ))}
              <span className="flex items-center gap-1.5 text-[#B12704]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#B12704]" /> hors périmètre
              </span>
            </div>
            {(dehors.length > 0 || sansPosition.length > 0) && (
              <div className="px-5 py-3 border-t border-[#E7E9EA] bg-[#FFFBEB] text-[12px] text-[#92400E] space-y-1">
                {dehors.length > 0 && (
                  <p>
                    <b>{dehors.length} boutique{dehors.length > 1 ? "s" : ""} hors périmètre</b> —
                    {" "}{dehors.map((b) => `${b.shop_name} (${b.distance_centre_m} m)`).join(", ")}.
                    Le client doit pouvoir y aller à pied, sinon il constate que ça ne marche pas.
                  </p>
                )}
                {sansPosition.length > 0 && (
                  <p>
                    <b>{sansPosition.length} sans position</b> —
                    {" "}{sansPosition.map((b) => b.shop_name).join(", ")}.
                    Sans point sur la carte, aucun chemin ne peut être tracé vers elles.
                  </p>
                )}
              </div>
            )}
          </Carte>

          {/* ── LES SOUS-RAYONS ── */}
          <Carte titre="Les sous-rayons"
                 sous="Le nombre de variantes est la seule donnée saisie : porteurs requis et couverture s’en déduisent"
                 action={<AjouterFamille rayonId={actif} onFait={() => chargerRayon(actif)} />}>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-[#F7F8F8] text-[#565959]">
                  <tr className="text-left">
                    {["Famille", "Rôle", "Variantes", "p", "Porteurs", "Requis", "Manque", "Couverture", ""]
                      .map((h) => <th key={h} className="px-4 py-2.5 font-black uppercase text-[9px] tracking-widest">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E9EA]">
                  {familles.map((f) => (editFam === f.id ? (
                    <tr key={f.id}>
                      <td colSpan={9} className="px-4 py-3 bg-[#F7F8F8]">
                        <EditerFamille famille={f} rayonId={actif}
                          onClose={() => setEditF(null)}
                          onFait={async () => { setEditF(null); await chargerRayons(); await chargerRayon(actif); }} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={f.id} className={f.ouverte ? "" : "bg-[#FFFBEB]"}>
                      <td className="px-4 py-2.5 font-bold text-[#0F1111]">{f.nom}</td>
                      <td className="px-4 py-2.5 text-[#565959]">{f.role}</td>
                      <td className="px-4 py-2.5">{f.variantes}</td>
                      <td className="px-4 py-2.5 text-[#565959]">{f.p}</td>
                      <td className="px-4 py-2.5 font-bold">{f.porteurs}</td>
                      <td className="px-4 py-2.5">{f.porteurs_requis}</td>
                      <td className={`px-4 py-2.5 font-bold ${f.manque ? "text-[#B12704]" : "text-[#007600]"}`}>
                        {f.manque || "—"}
                      </td>
                      <td className="px-4 py-2.5">{pct(f.couverture)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            f.ouverte ? "bg-[#F0FBF4] text-[#007600]" : "bg-[#FEF3C7] text-[#92400E]"}`}>
                            {f.ouverte ? "ouverte" : "fermée"}
                          </span>
                          <button onClick={() => setEditF(f.id)}
                            className="text-[11px] font-bold text-[#007185] hover:underline">
                            Modifier
                          </button>
                        </div>
                      </td>
                    </tr>
                  )))}
                  {familles.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-6 text-center text-[#565959]">
                      Aucune famille. Commence par la famille motrice — c’est elle qui fixe la taille du rayon.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Carte>

          {/* ── LES BOUTIQUES DU RAYON ── */}
          <Carte titre={`Les ${carte.length} boutiques du rayon`}
                 sous="Le score est celui de l’arbitrage : envoyés − reçus − 5 × ruptures">
            <div className="divide-y divide-[#E7E9EA]">
              {carte.map((b) => (
                <div key={b.vendor_id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: b.hors_perimetre ? "#B12704" : COULEUR_PROFIL[b.profil] }} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-[#0F1111] truncate">{b.shop_name}</p>
                      <p className="text-[11px] text-[#565959] truncate">
                        {b.categorie} · {b.profil}
                        {b.genre === "service" && " · service"}
                        {b.familles ? ` · ${b.familles}` : " · aucune famille déclarée"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-[11px] text-[#565959]">
                        {b.envoyes_30j} envoyés · {b.recus_30j} reçus
                      </p>
                      <p className="text-[11px] font-bold text-[#0F1111]">
                        score {b.score} · {fcfa(b.abonnement_fcfa)}
                      </p>
                    </div>
                    <button onClick={() => setAff({ ...b, rayonId: actif, changer: true })}
                      className="text-[11px] font-bold text-[#007185] hover:underline">
                      Modifier
                    </button>
                    <button onClick={() => retirer(b.vendor_id)} disabled={busy}
                      className="text-[11px] font-bold text-[#B12704] hover:underline disabled:opacity-40">
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
              {carte.length === 0 && (
                <p className="px-5 py-6 text-center text-[13px] text-[#565959]">
                  Aucune boutique dans ce rayon.
                </p>
              )}
            </div>
          </Carte>

          {/* ── LES BOUTIQUES SANS RAYON ── */}
          <Carte titre="Boutiques sans rayon"
                 sous="Elles vendent sur la marketplace mais ne participent à aucun relais"
                 action={
                   <input value={recherche}
                     onChange={(e) => { setRech(e.target.value); chargerLibres(e.target.value); }}
                     placeholder="Chercher une boutique"
                     className="bg-[#F7F8F8] border border-[#D5D9D9] rounded-lg px-3 py-1.5 text-[12px] outline-none focus:border-[#FF9900]" />
                 }>
            <div className="divide-y divide-[#E7E9EA] max-h-96 overflow-y-auto">
              {libres.map((b) => (
                <div key={b.vendor_id} className="flex items-center justify-between gap-4 px-5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[#0F1111] truncate">{b.shop_name}</p>
                    <p className="text-[11px] text-[#565959]">
                      {b.produits} produit{b.produits > 1 ? "s" : ""}
                      {!b.positionnee && " · pas de position sur la carte"}
                    </p>
                  </div>
                  <button onClick={() => setAff({ ...b, rayonId: actif })}
                    className="text-[11px] font-bold bg-[#FF9900] text-[#0F1111] rounded-lg px-3 py-1.5 whitespace-nowrap">
                    Mettre dans le rayon
                  </button>
                </div>
              ))}
              {libres.length === 0 && (
                <p className="px-5 py-6 text-center text-[13px] text-[#565959]">
                  Toutes les boutiques sont affectées.
                </p>
              )}
            </div>
          </Carte>
        </>
      )}

      {affecter && (
        <Affectation boutique={affecter} rayons={rayons} familles={familles}
          onClose={() => setAff(null)}
          onFait={async () => {
            setAff(null);
            await chargerRayons(); await chargerRayon(actif); await chargerLibres(recherche);
          }} />
      )}
    </div>
  );
}

/* ── Créer un rayon ──────────────────────────────────────────────────────── */
function CreerRayon({ onFait }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom]   = useState("");
  const [zone, setZone] = useState("");
  const [ville, setVille] = useState("Douala");
  const [per, setPer]   = useState(500);
  const [msg, setMsg]   = useState("");

  const creer = async () => {
    const { error } = await supabase.rpc("admin_creer_rayon", {
      p_nom: nom, p_zone: zone, p_ville: ville, p_perimetre: Number(per) || 500,
    });
    if (error) { setMsg(error.message); return; }
    setOuvert(false); setNom(""); setZone(""); onFait();
  };

  if (!ouvert) return (
    <button onClick={() => setOuvert(true)}
      className="px-4 py-2.5 rounded-xl border border-dashed border-[#D5D9D9] text-[12px] font-bold text-[#565959] hover:border-[#FF9900] hover:text-[#0F1111]">
      + Nouveau rayon
    </button>
  );

  return (
    <div className="w-full bg-white rounded-xl border border-[#D5D9D9] p-4 space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Chaussure & Sport"
          className="bg-[#F7F8F8] border border-[#D5D9D9] rounded-lg px-3 py-2 text-[12px] outline-none" />
        <input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Marché Mboppi"
          className="bg-[#F7F8F8] border border-[#D5D9D9] rounded-lg px-3 py-2 text-[12px] outline-none" />
        <input value={ville} onChange={(e) => setVille(e.target.value)}
          className="bg-[#F7F8F8] border border-[#D5D9D9] rounded-lg px-3 py-2 text-[12px] outline-none" />
        <input value={per} onChange={(e) => setPer(e.target.value)} type="number" placeholder="500"
          className="bg-[#F7F8F8] border border-[#D5D9D9] rounded-lg px-3 py-2 text-[12px] outline-none" />
      </div>
      <p className="text-[11px] text-[#565959]">
        Le périmètre est la distance à pied. Au-delà de 500 m, le client ne
        constate plus tout de suite que ça marche.
      </p>
      {msg && <p className="text-[11px] text-[#B12704]">{msg}</p>}
      <div className="flex gap-2">
        <button onClick={creer} disabled={!nom || !zone}
          className="bg-[#232F3E] text-white rounded-lg px-4 py-2 text-[12px] font-bold disabled:opacity-40">
          Créer
        </button>
        <button onClick={() => setOuvert(false)} className="text-[12px] text-[#565959] px-2">Annuler</button>
      </div>
    </div>
  );
}

/* ── Ajouter une famille ─────────────────────────────────────────────────── */
function AjouterFamille({ rayonId, onFait }) {
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [v, setV]     = useState(120);
  const [role, setRole] = useState("moteur");
  const [msg, setMsg] = useState("");

  // Miroir de famille_p() et famille_porteurs_requis() : le super admin doit
  // voir le nombre de porteurs avant de valider, pas après.
  const p = Math.min(0.6, 2.2 / Math.sqrt(Math.max(Number(v) || 1, 1)));
  const requis = Math.max(4, Math.ceil(1 + Math.log(0.1) / Math.log(1 - p)));

  const ajouter = async () => {
    const { error } = await supabase.rpc("admin_maj_famille", {
      p_rayon_id: rayonId, p_nom: nom, p_variantes: Number(v), p_role: role, p_famille_id: null,
    });
    if (error) { setMsg(error.message); return; }
    setOuvert(false); setNom(""); onFait();
  };

  if (!ouvert) return (
    <button onClick={() => setOuvert(true)}
      className="text-[11px] font-bold text-[#007185] hover:underline whitespace-nowrap">
      + Sous-rayon
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Chaussures"
        className="bg-[#F7F8F8] border border-[#D5D9D9] rounded-lg px-3 py-1.5 text-[12px] outline-none w-40" />
      <input value={v} onChange={(e) => setV(e.target.value)} type="number" placeholder="variantes"
        className="bg-[#F7F8F8] border border-[#D5D9D9] rounded-lg px-3 py-1.5 text-[12px] outline-none w-24" />
      <select value={role} onChange={(e) => setRole(e.target.value)}
        className="bg-[#F7F8F8] border border-[#D5D9D9] rounded-lg px-2 py-1.5 text-[12px] outline-none">
        <option value="moteur">moteur</option>
        <option value="appoint">appoint</option>
        <option value="service">service</option>
      </select>
      <span className="text-[11px] text-[#565959]">→ {requis} porteurs</span>
      <button onClick={ajouter} disabled={!nom}
        className="bg-[#232F3E] text-white rounded-lg px-3 py-1.5 text-[11px] font-bold disabled:opacity-40">
        Ajouter
      </button>
      <button onClick={() => setOuvert(false)} className="text-[11px] text-[#565959]">Annuler</button>
      {msg && <span className="text-[11px] text-[#B12704]">{msg}</span>}
    </div>
  );
}

/* ── Modifier le rayon ───────────────────────────────────────────────────── */
function EditerRayon({ rayon, onClose, onFait }) {
  const [f, setF] = useState({
    nom: rayon.nom, zone: rayon.zone, ville: rayon.ville,
    perimetre: rayon.perimetre_m, plancher: rayon.plancher_recus,
    min: rayon.min_boutiques, max: rayon.max_boutiques,
  });
  const [msg, setMsg]   = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));

  const enregistrer = async () => {
    setBusy(true); setMsg("");
    const { error } = await supabase.rpc("admin_maj_rayon", {
      p_rayon_id: rayon.id,
      p_nom: f.nom, p_zone: f.zone, p_ville: f.ville,
      p_perimetre: Number(f.perimetre) || null,
      p_plancher:  Number(f.plancher)  || null,
      p_min: Number(f.min) || null,
      p_max: Number(f.max) || null,
    });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    onFait();
  };

  const supprimer = async () => {
    setBusy(true); setMsg("");
    const { error } = await supabase.rpc("admin_supprimer_rayon", { p_rayon_id: rayon.id });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    onFait();
  };

  const champ = "w-full bg-[#F7F8F8] border border-[#D5D9D9] rounded-lg px-3 py-2 text-[12px] outline-none focus:border-[#FF9900]";
  const label = "text-[9px] font-black uppercase tracking-widest text-[#565959] block mb-1";

  return (
    <div className="bg-white rounded-xl border border-[#232F3E] p-5 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div><label className={label}>Nom</label>
          <input className={champ} value={f.nom} onChange={(e) => set("nom", e.target.value)} /></div>
        <div><label className={label}>Zone</label>
          <input className={champ} value={f.zone} onChange={(e) => set("zone", e.target.value)} /></div>
        <div><label className={label}>Ville</label>
          <input className={champ} value={f.ville} onChange={(e) => set("ville", e.target.value)} /></div>
        <div><label className={label}>Périmètre (m)</label>
          <input className={champ} type="number" value={f.perimetre} onChange={(e) => set("perimetre", e.target.value)} /></div>
        <div><label className={label}>Plancher / mois</label>
          <input className={champ} type="number" value={f.plancher} onChange={(e) => set("plancher", e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={label}>Min</label>
            <input className={champ} type="number" value={f.min} onChange={(e) => set("min", e.target.value)} /></div>
          <div><label className={label}>Max</label>
            <input className={champ} type="number" value={f.max} onChange={(e) => set("max", e.target.value)} /></div>
        </div>
      </div>

      <p className="text-[11px] text-[#565959] leading-relaxed">
        Le <b>plancher</b> est le nombre de clients par mois en dessous duquel une
        boutique passe première à l’arbitrage : c’est ce qui empêche la mieux
        fournie de quitter le rayon. Les 60 par défaut sont une hypothèse non
        mesurée — d’où le réglage par rayon plutôt qu’une constante.
      </p>

      {msg && <p className="text-[12px] text-[#B12704]">{msg}</p>}

      <div className="flex items-center gap-2">
        <button onClick={enregistrer} disabled={busy}
          className="bg-[#232F3E] text-white rounded-lg px-4 py-2 text-[12px] font-bold disabled:opacity-40">
          Enregistrer
        </button>
        <button onClick={onClose} className="text-[12px] text-[#565959] px-2">Annuler</button>
        <button onClick={supprimer} disabled={busy}
          className="ml-auto text-[11px] font-bold text-[#B12704] hover:underline disabled:opacity-40">
          Supprimer le rayon
        </button>
      </div>
      <p className="text-[10px] text-[#565959]">
        Un rayon qui a des boutiques ou des relais dans son histoire ne se
        supprime pas : suspends-le. Effacer emporterait les compteurs, et le
        score des boutiques deviendrait faux ailleurs.
      </p>
    </div>
  );
}

/* ── Modifier un sous-rayon ──────────────────────────────────────────────────
   Le nombre de variantes est la seule donnée saisie du modèle : tout le reste
   en découle. Le corriger après le comptage réel recalcule le rayon entier,
   et peut ouvrir ou refermer la famille — d'où l'aperçu avant validation.
   ──────────────────────────────────────────────────────────────────────────── */
function EditerFamille({ famille, rayonId, onClose, onFait }) {
  const [nom, setNom]   = useState(famille.nom);
  const [v, setV]       = useState(famille.variantes);
  const [role, setRole] = useState(famille.role);
  const [msg, setMsg]   = useState("");
  const [busy, setBusy] = useState(false);
  const [confirme, setConf] = useState(false);

  const p = Math.min(0.6, 2.2 / Math.sqrt(Math.max(Number(v) || 1, 1)));
  const requis = Math.max(4, Math.ceil(1 + Math.log(0.1) / Math.log(1 - p)));
  const ouvrira = famille.porteurs >= requis;

  const enregistrer = async () => {
    setBusy(true); setMsg("");
    const { error } = await supabase.rpc("admin_maj_famille", {
      p_rayon_id: rayonId, p_nom: nom, p_variantes: Number(v),
      p_role: role, p_famille_id: famille.id,
    });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    onFait();
  };

  const supprimer = async () => {
    setBusy(true); setMsg("");
    const { data, error } = await supabase.rpc("admin_supprimer_famille", { p_famille_id: famille.id });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    if (data > 0) setMsg(`${data} rattachement(s) de boutique supprimé(s).`);
    onFait();
  };

  const champ = "bg-white border border-[#D5D9D9] rounded-lg px-3 py-2 text-[12px] outline-none focus:border-[#FF9900]";

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <input className={`${champ} w-48`} value={nom} onChange={(e) => setNom(e.target.value)} />
        <input className={`${champ} w-24`} type="number" value={v} onChange={(e) => setV(e.target.value)} />
        <select className={champ} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="moteur">moteur</option>
          <option value="appoint">appoint</option>
          <option value="service">service</option>
        </select>
        <button onClick={enregistrer} disabled={busy || !nom}
          className="bg-[#232F3E] text-white rounded-lg px-3 py-2 text-[11px] font-bold disabled:opacity-40">
          Enregistrer
        </button>
        <button onClick={onClose} className="text-[11px] text-[#565959] px-1">Annuler</button>
        {confirme ? (
          <button onClick={supprimer} disabled={busy}
            className="ml-auto text-[11px] font-bold text-white bg-[#B12704] rounded-lg px-3 py-2">
            Confirmer la suppression
          </button>
        ) : (
          <button onClick={() => setConf(true)}
            className="ml-auto text-[11px] font-bold text-[#B12704] hover:underline">
            Supprimer
          </button>
        )}
      </div>

      {/* Ce que le changement fait avant qu'il ne le fasse. */}
      <p className="text-[11px] text-[#565959]">
        {v} variantes → p = {p.toFixed(2)} → <b>{requis} porteurs nécessaires</b>.
        Cette famille en a {famille.porteurs} :{" "}
        {ouvrira
          ? <span className="text-[#007600] font-bold">elle restera ouverte</span>
          : <span className="text-[#B12704] font-bold">
              elle se fermera — il en manque {requis - famille.porteurs}
            </span>}.
      </p>
      {confirme && (
        <p className="text-[11px] text-[#B12704]">
          La supprimer retirera d’un coup le rattachement des {famille.porteurs} boutiques
          qui la tenaient, et la couverture qu’elle apportait disparaîtra.
        </p>
      )}
      {msg && <p className="text-[11px] text-[#B12704]">{msg}</p>}
    </div>
  );
}

/* ── Affecter ou modifier une boutique ───────────────────────────────────── */
function Affectation({ boutique, rayons, familles, onClose, onFait }) {
  const [rayonId, setRayonId] = useState(boutique.rayonId);
  const [cat, setCat]     = useState(boutique.categorie || "");
  const [profil, setProfil] = useState(boutique.profil || "emettrice");
  const [genre, setGenre] = useState(boutique.genre || "produit");
  const [abo, setAbo]     = useState(boutique.abonnement_fcfa ?? 15000);
  const [sel, setSel]     = useState([]);
  const [msg, setMsg]     = useState("");
  const [busy, setBusy]   = useState(false);

  // Quand on change de rayon, les familles proposées ne sont plus les mêmes.
  const [famsRayon, setFams] = useState(familles);
  useEffect(() => {
    if (rayonId === boutique.rayonId) { setFams(familles); return; }
    supabase.rpc("admin_familles", { p_rayon_id: rayonId })
      .then(({ data }) => setFams(data || []));
  }, [rayonId, boutique.rayonId, familles]);

  const valider = async () => {
    setBusy(true); setMsg("");
    const { error } = await supabase.rpc("admin_affecter_boutique", {
      p_vendor_id: boutique.vendor_id,
      p_rayon_id:  rayonId,
      p_categorie: cat || "Non précisée",
      p_profil:    profil,
      p_genre:     genre,
      p_abonnement: Number(abo) || 15000,
      p_familles:  sel.length ? sel : null,
    });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    onFait();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-[#E7E9EA]">
          <h3 className="text-[15px] font-black text-[#0F1111]">{boutique.shop_name}</h3>
          <p className="text-[11px] text-[#565959]">
            {boutique.changer ? "Modifier son rattachement" : "L’ajouter à un rayon"}
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[#565959] block mb-1.5">Rayon</label>
            <select value={rayonId} onChange={(e) => { setRayonId(e.target.value); setSel([]); }}
              className="w-full bg-[#F7F8F8] border border-[#D5D9D9] rounded-lg px-3 py-2.5 text-[13px] outline-none">
              {rayons.map((r) => <option key={r.id} value={r.id}>{r.nom} — {r.zone}</option>)}
            </select>
            {boutique.changer && (
              <p className="text-[11px] text-[#565959] mt-1.5">
                Changer de rayon désactive l’ancien rattachement. Les relais passés
                et les compteurs sont conservés — sinon le score des autres
                boutiques deviendrait faux rétroactivement.
              </p>
            )}
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[#565959] block mb-1.5">
              Catégorie de recrutement
            </label>
            <input value={cat} onChange={(e) => setCat(e.target.value)}
              placeholder="Chaussure généraliste, Basket et sneaker…"
              className="w-full bg-[#F7F8F8] border border-[#D5D9D9] rounded-lg px-3 py-2.5 text-[13px] outline-none" />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[#565959] block mb-1.5">Profil</label>
            <div className="space-y-1.5">
              {PROFILS.map(([k, l, d]) => (
                <button key={k} onClick={() => setProfil(k)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                    profil === k ? "border-[#232F3E] bg-[#F7F8F8]" : "border-[#E7E9EA]"}`}>
                  <p className="text-[12px] font-bold text-[#0F1111]">{l}</p>
                  <p className="text-[11px] text-[#565959]">{d}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#565959] block mb-1.5">Type</label>
              <select value={genre} onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-[#F7F8F8] border border-[#D5D9D9] rounded-lg px-3 py-2.5 text-[13px] outline-none">
                <option value="produit">Produits</option>
                <option value="service">Services</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-[#565959] block mb-1.5">Abonnement</label>
              <select value={abo} onChange={(e) => setAbo(e.target.value)}
                className="w-full bg-[#F7F8F8] border border-[#D5D9D9] rounded-lg px-3 py-2.5 text-[13px] outline-none">
                <option value={15000}>15 000 F — tarif plein</option>
                <option value={5000}>5 000 F — reçoit moins de 10 clients</option>
              </select>
            </div>
          </div>
          {genre === "service" && (
            <p className="text-[11px] text-[#565959] -mt-2">
              Un commerçant de services émet des relais et n’en reçoit pas. Il
              peut demander qu’un article lui soit livré, pour un client qu’il
              a déjà en main.
            </p>
          )}

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-[#565959] block mb-1.5">
              Ce qu’elle tient réellement
            </label>
            <div className="flex flex-wrap gap-1.5">
              {famsRayon.map((f) => {
                const on = sel.includes(f.id);
                return (
                  <button key={f.id}
                    onClick={() => setSel(on ? sel.filter((x) => x !== f.id) : [...sel, f.id])}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${
                      on ? "bg-[#232F3E] text-white" : "bg-[#F0F2F2] text-[#565959]"}`}>
                    {f.nom}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-[#565959] mt-1.5">
              Coche tout ce qu’elle vend, pas seulement sa spécialité : c’est ce
              qui donne le nombre de porteurs, et donc la couverture du rayon.
            </p>
          </div>

          {msg && <p className="text-[12px] text-[#B12704]">{msg}</p>}
        </div>

        <div className="px-5 py-4 border-t border-[#E7E9EA] flex gap-2">
          <button onClick={valider} disabled={busy}
            className="flex-1 bg-[#FF9900] text-[#0F1111] rounded-lg py-2.5 text-[13px] font-black disabled:opacity-40">
            {busy ? "…" : boutique.changer ? "Enregistrer" : "Ajouter au rayon"}
          </button>
          <button onClick={onClose} className="px-4 text-[13px] text-[#565959]">Annuler</button>
        </div>
      </div>
    </div>
  );
}
