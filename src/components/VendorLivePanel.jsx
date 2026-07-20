import React, { useState, useEffect, useRef } from "react";
import { supabase, uploadProductImage } from "../lib/supabase";
import LiveVideo from "./LiveVideo";
import {
  LIVE_CATEGORIES, getVendorShows, createShow, setShowStatus,
  addLiveProduct, endProduct, fetchActiveProduct, fetchMessages, fetchShowBids,
  subscribeToShow, unsubscribe, fcfa, formatCount,
} from "../lib/liveApi";

const inputCls = "w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-primary transition-colors";
const labelCls = "text-[9px] font-black uppercase text-zinc-400 tracking-widest block mb-1.5";

const STATUS_PILL = {
  scheduled: { label: "Programmé", cls: "bg-orange-500/10 text-orange-500" },
  live:      { label: "En direct",  cls: "bg-[#CC0C39]/10 text-[#CC0C39]" },
  ended:     { label: "Terminé",    cls: "bg-zinc-500/10 text-zinc-400" },
};

const VendorLivePanel = ({ vendor, onToast }) => {
  const [shows, setShows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm]       = useState({ title: "", category: LIVE_CATEGORIES[0].key });
  const [cover, setCover]     = useState(null);
  const [coverPrev, setCoverPrev] = useState(null);
  const [active, setActive]   = useState(null); // show being managed

  const load = async () => {
    setLoading(true);
    setShows(await getVendorShows(vendor.id));
    setLoading(false);
  };
  useEffect(() => { if (vendor?.id) load(); }, [vendor?.id]);

  const pickCover = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setCover(f); setCoverPrev(URL.createObjectURL(f));
  };

  const submitShow = async () => {
    if (!form.title.trim()) return onToast?.("Titre requis", "", "error");
    setCreating(true);
    try {
      let coverUrl = null;
      if (cover) coverUrl = await uploadProductImage(cover, vendor.id);
      await createShow({ vendor, title: form.title.trim(), category: form.category, coverUrl });
      setForm({ title: "", category: LIVE_CATEGORIES[0].key }); setCover(null); setCoverPrev(null);
      onToast?.("Live créé !", "Il est prêt à être lancé.", "success");
      load();
    } catch (e) { onToast?.("Erreur", e.message, "error"); }
    finally { setCreating(false); }
  };

  const changeStatus = async (show, status) => {
    try { await setShowStatus(show.id, status); onToast?.(status === "live" ? "Tu es en direct 🔴" : "Live terminé", "", "success"); load(); if (active?.id === show.id) setActive({ ...show, status }); }
    catch (e) { onToast?.("Erreur", e.message, "error"); }
  };

  if (loading) return <div className="py-10 text-center text-zinc-400 text-sm">Chargement…</div>;

  if (active) return <ManageShow show={active} vendor={vendor} onBack={() => { setActive(null); load(); }} onStatus={changeStatus} onToast={onToast} />;

  return (
    <div className="space-y-6">
      {/* CREATE */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-5">
        <h3 className="font-black italic uppercase tracking-tighter text-zinc-900 dark:text-white text-lg mb-4">
          <i className="fa-solid fa-video text-[#CC0C39] mr-2" />Nouveau live
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Titre du live</label>
            <input className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex : Drop sneakers du vendredi" />
            <label className={`${labelCls} mt-4`}>Catégorie</label>
            <select className={inputCls} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {LIVE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Miniature / couverture</label>
            <label className="block aspect-video rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-primary cursor-pointer overflow-hidden relative">
              {coverPrev
                ? <img src={coverPrev} alt="" className="w-full h-full object-cover" />
                : <span className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400"><i className="fa-solid fa-image text-2xl mb-1" /><span className="text-[11px] font-bold">Ajouter une image</span></span>}
              <input type="file" accept="image/*" className="hidden" onChange={pickCover} />
            </label>
          </div>
        </div>
        <button onClick={submitShow} disabled={creating}
          className="mt-4 bg-primary text-black px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider hover:scale-105 transition-all shadow-[0_4px_12px_rgba(0,255,136,0.2)] disabled:opacity-50">
          {creating ? "Création…" : "Créer le live"}
        </button>
      </div>

      {/* LIST */}
      <div>
        <h3 className="font-black italic uppercase tracking-tighter text-zinc-900 dark:text-white text-lg mb-3">Mes lives</h3>
        {shows.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-white/10 rounded-2xl p-10 text-center text-zinc-400 text-sm">
            Aucun live. Crée ton premier show ci-dessus.
          </div>
        ) : (
          <div className="space-y-2">
            {shows.map(s => {
              const st = STATUS_PILL[s.status] || STATUS_PILL.scheduled;
              return (
                <div key={s.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-3 flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
                    {s.cover_url ? <img src={s.cover_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-video text-zinc-300" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      <span className="text-[9px] text-zinc-400">{s.category}</span>
                    </div>
                    <p className="font-bold text-zinc-900 dark:text-white text-sm truncate">{s.title}</p>
                    <p className="text-[10px] text-zinc-400"><i className="fa-solid fa-eye mr-1" />{formatCount(s.viewer_count)} vues max</p>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {s.status !== "ended" && (
                      <button onClick={() => setActive(s)}
                        className="bg-zinc-900 dark:bg-primary text-white dark:text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-primary hover:text-black transition-all">
                        Gérer
                      </button>
                    )}
                    {s.status === "scheduled" && (
                      <button onClick={() => changeStatus(s, "live")}
                        className="bg-[#CC0C39] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-[#a30a2e] transition-all">
                        Passer live
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── MANAGE A SHOW (live monitor) ─────────────────────────────────────────────
const ManageShow = ({ show, vendor, onBack, onStatus, onToast }) => {
  const [product, setProduct]   = useState(null);
  const [messages, setMessages] = useState([]);
  const [bids, setBids]         = useState([]);
  const [viewers, setViewers]   = useState(0);
  const [pf, setPf]             = useState({ name: "", mode: "auction", start_price: "", bid_step: "500", buy_now: "" });
  const [pImg, setPImg]         = useState(null);
  const [pImgPrev, setPImgPrev] = useState(null);
  const [adding, setAdding]     = useState(false);
  const [camState, setCamState] = useState("idle");
  const chanRef = useRef(null);
  const chatRef = useRef(null);

  useEffect(() => {
    (async () => {
      setProduct(await fetchActiveProduct(show.id));
      setMessages(await fetchMessages(show.id));
      setBids(await fetchShowBids(show.id));
      chanRef.current = subscribeToShow(show.id, `host-${vendor.user_id}`, {
        onMessage: (m) => setMessages(prev => [...prev.slice(-80), m]),
        onProduct: (p) => setProduct(p),
        onViewers: (n) => setViewers(n),
      });
    })();
    return () => { unsubscribe(chanRef.current); };
  }, [show.id]);

  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight }); }, [messages]);

  const pickImg = (e) => { const f = e.target.files?.[0]; if (!f) return; setPImg(f); setPImgPrev(URL.createObjectURL(f)); };

  const addProduct = async () => {
    if (!pf.name.trim()) return onToast?.("Nom du produit requis", "", "error");
    setAdding(true);
    try {
      let img = null;
      if (pImg) img = await uploadProductImage(pImg, vendor.id);
      const p = await addLiveProduct(show.id, { ...pf, img });
      setProduct(p);
      setPf({ name: "", mode: "auction", start_price: "", bid_step: "500", buy_now: "" }); setPImg(null); setPImgPrev(null);
      onToast?.("Produit présenté à l'antenne", "", "success");
    } catch (e) { onToast?.("Erreur", e.message, "error"); }
    finally { setAdding(false); }
  };

  const isLive = show.status === "live";

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-sm font-bold"><i className="fa-solid fa-chevron-left mr-1.5" />Retour</button>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 bg-zinc-900 dark:bg-zinc-800 text-white text-[11px] font-black px-3 py-1.5 rounded-full">
            <i className="fa-solid fa-eye text-primary" />{formatCount(viewers)} en direct
          </span>
          {isLive
            ? <button onClick={() => onStatus(show, "ended")} className="bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase">Terminer</button>
            : <button onClick={() => onStatus(show, "live")} className="bg-[#CC0C39] text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase">Passer en direct</button>}
        </div>
      </div>

      {/* CAMÉRA (diffusion WebRTC) */}
      {isLive && (
        <div className="bg-black rounded-2xl overflow-hidden relative aspect-video max-w-md">
          <LiveVideo room={show.id} publish={true} active={true} poster={show.cover_url} className="w-full h-full" onState={setCamState} />
          <span className="absolute top-2 left-2 flex items-center gap-1 bg-[#CC0C39] text-white text-[9px] font-black uppercase px-2 py-1 rounded-full z-10">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />Ta caméra
          </span>
          {camState === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-center px-4">
              <p className="text-white/85 text-[11px] leading-relaxed">Caméra indisponible — autorise l'accès caméra dans le navigateur, et vérifie que la fonction <b>livekit-token</b> est déployée (voir docs/LIVE_SETUP.md).</p>
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* PRODUCT COMPOSER */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-5">
          <h3 className="font-black italic uppercase tracking-tighter text-zinc-900 dark:text-white mb-1">Présenter un article</h3>
          <p className="text-[11px] text-zinc-400 mb-4">Il s'affiche instantanément chez les spectateurs.</p>

          {product && product.status === "active" && (
            <div className="mb-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3 flex items-center gap-3">
              {product.img && <img src={product.img} alt="" className="w-12 h-12 rounded-lg object-cover" />}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{product.name}</p>
                <p className="text-[11px] text-zinc-400">{fcfa(product.current_bid || product.buy_now)} · {product.mode === "auction" ? `enchère (${product.high_bidder_name || "—"})` : "prix fixe"}</p>
              </div>
              <button onClick={() => endProduct(product.id)} className="text-[9px] font-black uppercase text-zinc-400 hover:text-[#CC0C39]">Clôturer</button>
            </div>
          )}
          {product && product.status === "sold" && (
            <div className="mb-4 bg-[#00ff88]/10 text-[#0a8f52] rounded-xl p-3 text-[12px] font-bold">
              <i className="fa-solid fa-circle-check mr-1.5" />{product.name} vendu à {product.sold_to_name} — {fcfa(product.sold_price)}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className={labelCls}>Nom de l'article</label>
              <input className={inputCls} value={pf.name} onChange={e => setPf(f => ({ ...f, name: e.target.value }))} placeholder="Cardigan tricot vintage" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Type</label>
                <select className={inputCls} value={pf.mode} onChange={e => setPf(f => ({ ...f, mode: e.target.value }))}>
                  <option value="auction">Enchère</option>
                  <option value="fixed">Prix fixe</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Photo</label>
                <label className="flex items-center justify-center h-[46px] rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-primary cursor-pointer overflow-hidden">
                  {pImgPrev ? <img src={pImgPrev} alt="" className="w-full h-full object-cover" /> : <i className="fa-solid fa-image text-zinc-400" />}
                  <input type="file" accept="image/*" className="hidden" onChange={pickImg} />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {pf.mode === "auction" && <>
                <div>
                  <label className={labelCls}>Départ (F)</label>
                  <input className={inputCls} type="number" value={pf.start_price} onChange={e => setPf(f => ({ ...f, start_price: e.target.value }))} placeholder="5000" />
                </div>
                <div>
                  <label className={labelCls}>Pas (F)</label>
                  <input className={inputCls} type="number" value={pf.bid_step} onChange={e => setPf(f => ({ ...f, bid_step: e.target.value }))} placeholder="500" />
                </div>
              </>}
              <div className={pf.mode === "auction" ? "" : "col-span-3"}>
                <label className={labelCls}>Achat direct (F)</label>
                <input className={inputCls} type="number" value={pf.buy_now} onChange={e => setPf(f => ({ ...f, buy_now: e.target.value }))} placeholder="28000" />
              </div>
            </div>
            <button onClick={addProduct} disabled={adding}
              className="w-full bg-primary text-black py-3 rounded-xl text-[11px] font-black uppercase tracking-wider hover:scale-[1.02] transition-all shadow-[0_4px_12px_rgba(0,255,136,0.2)] disabled:opacity-50">
              {adding ? "Envoi…" : "Présenter à l'antenne"}
            </button>
          </div>
        </div>

        {/* LIVE MONITOR */}
        <div className="space-y-5">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-4">
            <p className={labelCls}>Chat en direct</p>
            <div ref={chatRef} className="h-48 overflow-y-auto hide-scrollbar space-y-1.5 mt-2">
              {messages.length === 0 ? <p className="text-zinc-400 text-[11px]">Aucun message pour l'instant.</p> :
                messages.map((m, i) => (
                  <div key={m.id || i} className="flex items-start gap-2">
                    <span className="text-[11px] font-black text-zinc-500 flex-shrink-0">{m.user_name}</span>
                    <div className="min-w-0">
                      {m.text && <span className={`text-[11px] ${m.kind === "bid" ? "text-[#CC0C39] font-bold" : m.kind === "sold" ? "text-[#0a8f52] font-bold" : "text-zinc-700 dark:text-zinc-300"}`}>{m.text}</span>}
                      {m.image_url && <img src={m.image_url} alt="" className="mt-1 w-16 h-16 object-cover rounded-lg" />}
                    </div>
                  </div>
                ))}
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-4">
            <p className={labelCls}>Dernières enchères</p>
            <div className="mt-2 space-y-1.5">
              {bids.length === 0 ? <p className="text-zinc-400 text-[11px]">Aucune enchère.</p> :
                bids.slice(0, 8).map(b => (
                  <div key={b.id} className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">{b.user_name}</span>
                    <span className="font-black text-[#CC0C39]">{fcfa(b.amount)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorLivePanel;
