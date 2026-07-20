import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LiveVideo from "../components/LiveVideo";
import {
  fetchShows, fetchShow, fetchMessages, subscribeToShow, unsubscribe,
  postMessage, uploadLiveImage, placeBid, buyNow,
  isFollowing, toggleFollow, getFollowerCount, isSaved, toggleSave,
  formatCount, fcfa,
} from "../lib/liveApi";

const displayName = (user) =>
  user?.user_metadata?.display_name || user?.email?.split("@")[0] || "invité";

// ═══════════════════════════════════════════════════════════════
//   ONE LIVE (full screen). Realtime only when `active`.
// ═══════════════════════════════════════════════════════════════
const LiveSlide = ({ show: initial, active, user, addToCart }) => {
  const navigate = useNavigate();
  const uid = user?.id || null;
  const uname = displayName(user);

  const [show, setShow]         = useState(initial);
  const [product, setProduct]   = useState(initial.product || null);
  const [messages, setMessages] = useState([]);
  const [viewers, setViewers]   = useState(initial.viewer_count || 0);
  const [draft, setDraft]       = useState("");
  const [sending, setSending]   = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [saved, setSaved]       = useState(false);
  const [liked, setLiked]       = useState(false);
  const [soldFlash, setSoldFlash] = useState(false);
  const [busy, setBusy]         = useState("");
  const chatRef = useRef(null);
  const fileRef = useRef(null);
  const channelRef = useRef(null);

  const vendorId = show.vendor?.id || show.vendor_id;

  // Subscribe when active
  useEffect(() => {
    if (!active) return;
    let alive = true;
    (async () => {
      const [full, msgs, fCount, savedNow, followNow] = await Promise.all([
        fetchShow(show.id),
        fetchMessages(show.id),
        vendorId ? getFollowerCount(vendorId) : 0,
        isSaved(show.id, uid),
        vendorId ? isFollowing(vendorId, uid) : false,
      ]);
      if (!alive) return;
      if (full) { setShow(full); setProduct(full.product); }
      setMessages(msgs);
      setFollowers(fCount);
      setSaved(savedNow);
      setFollowing(followNow);

      channelRef.current = subscribeToShow(show.id, uid || `g-${Math.floor(performance.now())}`, {
        onMessage: (m) => setMessages(prev => [...prev.slice(-60), m]),
        onProduct: (p) => {
          setProduct(prev => (!prev || p.created_at >= prev.created_at) ? p : prev);
          if (p.status === "sold") { setSoldFlash(true); setTimeout(() => setSoldFlash(false), 3500); }
        },
        onShow: (s) => setShow(prev => ({ ...prev, ...s })),
        onViewers: (n) => setViewers(n),
      });
    })();
    return () => { alive = false; unsubscribe(channelRef.current); channelRef.current = null; };
  }, [active, show.id]);

  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const needAuth = () => { if (!uid) { navigate("/login"); return true; } return false; };

  const send = async (e) => {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    if (needAuth()) return;
    setSending(true);
    try { await postMessage({ showId: show.id, userId: uid, userName: uname, text: draft.trim() }); setDraft(""); }
    catch (err) { console.warn(err.message); }
    finally { setSending(false); }
  };

  const attachImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (needAuth()) return;
    if (file.size > 5 * 1024 * 1024) return;
    setUploadingImg(true);
    try {
      const url = await uploadLiveImage(file, uid);
      await postMessage({ showId: show.id, userId: uid, userName: uname, imageUrl: url });
    } catch (err) { console.warn(err.message); }
    finally { setUploadingImg(false); }
  };

  const onBid = async () => {
    if (needAuth() || !product) return;
    setBusy("bid");
    try { const p = await placeBid(product.id, uname); setProduct(p); }
    catch (err) { alert(err.message); }
    finally { setBusy(""); }
  };

  const onBuy = async () => {
    if (needAuth() || !product) return;
    setBusy("buy");
    try {
      const p = await buyNow(product.id, uname);
      setProduct(p);
      addToCart?.({ id: `live-${p.id}`, name: p.name, price: p.sold_price || p.buy_now, img: p.img, selectedSize: p.size || "—", selectedColor: "—", quantity: 1 });
    } catch (err) { alert(err.message); }
    finally { setBusy(""); }
  };

  const onFollow = async () => {
    if (needAuth() || !vendorId) return;
    const next = !following;
    setFollowing(next); setFollowers(c => c + (next ? 1 : -1));
    try { await toggleFollow(vendorId, uid, next); } catch { setFollowing(!next); }
  };

  const onSave = async () => {
    if (needAuth()) return;
    const next = !saved;
    setSaved(next);
    try { await toggleSave(show.id, uid, next); } catch { setSaved(!next); }
  };

  const onShare = async () => {
    const url = `${window.location.origin}/live/${show.id}`;
    try {
      if (navigator.share) await navigator.share({ title: show.title, url });
      else { await navigator.clipboard.writeText(url); alert("Lien copié !"); }
    } catch {}
  };

  const isLive = show.status === "live";
  const sold = product?.status === "sold";

  return (
    <div className="relative h-full w-full bg-black snap-start overflow-hidden">
      {/* VIDEO LIVE (WebRTC) — repli sur la couverture si non diffusé */}
      <LiveVideo room={show.id} publish={false} active={active && isLive}
        poster={show.cover_url} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/85 pointer-events-none" />

      {/* SOLD flash */}
      {soldFlash && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-[#CC0C39] text-white font-black text-3xl px-8 py-4 rounded-2xl -rotate-6 shadow-2xl animate-[pulse_0.6s_ease-in-out_3]">
            VENDU 🎉
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div className="absolute top-0 left-0 right-0 p-3 flex items-start justify-between gap-2 z-20">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/live")} className="w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white">
            <i className="fa-solid fa-chevron-left text-sm" />
          </button>
          <Link to={`/creator/${show.creatorHandle}`} className="flex items-center gap-2 bg-black/40 backdrop-blur rounded-full pl-1 pr-3 py-1">
            <img src={show.creatorAvatar} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-[#CC0C39] bg-white" />
            <div>
              <p className="text-white text-[11px] font-black leading-none">{show.creatorName}</p>
              <p className="text-white/70 text-[9px] leading-none mt-0.5">{formatCount(followers)} abonnés</p>
            </div>
          </Link>
          <button onClick={onFollow}
            className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-full transition-all ${following ? "bg-white/20 text-white" : "bg-[#FFD814] text-[#0F1111]"}`}>
            {following ? "Suivi" : "+ Suivre"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="flex items-center gap-1 bg-[#CC0C39] text-white text-[9px] font-black uppercase px-2 py-1 rounded-full tracking-wider">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />Live
            </span>
          ) : (
            <span className="bg-white/90 text-[#0F1111] text-[9px] font-black uppercase px-2 py-1 rounded-full">Bientôt</span>
          )}
          <span className="flex items-center gap-1 bg-black/40 backdrop-blur text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
            <i className="fa-solid fa-eye text-[9px]" />{formatCount(viewers)}
          </span>
        </div>
      </div>

      {/* SIDE ACTIONS */}
      <div className="absolute right-3 bottom-56 flex flex-col items-center gap-4 z-20">
        <button onClick={() => setLiked(l => !l)} className="flex flex-col items-center gap-1">
          <span className={`w-11 h-11 rounded-full backdrop-blur flex items-center justify-center transition-all ${liked ? "bg-[#CC0C39]" : "bg-black/40"}`}>
            <i className={`fa-${liked ? "solid" : "regular"} fa-heart text-white`} />
          </span>
          <span className="text-white text-[9px] font-bold">J'aime</span>
        </button>
        <button onClick={onSave} className="flex flex-col items-center gap-1">
          <span className={`w-11 h-11 rounded-full backdrop-blur flex items-center justify-center transition-all ${saved ? "bg-[#FFD814]" : "bg-black/40"}`}>
            <i className={`fa-${saved ? "solid" : "regular"} fa-bookmark ${saved ? "text-[#0F1111]" : "text-white"}`} />
          </span>
          <span className="text-white text-[9px] font-bold">Favori</span>
        </button>
        <button onClick={onShare} className="flex flex-col items-center gap-1">
          <span className="w-11 h-11 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"><i className="fa-solid fa-share text-white" /></span>
          <span className="text-white text-[9px] font-bold">Partager</span>
        </button>
        <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-1">
          <span className="w-11 h-11 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"><i className="fa-solid fa-image text-white" /></span>
          <span className="text-white text-[9px] font-bold">Photo</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={attachImage} />
      </div>

      {/* CHAT */}
      <div ref={chatRef} className="absolute left-0 right-16 bottom-52 max-h-44 overflow-y-auto hide-scrollbar px-3 space-y-1.5 z-20">
        {messages.map((m, i) => (
          <div key={m.id || i} className="flex items-start gap-2">
            <span className={`text-[11px] font-black flex-shrink-0 ${m.user_id === uid ? "text-[#FFD814]" : "text-white/80"}`}>{m.user_name || "invité"}</span>
            <div className="min-w-0">
              {m.text && <span className={`text-[11px] leading-tight ${m.kind === "bid" ? "text-[#FFD814] font-bold" : m.kind === "sold" ? "text-[#7CFC00] font-bold" : "text-white"}`}>{m.text}</span>}
              {m.image_url && <img src={m.image_url} alt="" className="mt-1 w-24 h-24 object-cover rounded-lg border border-white/20" />}
            </div>
          </div>
        ))}
        {uploadingImg && <p className="text-white/60 text-[10px]">Envoi de l'image…</p>}
      </div>

      {/* BOTTOM */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <div className="px-3 pb-2">
          <form onSubmit={send} className="flex items-center gap-2">
            <input value={draft} onChange={e => setDraft(e.target.value)} placeholder={uid ? "Dis quelque chose…" : "Connecte-toi pour commenter"}
              className="flex-1 bg-black/40 backdrop-blur border border-white/20 focus:border-white/50 focus:outline-none rounded-full px-4 py-2.5 text-sm text-white placeholder-white/50" />
            <button type="button" onClick={() => fileRef.current?.click()} className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white flex-shrink-0">
              <i className="fa-solid fa-camera text-sm" />
            </button>
          </form>
        </div>

        {product && (
          <div className="bg-white rounded-t-2xl p-3 space-y-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <img src={product.img} alt="" className="w-16 h-16 rounded-xl object-cover border border-[#D5D9D9]" />
                {sold && <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center"><span className="text-white text-[9px] font-black -rotate-12">VENDU</span></div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-black text-[#0F1111] truncate">{product.name}</p>
                <p className="text-[10px] text-[#565959] truncate">{product.size || (product.mode === "auction" ? "Enchère" : "Prix fixe")}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[#0F1111] font-black text-lg leading-none">{fcfa(product.current_bid || product.buy_now)}</p>
                  {product.high_bidder_name && !sold && <span className="text-[9px] text-[#565959]">meneur : {product.high_bidder_name}</span>}
                  {sold && <span className="text-[9px] text-[#CC0C39] font-bold">vendu à {product.sold_to_name}</span>}
                </div>
              </div>
            </div>
            {!sold ? (
              <div className="flex gap-2">
                {product.mode === "auction" && (
                  <button onClick={onBid} disabled={busy === "bid"}
                    className="flex-1 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] py-3 rounded-full font-black text-sm transition-all active:scale-95 disabled:opacity-50">
                    {busy === "bid" ? "…" : `Enchérir ${fcfa(product.next_bid)}`}
                  </button>
                )}
                {product.buy_now && (
                  <button onClick={onBuy} disabled={busy === "buy"}
                    className="flex-1 bg-[#131921] hover:bg-[#232F3E] text-white py-3 rounded-full font-black text-sm transition-all active:scale-95 disabled:opacity-50">
                    {busy === "buy" ? "…" : `Acheter · ${fcfa(product.buy_now)}`}
                  </button>
                )}
              </div>
            ) : (
              <div className="w-full bg-[#E8F5E8] text-[#007600] py-3 rounded-full font-black text-sm text-center">
                <i className="fa-solid fa-circle-check mr-1.5" /> Article vendu
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
//   TIKTOK-STYLE VERTICAL FEED
// ═══════════════════════════════════════════════════════════════
const LiveStream = ({ addToCart }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(id);
  const containerRef = useRef(null);
  const slideRefs = useRef({});

  useEffect(() => {
    (async () => {
      let list = await fetchShows({});
      // ensure the requested show is present & first
      if (id && !list.some(s => s.id === id)) {
        const one = await fetchShow(id);
        if (one) list = [one, ...list];
      } else if (id) {
        list = [...list.filter(s => s.id === id), ...list.filter(s => s.id !== id)];
      }
      setShows(list);
      setLoading(false);
      // scroll to requested
      setTimeout(() => slideRefs.current[id]?.scrollIntoView(), 50);
    })();
  }, []);

  // Track active slide
  const onScroll = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const idx = Math.round(c.scrollTop / c.clientHeight);
    const s = shows[idx];
    if (s && s.id !== activeId) {
      setActiveId(s.id);
      window.history.replaceState(null, "", `/live/${s.id}`);
    }
  }, [shows, activeId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[300] bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#FF9900] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!shows.length) {
    return (
      <div className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center text-center px-6">
        <i className="fa-solid fa-video-slash text-white/30 text-4xl mb-4" />
        <p className="text-white font-black text-lg mb-1">Aucun live en cours</p>
        <p className="text-white/60 text-sm mb-5">Reviens bientôt.</p>
        <button onClick={() => navigate("/live")} className="bg-[#FFD814] text-[#0F1111] font-black text-sm px-6 py-3 rounded-full">Retour</button>
      </div>
    );
  }

  return (
    <div ref={containerRef} onScroll={onScroll}
      className="fixed inset-0 z-[300] bg-black overflow-y-auto snap-y snap-mandatory hide-scrollbar">
      {shows.map(s => (
        <div key={s.id} ref={el => (slideRefs.current[s.id] = el)} className="h-[100dvh] w-full snap-start">
          <LiveSlide show={s} active={s.id === activeId} user={user} addToCart={addToCart} />
        </div>
      ))}
    </div>
  );
};

export default LiveStream;
