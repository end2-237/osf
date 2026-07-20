import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchFollowedLive } from "../lib/liveApi";

// Rangée "Créateurs suivis" sur l'accueil — met en avant ceux qui sont en live.
const FollowedLiveRow = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!user?.id) { setItems([]); return; }
    fetchFollowedLive(user.id).then(setItems);
  }, [user?.id]);

  if (!user || items.length === 0) return null;

  const go = (c) => {
    if (c.live && c.showId) navigate(`/live/${c.showId}`);
    else navigate(`/creator/${c.handle}`);
  };

  return (
    <section className="max-w-[1600px] mx-auto px-4 md:px-6 py-4">
      <div className="bg-white border border-[#D5D9D9] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black text-[#0F1111] flex items-center gap-2">
            <i className="fa-solid fa-user-check text-[#FF9900]" />Créateurs suivis
          </h2>
          <button onClick={() => navigate("/live")} className="text-[10px] font-black uppercase text-[#007185] hover:text-[#C45500]">Voir les lives</button>
        </div>
        <div className="flex items-start gap-4 overflow-x-auto hide-scrollbar">
          {items.map(c => (
            <button key={c.vendorId} onClick={() => go(c)} className="flex flex-col items-center gap-1.5 flex-shrink-0 group w-16">
              <div className="relative">
                <div className={`w-16 h-16 rounded-full p-[2px] ${c.live ? "bg-gradient-to-tr from-[#CC0C39] to-[#FF9900]" : "bg-[#D5D9D9]"}`}>
                  <img src={c.avatar} alt={c.name} className="w-full h-full rounded-full object-cover border-2 border-white bg-white" />
                </div>
                {c.live && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#CC0C39] text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full tracking-wider">Live</span>
                )}
              </div>
              <span className="text-[10px] font-bold text-[#0F1111] truncate max-w-[64px] text-center mt-1">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FollowedLiveRow;
