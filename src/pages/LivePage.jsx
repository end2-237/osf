import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LIVE_CATEGORIES, LIVE_FILTERS, LIVE_AUCTIONS, LIVE_SHOWS,
  getCreator, formatCount, fcfa, mmss,
} from "../lib/liveData";

// ─── AUCTION CARD ─────────────────────────────────────────────────────────────
const AuctionCard = ({ a }) => {
  const [left, setLeft] = useState(a.endsInSec);
  const creator = getCreator(a.creator);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setInterval(() => setLeft(l => (l > 0 ? l - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      onClick={() => navigate(`/live/show-1`)}
      className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden cursor-pointer group hover:shadow-md transition-all flex-shrink-0"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[#EAEDED]">
        <img src={a.img} alt={a.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        {/* top badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="flex items-center gap-1 bg-[#CC0C39] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />Live
          </span>
          <span className="flex items-center gap-1 bg-black/50 backdrop-blur text-white text-[8px] font-bold px-2 py-0.5 rounded-full">
            <i className="fa-solid fa-eye text-[7px]" />{formatCount(a.viewers)}
          </span>
        </div>
        {/* timer + bids */}
        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur text-white text-[9px] font-black px-2 py-0.5 rounded-full font-mono">
          {mmss(left)}
        </div>
        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur text-white text-[8px] font-bold px-2 py-0.5 rounded-full">
          {a.bids} enchères
        </div>
      </div>

      <div className="p-3">
        <p className="text-[12px] font-bold text-[#0F1111] leading-tight truncate">{a.title}</p>
        <p className="text-[10px] text-[#565959] mb-2 truncate">{a.size}</p>
        <div className="flex items-end justify-between mb-2.5">
          <div>
            <p className="text-[#0F1111] font-black text-base leading-none">{fcfa(a.currentBid)}</p>
            <p className="text-[9px] text-[#565959]">Enchère suiv. {fcfa(a.nextBid)}</p>
          </div>
          <div className="w-6 h-6 rounded-full overflow-hidden border border-[#D5D9D9] flex-shrink-0">
            <img src={creator.avatar} alt="" className="w-full h-full object-cover" />
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/live/show-1`); }}
          className="w-full bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] py-2 rounded-full font-black text-[11px] transition-all active:scale-95"
        >
          Enchérir {fcfa(a.currentBid)}
        </button>
      </div>
    </div>
  );
};

// ─── SHOW CARD ────────────────────────────────────────────────────────────────
const ShowCard = ({ s }) => {
  const creator = getCreator(s.creator);
  return (
    <Link to={s.live ? `/live/show-1` : `/creator/${s.creator}`}
      className="relative rounded-xl overflow-hidden group aspect-[3/4] block flex-shrink-0">
      <img src={s.cover} alt={s.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      {/* top */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        {s.live ? (
          <span className="flex items-center gap-1 bg-[#CC0C39] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />Live
          </span>
        ) : (
          <span className="bg-white/90 text-[#0F1111] text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
            {s.startsAt}
          </span>
        )}
        {s.live && (
          <span className="flex items-center gap-1 bg-black/50 backdrop-blur text-white text-[8px] font-bold px-2 py-0.5 rounded-full">
            <i className="fa-solid fa-eye text-[7px]" />{formatCount(s.viewers)}
          </span>
        )}
      </div>
      {/* bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <div className="flex items-center gap-2 mb-1">
          <img src={creator.avatar} alt="" className="w-6 h-6 rounded-full object-cover border border-white/50" />
          <span className="text-white text-[10px] font-bold truncate">{creator.name}</span>
        </div>
        <p className="text-white text-[11px] font-black leading-tight line-clamp-2">{s.title}</p>
      </div>
    </Link>
  );
};

// ═══════════════════════════════
//   LIVE HUB
// ═══════════════════════════════
const LivePage = () => {
  const [filter, setFilter] = useState("Robes");
  const [q, setQ] = useState("");

  return (
    <div className="min-h-screen bg-[#EAEDED]">
      {/* HEADER */}
      <div className="bg-gradient-to-b from-[#EAF4FB] to-[#EAEDED] px-4 md:px-8 pt-5 pb-3">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-black text-[#0F1111] leading-tight">Shop live deals</h1>
              <p className="text-[12px] text-[#565959]">Les créateurs mode sont en live 🔴</p>
            </div>
            <button className="w-10 h-10 bg-white border border-[#D5D9D9] rounded-full flex items-center justify-center hover:border-[#FF9900] transition-all">
              <i className="fa-regular fa-bell text-[#0F1111]" />
            </button>
          </div>

          {/* CATEGORIES */}
          <div className="flex items-start gap-4 overflow-x-auto hide-scrollbar pb-2">
            {LIVE_CATEGORIES.map(c => (
              <button key={c.key} className="flex flex-col items-center gap-1.5 flex-shrink-0 group">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-sm group-hover:border-[#FF9900] transition-all bg-white">
                  <img src={c.img} alt={c.label} className="w-full h-full object-cover" />
                </div>
                <span className="text-[11px] font-semibold text-[#0F1111]">{c.label}</span>
              </button>
            ))}
          </div>

          {/* SEARCH */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 relative">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-[#adb5bd] text-sm" />
              <input
                value={q} onChange={e => setQ(e.target.value)}
                placeholder="Rechercher un live streaming"
                className="w-full bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded-full pl-11 pr-4 py-3 text-sm text-[#0F1111] placeholder-[#adb5bd]"
              />
            </div>
            <button className="w-12 h-12 bg-[#131921] rounded-full flex items-center justify-center text-white flex-shrink-0 hover:bg-[#232F3E] transition-all">
              <i className="fa-solid fa-sliders text-sm" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4">
        {/* FILTER CHIPS */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar mb-5">
          {LIVE_FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-[12px] font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                filter === f ? "bg-[#131921] text-white" : "bg-white text-[#565959] border border-[#D5D9D9] hover:border-[#565959]"
              }`}>
              {f}
            </button>
          ))}
        </div>

        {/* LIVE AUCTIONS */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-[#0F1111]">Enchères live</h2>
              <span className="flex items-center gap-1 bg-[#CC0C39] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />Live Now
              </span>
            </div>
            <button className="text-[11px] font-black uppercase text-[#007185] hover:text-[#C45500]">Voir tout</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {LIVE_AUCTIONS.map(a => <AuctionCard key={a.id} a={a} />)}
          </div>
        </div>

        {/* LIVE SHOWS */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-black text-[#0F1111]">Live Shows</h2>
            <button className="text-[11px] font-black uppercase text-[#007185] hover:text-[#C45500]">Voir tout</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {LIVE_SHOWS.map(s => <ShowCard key={s.id} s={s} />)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivePage;
