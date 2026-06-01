import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

/* ─────────────────────────────────────────────────────────────────────────────
   SponsoredBanner — Amazon Sponsored Brands format + OFS CM identity
   Height: 52px (desktop) · slim, pixel-perfect, no wasted space
   ───────────────────────────────────────────────────────────────────────────── */
const SponsoredBanner = ({ excludeVendorId = null, className = "" }) => {
  const [vendor,    setVendor]    = useState(null);
  const [products,  setProducts]  = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const [showTip,   setShowTip]   = useState(false);
  const [ready,     setReady]     = useState(false);
  const tipRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      let q = supabase.from("vendors").select("*").eq("is_active", true);
      if (excludeVendorId) q = q.neq("id", excludeVendorId);
      const { data: vendors } = await q;
      if (!vendors?.length) return;

      const v = vendors[Math.floor(Math.random() * vendors.length)];
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, img, price, type")
        .eq("vendor_id", v.id)
        .not("img", "is", null)
        .limit(5);

      if (!prods || prods.length < 2) return;
      setVendor(v);
      setProducts(prods);
      // slight delay so the banner slides in after page paint
      setTimeout(() => setReady(true), 120);
    };
    load();
  }, [excludeVendorId]);

  useEffect(() => {
    const handler = (e) => { if (!tipRef.current?.contains(e.target)) setShowTip(false); };
    if (showTip) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTip]);

  if (dismissed || !vendor || !ready) return null;

  const imgs     = products.slice(0, 4);
  const headline = products[0]?.name ?? "";
  const initials = vendor.shop_name?.slice(0, 2).toUpperCase() ?? "OFS";

  return (
    <div
      className={`relative bg-white border-t border-b border-[#D5D9D9] overflow-visible ${className}`}
      style={{
        animation: "sponsoredSlideIn 0.3s ease both",
        minHeight: 52,
      }}
    >
      <div className="max-w-[1400px] mx-auto px-3 md:px-4 flex items-center h-[52px] gap-0">

        {/* ── LEFT: vendor headline ─────────────────────────── */}
        <div className="hidden md:flex flex-col justify-center w-[200px] flex-shrink-0 pr-4 border-r border-[#EBEBEB] h-full gap-0.5">
          {/* OFS Certified micro-badge */}
          <div className="flex items-center gap-1">
            <span className="text-[7.5px] font-black text-[#FF9900] uppercase tracking-[0.18em] leading-none">
              OFS Certifié
            </span>
            <i className="fa-solid fa-circle-check text-[#FF9900]" style={{ fontSize: 7 }}></i>
          </div>
          <p className="text-[11px] font-bold text-[#0F1111] leading-tight truncate">{vendor.shop_name}</p>
          <p className="text-[10px] text-[#767676] leading-tight truncate">{headline}</p>
        </div>

        {/* ── CENTER: product thumbnails ───────────────────── */}
        <div className="flex items-center gap-1.5 flex-1 px-3 md:px-4 overflow-hidden h-full py-2">
          {imgs.map((p) => (
            <Link
              key={p.id}
              to={`/product/${p.id}`}
              className="flex-shrink-0 w-9 h-9 border border-[#E8E8E8] rounded bg-[#FAFAFA] overflow-hidden hover:border-[#FF9900] hover:shadow-[0_0_0_1px_#FF9900] transition-all group/thumb"
              title={p.name}
            >
              <img
                src={p.img}
                alt={p.name}
                className="w-full h-full object-contain p-0.5 group-hover/thumb:scale-[1.12] transition-transform duration-300"
                loading="lazy"
              />
            </Link>
          ))}
          {/* subtle "voir plus" pill if more than 4 products */}
          {products.length > 4 && (
            <Link to={`/shop/${vendor.shop_name}`}
              className="flex-shrink-0 w-9 h-9 border border-dashed border-[#D5D9D9] rounded bg-white flex items-center justify-center hover:border-[#FF9900] transition-colors"
            >
              <span className="text-[9px] font-bold text-[#007185]">+{products.length - 4}</span>
            </Link>
          )}
        </div>

        {/* ── RIGHT: brand logo + CTA ───────────────────────── */}
        <div className="flex-shrink-0 flex items-center gap-3 pl-3 md:pl-4 border-l border-[#EBEBEB] h-full">
          {/* Brand "logo" block */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-sm bg-[#0F1111] flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-black/10">
              <span className="text-[#FF9900] font-black text-[10px] uppercase leading-none tracking-tight">
                {initials}
              </span>
            </div>
            <div className="hidden sm:flex flex-col justify-center gap-0">
              <span className="text-[11px] font-black text-[#0F1111] uppercase tracking-tight leading-none">
                {vendor.shop_name}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                {[...Array(3)].map((_, i) => (
                  <i key={i} className="fa-solid fa-star text-[#FF9900]" style={{ fontSize: 6 }}></i>
                ))}
                <span className="text-[8px] text-[#767676] font-medium ml-0.5">Certifié</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <Link
            to={`/shop/${vendor.shop_name}`}
            className="flex items-center gap-1 text-[11px] font-bold text-[#007185] hover:text-[#C45500] whitespace-nowrap transition-colors group/cta"
          >
            <span className="group-hover/cta:underline">Shop {vendor.shop_name}</span>
            <i className="fa-solid fa-chevron-right text-[8px]"></i>
          </Link>
        </div>

        {/* ── Close ── */}
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 w-5 h-5 ml-2 rounded-full flex items-center justify-center text-[#aaa] hover:text-[#565959] hover:bg-[#F3F4F4] transition-all"
          aria-label="Fermer"
        >
          <i className="fa-solid fa-xmark" style={{ fontSize: 9 }}></i>
        </button>
      </div>

      {/* ── "Sponsorisé" bottom-right ── */}
      <div ref={tipRef} className="absolute bottom-0.5 right-10 flex items-center gap-1 select-none">
        <span className="text-[9px] text-[#aaa]">Sponsorisé</span>
        <button
          onClick={() => setShowTip((v) => !v)}
          className="text-[#bbb] hover:text-[#007185] transition-colors"
          aria-label="Info sponsorisé"
        >
          <i className="fa-solid fa-circle-info" style={{ fontSize: 9 }}></i>
        </button>
        {showTip && (
          <div className="absolute bottom-5 right-0 w-60 bg-[#1a1a1a] text-white text-[10px] rounded-sm p-3 shadow-2xl z-50 leading-relaxed border border-white/10">
            <p className="font-bold text-[#FF9900] mb-1 text-[9px] uppercase tracking-widest">Pourquoi ce contenu ?</p>
            Ce résultat est affiché car cette boutique est partenaire certifié OFS Cameroun.
            <br />
            <Link to="/boutiques" className="text-[#FF9900] font-bold underline mt-1 inline-block">
              En savoir plus →
            </Link>
          </div>
        )}
      </div>

      {/* ── Slide-in keyframe (injected inline once) ── */}
      <style>{`
        @keyframes sponsoredSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
  );
};

export default SponsoredBanner;
