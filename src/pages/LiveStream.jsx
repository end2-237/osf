import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { LIVE_STREAM_DETAIL, getCreator, formatCount, fcfa } from "../lib/liveData";

const LiveStream = ({ addToCart }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const detail = LIVE_STREAM_DETAIL[id] || LIVE_STREAM_DETAIL["show-1"];
  const creator = getCreator(detail.creator);

  const [messages, setMessages]   = useState(detail.messages);
  const [draft, setDraft]         = useState("");
  const [bid, setBid]             = useState(detail.product.currentBid);
  const [nextBid, setNextBid]     = useState(detail.product.nextBid);
  const [following, setFollowing] = useState(false);
  const [liked, setLiked]         = useState(false);
  const [saved, setSaved]         = useState(false);
  const [likes, setLikes]         = useState(1200);
  const [viewers]                 = useState(detail.viewers);
  const chatRef = useRef(null);

  // auto-scroll chat
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  // simulate incoming chat
  useEffect(() => {
    const bots = ["Trop beau 😍", "Ça taille comment ?", "Je prends !", "🔥🔥", "Livraison Douala ?", "Combien le buy now ?"];
    const names = ["amina_237", "kevin.dla", "fashionista", "boss_lady", "yaya_cm"];
    const t = setInterval(() => {
      setMessages(m => [...m.slice(-40), {
        user: names[Math.floor((m.length * 7) % names.length)],
        text: bots[Math.floor((m.length * 3) % bots.length)],
      }]);
    }, 4200);
    return () => clearInterval(t);
  }, []);

  const send = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setMessages(m => [...m, { user: "vous", text: draft.trim(), me: true }]);
    setDraft("");
  };

  const placeBid = () => {
    const step = nextBid - bid;
    setBid(nextBid);
    setNextBid(nextBid + step);
    setMessages(m => [...m, { user: "vous", text: `a enchéri ${fcfa(nextBid)} 💰`, me: true, bid: true }]);
  };

  const buyNow = () => {
    addToCart?.({
      id: `live-${id}`,
      name: detail.product.name,
      price: detail.product.buyNow,
      img: detail.product.img,
      selectedSize: detail.product.size,
      selectedColor: "—",
      quantity: 1,
    });
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black">
      {/* VIDEO (placeholder) */}
      <img src={detail.poster} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />

      {/* TOP BAR */}
      <div className="absolute top-0 left-0 right-0 p-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white">
            <i className="fa-solid fa-chevron-left text-sm" />
          </button>
          <div className="flex items-center gap-2 bg-black/40 backdrop-blur rounded-full pl-1 pr-3 py-1">
            <div className="relative">
              <img src={creator.avatar} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-[#CC0C39]" />
            </div>
            <div>
              <p className="text-white text-[11px] font-black leading-none flex items-center gap-1">
                {creator.name}
                {creator.verified && <i className="fa-solid fa-circle-check text-[#FF9900] text-[9px]" />}
              </p>
              <p className="text-white/70 text-[9px] leading-none mt-0.5">
                <i className="fa-solid fa-star text-[#FFD814] text-[8px]" /> {creator.rating} ({creator.ratingCount})
              </p>
            </div>
            <button onClick={() => setFollowing(f => !f)}
              className={`ml-1 text-[9px] font-black uppercase px-2.5 py-1 rounded-full transition-all ${
                following ? "bg-white/20 text-white" : "bg-[#FFD814] text-[#0F1111]"
              }`}>
              {following ? "Suivi" : "+ Suivre"}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 bg-[#CC0C39] text-white text-[9px] font-black uppercase px-2 py-1 rounded-full tracking-wider">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />Live · {detail.elapsed}
          </span>
          <span className="flex items-center gap-1 bg-black/40 backdrop-blur text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
            <i className="fa-solid fa-eye text-[9px]" />{formatCount(viewers)}
          </span>
        </div>
      </div>

      {/* SIDE ACTIONS */}
      <div className="absolute right-3 bottom-64 flex flex-col items-center gap-4">
        <button onClick={() => { setLiked(l => !l); setLikes(n => liked ? n - 1 : n + 1); }} className="flex flex-col items-center gap-1">
          <span className={`w-11 h-11 rounded-full backdrop-blur flex items-center justify-center transition-all ${liked ? "bg-[#CC0C39]" : "bg-black/40"}`}>
            <i className={`fa-${liked ? "solid" : "regular"} fa-heart text-white`} />
          </span>
          <span className="text-white text-[9px] font-bold">{formatCount(likes)}</span>
        </button>
        <button onClick={() => setSaved(s => !s)} className="flex flex-col items-center gap-1">
          <span className={`w-11 h-11 rounded-full backdrop-blur flex items-center justify-center transition-all ${saved ? "bg-[#FFD814]" : "bg-black/40"}`}>
            <i className={`fa-${saved ? "solid" : "regular"} fa-bookmark ${saved ? "text-[#0F1111]" : "text-white"}`} />
          </span>
          <span className="text-white text-[9px] font-bold">320</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <span className="w-11 h-11 rounded-full bg-black/40 backdrop-blur flex items-center justify-center">
            <i className="fa-solid fa-share text-white" />
          </span>
          <span className="text-white text-[9px] font-bold">125</span>
        </button>
      </div>

      {/* CHAT */}
      <div ref={chatRef} className="absolute left-0 right-16 bottom-60 max-h-48 overflow-y-auto hide-scrollbar px-3 space-y-1.5">
        {messages.map((m, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={`text-[11px] font-black flex-shrink-0 ${m.me ? "text-[#FFD814]" : "text-white/80"}`}>{m.user}</span>
            <span className={`text-[11px] leading-tight ${m.bid ? "text-[#FFD814] font-bold" : "text-white"}`}>{m.text}</span>
          </div>
        ))}
      </div>

      {/* BOTTOM PANEL */}
      <div className="absolute bottom-0 left-0 right-0">
        {/* chat input */}
        <div className="px-3 pb-2">
          <form onSubmit={send} className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input value={draft} onChange={e => setDraft(e.target.value)}
                placeholder="Dis quelque chose…"
                className="w-full bg-black/40 backdrop-blur border border-white/20 focus:border-white/50 focus:outline-none rounded-full pl-4 pr-10 py-2.5 text-sm text-white placeholder-white/50" />
              <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-white">
                <i className="fa-regular fa-face-smile text-sm" />
              </button>
            </div>
          </form>
        </div>

        {/* product + CTA */}
        <div className="bg-white rounded-t-2xl p-3 space-y-3">
          <div className="flex items-center gap-3">
            <img src={detail.product.img} alt="" className="w-16 h-16 rounded-xl object-cover border border-[#D5D9D9]" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black text-[#0F1111] truncate">{detail.product.name}</p>
              <p className="text-[10px] text-[#565959] truncate">{detail.product.size}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[#0F1111] font-black text-lg leading-none">{fcfa(bid)}</p>
                <div className="flex items-center gap-2 text-[9px] text-[#565959]">
                  {detail.product.freeShipping && <span><i className="fa-solid fa-truck-fast text-[#007600] mr-0.5" />Livraison offerte</span>}
                  <span><i className="fa-solid fa-rotate-left text-[#007185] mr-0.5" />{detail.product.returns}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={placeBid}
              className="flex-1 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] py-3 rounded-full font-black text-sm transition-all active:scale-95">
              Enchérir {fcfa(nextBid)}
            </button>
            <button onClick={buyNow}
              className="flex-1 bg-[#131921] hover:bg-[#232F3E] text-white py-3 rounded-full font-black text-sm transition-all active:scale-95">
              Acheter · {fcfa(detail.product.buyNow)}
            </button>
          </div>
          <Link to={`/creator/${creator.handle}`} className="block text-center text-[10px] font-bold text-[#007185] hover:text-[#C45500]">
            Voir la boutique de {creator.name} →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LiveStream;
