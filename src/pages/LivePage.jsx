import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LIVE_CATEGORIES, fetchShows, formatCount } from "../lib/liveApi";

// ─── SHOW CARD ────────────────────────────────────────────────────────────────
const ShowCard = ({ s }) => (
  <Link to={`/live/${s.id}`} className="relative rounded-xl overflow-hidden group aspect-[3/4] block bg-[#131921]">
    {s.cover_url
      ? <img src={s.cover_url} alt={s.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      : <div className="w-full h-full bg-gradient-to-br from-[#232F3E] to-[#131921] flex items-center justify-center"><i className="fa-solid fa-video text-white/20 text-3xl" /></div>}
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
    <div className="absolute top-2 left-2 flex items-center gap-1.5">
      {s.status === "live" ? (
        <span className="flex items-center gap-1 bg-[#CC0C39] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />Live
        </span>
      ) : (
        <span className="bg-white/90 text-[#0F1111] text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">Bientôt</span>
      )}
      {s.status === "live" && (
        <span className="flex items-center gap-1 bg-black/50 backdrop-blur text-white text-[8px] font-bold px-2 py-0.5 rounded-full">
          <i className="fa-solid fa-eye text-[7px]" />{formatCount(s.viewer_count)}
        </span>
      )}
    </div>
    <div className="absolute bottom-0 left-0 right-0 p-3">
      <div className="flex items-center gap-2 mb-1">
        <img src={s.creatorAvatar} alt="" className="w-6 h-6 rounded-full object-cover border border-white/50 bg-white" />
        <span className="text-white text-[10px] font-bold truncate">{s.creatorName}</span>
      </div>
      <p className="text-white text-[11px] font-black leading-tight line-clamp-2">{s.title}</p>
    </div>
  </Link>
);

const SkeletonCard = () => <div className="aspect-[3/4] rounded-xl bg-white/60 animate-pulse" />;

// ═══════════════════════════════
//   LIVE HUB
// ═══════════════════════════════
const LivePage = () => {
  const { isVendor } = useAuth();
  const [category, setCategory] = useState("All");
  const [q, setQ] = useState("");
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchShows({ category }).then(data => { setShows(data); setLoading(false); });
  }, [category]);

  const filtered = q.trim()
    ? shows.filter(s => s.title?.toLowerCase().includes(q.toLowerCase()) || s.creatorName?.toLowerCase().includes(q.toLowerCase()))
    : shows;
  const liveNow   = filtered.filter(s => s.status === "live");
  const upcoming  = filtered.filter(s => s.status !== "live");

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
            {isVendor && (
              <Link to="/admin?tab=live" className="flex items-center gap-2 bg-[#CC0C39] text-white text-[11px] font-black px-4 py-2.5 rounded-full hover:bg-[#a30a2e] transition-all">
                <i className="fa-solid fa-video" /> Passer en live
              </Link>
            )}
          </div>

          {/* CATEGORIES */}
          <div className="flex items-start gap-3 overflow-x-auto hide-scrollbar pb-2">
            <button onClick={() => setCategory("All")}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 group">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${category === "All" ? "bg-[#FF9900] text-white" : "bg-white border border-[#D5D9D9] text-[#565959]"}`}>
                <i className="fa-solid fa-fire text-lg" />
              </div>
              <span className="text-[10px] font-bold text-[#0F1111]">Tout</span>
            </button>
            {LIVE_CATEGORIES.map(c => (
              <button key={c.key} onClick={() => setCategory(c.key)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 group">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${category === c.key ? "bg-[#FF9900] text-white" : "bg-white border border-[#D5D9D9] text-[#565959] group-hover:border-[#FF9900]"}`}>
                  <i className={`fa-solid ${c.icon} text-lg`} />
                </div>
                <span className="text-[10px] font-bold text-[#0F1111] whitespace-nowrap">{c.label}</span>
              </button>
            ))}
          </div>

          {/* SEARCH */}
          <div className="relative mt-2">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-[#adb5bd] text-sm" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un live"
              className="w-full bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded-full pl-11 pr-4 py-3 text-sm text-[#0F1111] placeholder-[#adb5bd]" />
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-white border border-[#D5D9D9] rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-video-slash text-[#D5D9D9] text-2xl" />
            </div>
            <h2 className="text-lg font-black text-[#0F1111] mb-1">Aucun live pour le moment</h2>
            <p className="text-[#565959] text-sm mb-5">Reviens bientôt — les créateurs lancent leurs lives régulièrement.</p>
            {isVendor && (
              <Link to="/admin?tab=live" className="inline-flex items-center gap-2 bg-[#CC0C39] text-white text-[12px] font-black px-5 py-2.5 rounded-full">
                <i className="fa-solid fa-video" /> Lance ton live
              </Link>
            )}
          </div>
        ) : (
          <>
            {liveNow.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-lg font-black text-[#0F1111]">En direct</h2>
                  <span className="flex items-center gap-1 bg-[#CC0C39] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />Live Now
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {liveNow.map(s => <ShowCard key={s.id} s={s} />)}
                </div>
              </div>
            )}
            {upcoming.length > 0 && (
              <div>
                <h2 className="text-lg font-black text-[#0F1111] mb-3">Bientôt en live</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {upcoming.map(s => <ShowCard key={s.id} s={s} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LivePage;
