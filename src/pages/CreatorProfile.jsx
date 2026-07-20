import React, { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getCreator, LIVE_SHOWS, formatCount } from "../lib/liveData";

const ShowThumb = ({ s }) => {
  const c = getCreator(s.creator);
  return (
    <Link to={s.live ? `/live/show-1` : `/creator/${s.creator}`}
      className="relative rounded-xl overflow-hidden group aspect-[3/4] block">
      <img src={s.cover} alt={s.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      <div className="absolute top-2 left-2">
        {s.live ? (
          <span className="flex items-center gap-1 bg-[#CC0C39] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />Live · {formatCount(s.viewers)}
          </span>
        ) : (
          <span className="bg-white/90 text-[#0F1111] text-[8px] font-black uppercase px-2 py-0.5 rounded-full">{s.startsAt}</span>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-2.5">
        <p className="text-white text-[11px] font-black leading-tight line-clamp-2">{s.title}</p>
        <p className="text-white/70 text-[9px]">{c.name}</p>
      </div>
    </Link>
  );
};

const CreatorProfile = () => {
  const { handle } = useParams();
  const navigate = useNavigate();
  const c = getCreator(handle);
  const [tab, setTab] = useState("all");
  const [following, setFollowing] = useState(false);

  const shows = LIVE_SHOWS;
  const filtered =
    tab === "upcoming" ? shows.filter(s => !s.live) :
    tab === "past"     ? shows.filter(s => !s.live) :
    shows;

  return (
    <div className="min-h-screen bg-[#EAEDED]">
      {/* COVER */}
      <div className="relative h-40 md:h-56 overflow-hidden bg-[#131921]">
        <img src={c.cover} alt="" className="w-full h-full object-cover opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#EAEDED] via-transparent to-black/20" />
        <button onClick={() => navigate(-1)} className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white">
          <i className="fa-solid fa-chevron-left text-sm" />
        </button>
        <button className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white">
          <i className="fa-regular fa-bell text-sm" />
        </button>
      </div>

      <div className="max-w-[900px] mx-auto px-4">
        {/* IDENTITY */}
        <div className="bg-white border border-[#D5D9D9] rounded-2xl -mt-12 relative p-5 shadow-sm">
          <div className="flex items-center justify-between">
            {/* followers */}
            <div className="text-center flex-1">
              <p className="text-xl font-black text-[#0F1111] leading-none">{formatCount(c.followers)}</p>
              <p className="text-[10px] text-[#565959] mt-1">Followers</p>
            </div>
            {/* avatar */}
            <div className="relative flex-shrink-0 -mt-14 mx-2">
              <div className={`w-24 h-24 rounded-full overflow-hidden border-4 ${c.live ? "border-[#CC0C39]" : "border-white"} shadow-md`}>
                <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
              </div>
              {c.live && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#CC0C39] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">Live</span>
              )}
            </div>
            {/* following */}
            <div className="text-center flex-1">
              <p className="text-xl font-black text-[#0F1111] leading-none">{c.following}</p>
              <p className="text-[10px] text-[#565959] mt-1">Following</p>
            </div>
          </div>

          <div className="text-center mt-3">
            <h1 className="text-lg font-black text-[#0F1111] flex items-center justify-center gap-1.5">
              {c.name}
              {c.verified && <i className="fa-solid fa-circle-check text-[#FF9900] text-sm" />}
            </h1>
            <p className="text-[12px] text-[#565959]">@{c.handle}</p>
            <p className="text-[11px] text-[#565959] mt-1">{c.bio}</p>
          </div>

          {/* ACTIONS */}
          <div className="flex items-center gap-2 mt-4">
            <button className="flex-1 flex items-center justify-center gap-2 bg-white border border-[#D5D9D9] hover:border-[#565959] text-[#0F1111] py-2.5 rounded-full font-black text-[12px] transition-all">
              <i className="fa-regular fa-comment" /> Message
            </button>
            <button onClick={() => setFollowing(f => !f)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-black text-[12px] transition-all ${
                following ? "bg-[#131921] text-white" : "bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200]"
              }`}>
              {following ? <><i className="fa-solid fa-check" /> Suivi</> : "Suivre"}
            </button>
          </div>

          {/* STATS */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { icon: "fa-star",        label: "Avis",       value: c.reviews },
              { icon: "fa-bag-shopping", label: "Vendus",    value: c.sold },
              { icon: "fa-clock",        label: "Livraison", value: `~${c.shipTime}` },
            ].map(s => (
              <div key={s.label} className="bg-[#F7F8FA] border border-[#EAEDED] rounded-xl py-2.5 text-center">
                <i className={`fa-solid ${s.icon} text-[#FF9900] text-xs mb-1`} />
                <p className="text-[13px] font-black text-[#0F1111] leading-none">{s.value}</p>
                <p className="text-[9px] text-[#565959] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-2 mt-5 mb-3">
          {[
            { key: "all",      label: "Tous les shows" },
            { key: "upcoming", label: "À venir" },
            { key: "past",     label: "Passés" },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-full text-[11px] font-black transition-all ${
                tab === t.key ? "bg-[#131921] text-white" : "bg-white text-[#565959] border border-[#D5D9D9] hover:border-[#565959]"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* SHOWS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pb-10">
          {filtered.map(s => <ShowThumb key={s.id} s={s} />)}
        </div>
      </div>
    </div>
  );
};

export default CreatorProfile;
