import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

/* ════════════════════════════════════════════════════════════════════════════
   APRÈS LA LIVRAISON — confirmer, noter, retourner

   Le clic « livré » du vendeur ne libère pas l'argent : il ouvre une fenêtre
   de 48 h. Ces deux écrans sont ce que le client en fait.

     · ReviewPrompt   — s'ouvre tout seul dès qu'une commande livrée n'a pas
                        encore d'avis. Produit ET boutique, en un geste.
     · DeliveredOrders — dans le profil : confirmer la réception, ou demander
                        un retour tant que le délai court.

   Les règles ne sont pas ici. `submit_order_reviews`, `confirm_delivery` et
   `request_return` vérifient en base qu'on est bien l'acheteur, que la
   commande est livrée, qu'on n'a pas déjà répondu, et que le délai tient.
   ════════════════════════════════════════════════════════════════════════════ */

const money = (n) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} F`;

const remaining = (deadline) => {
  const ms = new Date(deadline) - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
};

/* ── Étoiles ──────────────────────────────────────────────────────────────── */
const Stars = ({ value, onChange, size = "text-2xl" }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map(n => (
      <button key={n} type="button" onClick={() => onChange(n)}
        className={`${size} transition-transform hover:scale-110`}
        aria-label={`${n} sur 5`}>
        <i className={`fa-solid fa-star ${n <= value ? "text-[#FF9900]" : "text-[#D5D9D9]"}`} />
      </button>
    ))}
  </div>
);

/* ════════════════════════════════════════════════════════════════════════════
   FENÊTRE D'AVIS
   ════════════════════════════════════════════════════════════════════════════ */
export const ReviewPrompt = ({ user }) => {
  const [order,   setOrder]   = useState(null);
  const [shop,    setShop]    = useState({ rating: 0, text: "" });
  const [items,   setItems]   = useState({});     // product_id → { rating, text }
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState("");
  const [done,    setDone]    = useState(false);
  const [skipped, setSkipped] = useState(() => {
    // Fermer la fenêtre ne doit pas la ramener à chaque page. Le report tient
    // la session ; la commande, elle, reste notable indéfiniment depuis le profil.
    try { return JSON.parse(sessionStorage.getItem("bt_review_skip") || "[]"); }
    catch { return []; }
  });

  useEffect(() => {
    if (!user) { setOrder(null); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase.rpc("my_delivered_orders");
      if (!alive) return;
      const next = (data || []).find(o => !o.reviewed_at && !skipped.includes(o.id));
      setOrder(next || null);
      if (next) {
        setShop({ rating: 0, text: "" });
        setItems(Object.fromEntries(
          (next.items || []).map(i => [i.product_id, { rating: 0, text: "" }])
        ));
        setDone(false); setError("");
      }
    })();
    return () => { alive = false; };
  }, [user, skipped]);

  const skip = () => {
    const next = [...skipped, order.id];
    try { sessionStorage.setItem("bt_review_skip", JSON.stringify(next)); } catch { /* ignore */ }
    setSkipped(next);
  };

  const submit = async () => {
    if (!shop.rating) return setError("Donne une note à la boutique.");
    setBusy(true); setError("");
    const payload = Object.entries(items)
      .filter(([, v]) => v.rating > 0)
      .map(([product_id, v]) => ({ product_id, rating: v.rating, text: v.text?.trim() || null }));

    const { error: e } = await supabase.rpc("submit_order_reviews", {
      p_order_id: order.id,
      p_shop_rating: shop.rating,
      p_shop_text: shop.text.trim() || null,
      p_items: payload,
    });
    setBusy(false);
    if (e) return setError(e.message);
    setDone(true);
    setTimeout(() => { skip(); }, 1800);
  };

  if (!user || !order) return null;

  return (
    <div className="fixed inset-0 z-[1400] flex items-end sm:items-center justify-center p-3"
      style={{ background: "rgba(15,17,17,.5)" }}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden">
        {done ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-[#E8F5E8] flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-check text-[#007600] text-xl" />
            </div>
            <p className="font-black text-[#0F1111] text-lg mb-1">Merci !</p>
            <p className="text-[13px] text-[#565959]">
              Ton avis est publié. Il aide les prochains acheteurs à choisir.
            </p>
          </div>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-[#D5D9D9] flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#FF9900] mb-0.5">
                  Commande reçue
                </p>
                <p className="font-black text-[#0F1111] text-[15px] truncate">
                  Comment s'est passée ta commande ?
                </p>
                <p className="text-[11px] text-[#565959] truncate">
                  #{order.order_number || String(order.id).slice(0, 8)} · {order.shop_name}
                </p>
              </div>
              <button onClick={skip} className="w-8 h-8 rounded-full text-[#565959] flex-shrink-0"
                aria-label="Plus tard">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* La boutique */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#565959] mb-2">
                  La boutique — accueil, emballage, délai
                </p>
                <div className="flex items-center gap-3 mb-2">
                  <Stars value={shop.rating} onChange={r => { setShop(s => ({ ...s, rating: r })); setError(""); }} />
                  <span className="text-[12px] text-[#565959]">
                    {["", "Très déçu", "Décevant", "Correct", "Bien", "Excellent"][shop.rating]}
                  </span>
                </div>
                <textarea value={shop.text} onChange={e => setShop(s => ({ ...s, text: e.target.value }))}
                  rows={2} placeholder="Un mot sur le service de la boutique…"
                  className="w-full bg-[#F7F8F8] border border-[#D5D9D9] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#FF9900] resize-none" />
              </div>

              {/* Les produits */}
              {(order.items || []).length > 0 && (
                <div className="border-t border-[#EAEDED] pt-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#565959] mb-3">
                    Ce que tu as reçu
                  </p>
                  <div className="space-y-4">
                    {order.items.map(it => (
                      <div key={it.product_id} className="flex gap-3">
                        <div className="w-12 h-12 rounded-lg bg-[#F7F8F8] overflow-hidden flex-shrink-0">
                          {it.img && <img src={it.img} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[13px] text-[#0F1111] truncate">{it.name}</p>
                          <Stars size="text-lg"
                            value={items[it.product_id]?.rating || 0}
                            onChange={r => setItems(m => ({ ...m, [it.product_id]: { ...m[it.product_id], rating: r } }))} />
                          {items[it.product_id]?.rating > 0 && (
                            <textarea
                              value={items[it.product_id]?.text || ""}
                              onChange={e => setItems(m => ({ ...m, [it.product_id]: { ...m[it.product_id], text: e.target.value } }))}
                              rows={2} placeholder="Ton avis sur ce produit…"
                              className="w-full mt-2 bg-[#F7F8F8] border border-[#D5D9D9] rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#FF9900] resize-none" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#565959] mt-3">
                    Laisse un produit sans étoile si tu ne veux pas le noter.
                  </p>
                </div>
              )}

              {error && (
                <p className="text-[12px] font-bold text-[#B12704]">
                  <i className="fa-solid fa-circle-exclamation mr-1.5" />{error}
                </p>
              )}
            </div>

            <div className="px-5 py-4 border-t border-[#D5D9D9] flex gap-2">
              <button onClick={skip} disabled={busy}
                className="text-[12px] font-bold px-4 py-3 rounded-xl text-[#565959] hover:bg-[#F7F8F8]">
                Plus tard
              </button>
              <button onClick={submit} disabled={busy}
                className="flex-1 bg-[#FF9900] hover:bg-[#e08800] text-[#0F1111] text-[13px] font-black py-3 rounded-xl disabled:opacity-50">
                {busy ? "Envoi…" : "Publier mon avis"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   MES COMMANDES REÇUES — confirmer ou retourner
   ════════════════════════════════════════════════════════════════════════════ */
const RETURN_LABEL = {
  none:      { text: "—",                    cls: "" },
  requested: { text: "Retour demandé",       cls: "bg-[#FFF8D3] text-[#B26200] border-[#FCD200]/50" },
  approved:  { text: "Retour accepté",       cls: "bg-[#E8F5E8] text-[#007600] border-[#007600]/30" },
  rejected:  { text: "Retour refusé",        cls: "bg-[#FEE7E5] text-[#B12704] border-[#B12704]/30" },
  returned:  { text: "Produit retourné",     cls: "bg-[#EAEDED] text-[#565959] border-[#D5D9D9]" },
};

/* Le code que le client lit au livreur. C'est ce qui rend la remise prouvable,
   donc il doit être trouvable sans chercher. */
const ActiveCodes = () => {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    supabase.rpc("my_active_deliveries").then(({ data }) => setRows(data || []));
  }, []);
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      {rows.map(r => (
        <div key={r.id} className="bg-[#131921] rounded-xl px-4 py-3.5 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#FF9900] mb-0.5">
              Code de livraison
            </p>
            <p className="text-[12px] text-white font-bold truncate">
              #{r.order_number || String(r.id).slice(0, 8)} · {r.shop_name}
            </p>
            <p className="text-[10px] text-[#ADBAC7] mt-0.5">
              Donne ces chiffres au livreur au moment où il te remet le colis.
            </p>
          </div>
          <p className="text-2xl font-black text-white tracking-[0.25em] flex-shrink-0"
            style={{ fontVariantNumeric: "tabular-nums" }}>
            {r.delivery_code}
          </p>
        </div>
      ))}
    </div>
  );
};

/* Séparer « jamais reçu » du reste : la première affirmation se vérifie avec le
   code de livraison, les autres non. */
const RETURN_KINDS = [
  { key: "not_received", label: "Jamais reçu",     icon: "fa-ban" },
  { key: "damaged",      label: "Produit abîmé",   icon: "fa-heart-crack" },
  { key: "wrong_item",   label: "Mauvais article", icon: "fa-shuffle" },
  { key: "other",        label: "Autre",           icon: "fa-ellipsis" },
];

export const DeliveredOrders = () => {
  const [kind,    setKind]    = useState("damaged");
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId,  setOpenId]  = useState(null);
  const [reason,  setReason]  = useState("");
  const [busy,    setBusy]    = useState(false);
  const [msg,     setMsg]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("my_delivered_orders");
    if (error) setMsg({ type: "error", text: error.message });
    setList(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirm = async (id) => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("confirm_delivery", { p_order_id: id });
    setBusy(false);
    if (error) return setMsg({ type: "error", text: error.message });
    setMsg({ type: "ok", text: "Réception confirmée. Merci !" });
    load();
  };

  const askReturn = async (id) => {
    if (reason.trim().length < 5) return setMsg({ type: "error", text: "Explique en quelques mots ce qui ne va pas." });
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("request_return", {
      p_order_id: id, p_reason: reason.trim(), p_kind: kind,
    });
    setBusy(false);
    if (error) return setMsg({ type: "error", text: error.message });

    // Prévenir la boutique par courriel. La demande est déjà enregistrée : si
    // l'envoi échoue, elle reste valable et visible dans le tableau de bord.
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        apikey:          import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ type: "vendor_return_request", order_id: id }),
    }).catch(() => {});

    setOpenId(null); setReason(""); setKind("damaged");
    setMsg({ type: "ok", text: "Demande envoyée. La boutique et Buyticle en sont informés." });
    load();
  };

  if (loading) return <div className="h-24 bg-[#F7F8F8] rounded-xl animate-pulse" />;

  if (list.length === 0) return (
    <div className="bg-white border border-[#D5D9D9] rounded-xl text-center py-12 px-4">
      <i className="fa-solid fa-box-open text-[#D5D9D9] text-4xl mb-3 block" />
      <p className="font-black text-[#0F1111] uppercase text-sm">Aucune commande reçue</p>
      <p className="text-[10px] text-[#565959] mt-1">
        Tes commandes livrées apparaîtront ici, avec l'option de retour.
      </p>
    </div>
  );

  return (
    <div className="space-y-3">
      <ActiveCodes />

      <div className="bg-[#F7F8F8] border border-[#D5D9D9] rounded-xl px-4 py-3">
        <p className="text-[11px] text-[#565959] leading-relaxed">
          <i className="fa-solid fa-circle-info mr-1.5 text-[#007185]" />
          Tu as <strong className="text-[#0F1111]">48 h après la livraison</strong> pour demander un retour.
          Pendant ce délai, l'argent reste retenu par Buyticle et n'est pas versé à la boutique.
          Confirmer la réception libère le paiement et clôt le délai.
        </p>
      </div>

      {msg && (
        <p className={`text-[12px] font-bold ${msg.type === "error" ? "text-[#B12704]" : "text-[#007600]"}`}>
          <i className={`fa-solid ${msg.type === "error" ? "fa-circle-exclamation" : "fa-circle-check"} mr-1.5`} />
          {msg.text}
        </p>
      )}

      {list.map(o => {
        const left = o.can_return ? remaining(o.return_deadline) : null;
        const ret  = RETURN_LABEL[o.return_status] || RETURN_LABEL.none;
        return (
          <div key={o.id} className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden">
            <div className="p-4 flex items-start gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-black text-[13px] text-[#0F1111]">
                    #{o.order_number || String(o.id).slice(0, 8)}
                  </p>
                  {o.return_status !== "none" && (
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${ret.cls}`}>
                      {ret.text}
                    </span>
                  )}
                  {o.confirmed_at && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border bg-[#E8F5E8] text-[#007600] border-[#007600]/30">
                      Réception confirmée
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#565959]">{o.shop_name}</p>
                <p className="text-[10px] text-[#565959] mt-1">
                  Livrée le {o.delivered_at ? new Date(o.delivered_at).toLocaleDateString("fr-FR",
                    { day: "2-digit", month: "long", year: "numeric" }) : "—"}
                  {left && <> · <strong className="text-[#B26200]">retour possible encore {left}</strong></>}
                </p>
                {o.delivery_proof === "code" && (
                  <p className="text-[10px] text-[#007600] font-bold mt-1">
                    <i className="fa-solid fa-key mr-1" />Remise confirmée par ton code
                  </p>
                )}
                {o.return_reason && (
                  <p className="text-[11px] text-[#565959] mt-1.5 italic">« {o.return_reason} »</p>
                )}
              </div>
              <p className="font-black text-[15px] text-[#0F1111]">{money(o.total_amount)}</p>
            </div>

            {(o.can_return || (!o.confirmed_at && o.return_status === "none")) && (
              <div className="border-t border-[#EAEDED] bg-[#FAFAFA] px-4 py-3">
                {openId === o.id ? (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#565959] block">
                      Que s'est-il passé ?
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      {RETURN_KINDS.map(k => (
                        <button key={k.key} type="button" onClick={() => { setKind(k.key); setMsg(null); }}
                          className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-colors ${
                            kind === k.key
                              ? "bg-[#131921] text-[#FF9900] border-[#131921]"
                              : "bg-white text-[#565959] border-[#D5D9D9] hover:border-[#565959]"
                          }`}>
                          <i className={`fa-solid ${k.icon} mr-1.5`} />{k.label}
                        </button>
                      ))}
                    </div>
                    {kind === "not_received" && o.delivery_proof === "code" && (
                      <p className="text-[10px] text-[#B12704] font-bold">
                        <i className="fa-solid fa-triangle-exclamation mr-1" />
                        Le livreur a saisi ton code de livraison : la réception est établie.
                        Choisis le motif qui correspond au vrai problème.
                      </p>
                    )}
                    <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
                      placeholder="Article abîmé, mauvaise taille, jamais reçu…"
                      className="w-full bg-white border border-[#D5D9D9] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-[#FF9900] resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => askReturn(o.id)} disabled={busy}
                        className="bg-[#B12704] hover:bg-[#8c1f03] text-white text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-lg disabled:opacity-50">
                        {busy ? "Envoi…" : "Envoyer la demande"}
                      </button>
                      <button onClick={() => { setOpenId(null); setReason(""); setMsg(null); }} disabled={busy}
                        className="text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-lg text-[#565959] hover:bg-[#EAEDED]">
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => confirm(o.id)} disabled={busy}
                      className="bg-[#007600] hover:bg-[#005c00] text-white text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-lg disabled:opacity-50">
                      <i className="fa-solid fa-check mr-1.5" />Tout est bon
                    </button>
                    {o.can_return && (
                      <button onClick={() => { setOpenId(o.id); setMsg(null); }} disabled={busy}
                        className="bg-white border border-[#B12704]/40 text-[#B12704] hover:bg-[#FEE7E5] text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-lg disabled:opacity-50">
                        <i className="fa-solid fa-rotate-left mr-1.5" />Retourner
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
