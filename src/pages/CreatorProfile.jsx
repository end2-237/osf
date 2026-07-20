import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import {
  getFollowerCount, isFollowing, toggleFollow, getVendorShows,
  formatCount, AVATAR_FALLBACK,
} from "../lib/liveApi";

const ShowThumb = ({ s }) => (
  <Link to={`/live/${s.id}`} className="relative rounded-xl overflow-hidden group aspect-[3/4] block bg-[#131921]">
    {s.cover_url
      ? <img src={s.cover_url} alt={s.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      : <div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-video text-white/20 text-2xl" /></div>}
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
    <div className="absolute top-2 left-2">
      {s.status === "live" ? (
        <span className="flex items-center gap-1 bg-[#CC0C39] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />Live
        </span>
      ) : (
        <span className="bg-white/90 text-[#0F1111] text-[8px] font-black uppercase px-2 py-0.5 rounded-full">
          {s.status === "ended" ? "Terminé" : "Bientôt"}
        </span>
      )}
    </div>
    <div className="absolute bottom-0 left-0 right-0 p-2.5">
      <p className="text-white text-[11px] font-black leading-tight line-clamp-2">{s.title}</p>
    </div>
  </Link>
);

const CreatorProfile = () => {
  const { handle } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [vendor, setVendor]   = useState(null);
  const [profile, setProfile] = useState(null);
  const [shows, setShows]     = useState([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(false);
  const [tab, setTab]         = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // handle = shop_name (ou user_id en repli)
      let { data: v } = await supabase.from("vendors").select("*").eq("shop_name", handle).maybeSingle();
      if (!v) { const r = await supabase.from("vendors").select("*").eq("user_id", handle).maybeSingle(); v = r.data; }
      if (!v) { setLoading(false); return; }
      setVendor(v);
      const [{ data: prof }, sh, fc, fol] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url, city").eq("id", v.user_id).maybeSingle(),
        getVendorShows(v.id),
        getFollowerCount(v.id),
        isFollowing(v.id, user?.id),
      ]);
      setProfile(prof || {});
      setShows(sh);
      setFollowers(fc);
      setFollowing(fol);
      setLoading(false);
    })();
  }, [handle, user?.id]);

  const onFollow = async () => {
    if (!user) { navigate("/login"); return; }
    const next = !following;
    setFollowing(next); setFollowers(c => c + (next ? 1 : -1));
    try { await toggleFollow(vendor.id, user.id, next); } catch { setFollowing(!next); }
  };

  if (loading) return <div className="min-h-screen bg-[#EAEDED] flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#FF9900] border-t-transparent rounded-full animate-spin" /></div>;
  if (!vendor)  return (
    <div className="min-h-screen bg-[#EAEDED] flex flex-col items-center justify-center text-center px-6">
      <i className="fa-solid fa-user-slash text-[#D5D9D9] text-4xl mb-3" />
      <p className="font-black text-[#0F1111] text-lg mb-1">Créateur introuvable</p>
      <Link to="/live" className="text-[#007185] font-bold text-sm mt-2">← Retour aux lives</Link>
    </div>
  );

  const name   = vendor.shop_name || profile?.full_name || "Créateur";
  const avatar = profile?.avatar_url || (AVATAR_FALLBACK + encodeURIComponent(name));
  const cover  = shows.find(s => s.cover_url)?.cover_url;
  const isLive = shows.some(s => s.status === "live");
  const liveCount = shows.filter(s => s.status === "live").length;

  const filtered =
    tab === "upcoming" ? shows.filter(s => s.status === "scheduled") :
    tab === "past"     ? shows.filter(s => s.status === "ended") :
    shows;

  return (
    <div className="min-h-screen bg-[#EAEDED]">
      {/* COVER */}
      <div className="relative h-40 md:h-56 overflow-hidden bg-[#131921]">
        {cover
          ? <img src={cover} alt="" className="w-full h-full object-cover opacity-90" />
          : <div className="w-full h-full bg-gradient-to-br from-[#232F3E] to-[#131921]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#EAEDED] via-transparent to-black/20" />
        <button onClick={() => navigate(-1)} className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white">
          <i className="fa-solid fa-chevron-left text-sm" />
        </button>
      </div>

      <div className="max-w-[900px] mx-auto px-4">
        {/* IDENTITY */}
        <div className="bg-white border border-[#D5D9D9] rounded-2xl -mt-12 relative p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <p className="text-xl font-black text-[#0F1111] leading-none">{formatCount(followers)}</p>
              <p className="text-[10px] text-[#565959] mt-1">Abonnés</p>
            </div>
            <div className="relative flex-shrink-0 -mt-14 mx-2">
              <div className={`w-24 h-24 rounded-full overflow-hidden border-4 ${isLive ? "border-[#CC0C39]" : "border-white"} shadow-md bg-white`}>
                <img src={avatar} alt={name} className="w-full h-full object-cover" />
              </div>
              {isLive && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#CC0C39] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">Live</span>}
            </div>
            <div className="text-center flex-1">
              <p className="text-xl font-black text-[#0F1111] leading-none">{shows.length}</p>
              <p className="text-[10px] text-[#565959] mt-1">Lives</p>
            </div>
          </div>

          <div className="text-center mt-3">
            <h1 className="text-lg font-black text-[#0F1111] flex items-center justify-center gap-1.5">
              {name}
              {vendor.is_active && <i className="fa-solid fa-circle-check text-[#FF9900] text-sm" />}
            </h1>
            <p className="text-[12px] text-[#565959]">@{vendor.shop_name || vendor.id?.slice(0, 8)}</p>
            {(profile?.city || vendor.city) && <p className="text-[11px] text-[#565959] mt-1"><i className="fa-solid fa-location-dot mr-1" />{profile?.city || vendor.city}</p>}
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button className="flex-1 flex items-center justify-center gap-2 bg-white border border-[#D5D9D9] hover:border-[#565959] text-[#0F1111] py-2.5 rounded-full font-black text-[12px] transition-all">
              <i className="fa-regular fa-comment" /> Message
            </button>
            <button onClick={onFollow}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-black text-[12px] transition-all ${
                following ? "bg-[#131921] text-white" : "bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200]"
              }`}>
              {following ? <><i className="fa-solid fa-check" /> Suivi</> : "Suivre"}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { icon: "fa-video",        label: "En live",  value: liveCount },
              { icon: "fa-users",        label: "Abonnés",  value: formatCount(followers) },
              { icon: "fa-store",        label: "Boutique", value: <Link to={`/shop/${vendor.shop_name}`} className="text-[#007185]">Voir</Link> },
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

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-[#565959] text-sm">Aucun show ici pour le moment.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pb-10">
            {filtered.map(s => <ShowThumb key={s.id} s={s} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatorProfile;
