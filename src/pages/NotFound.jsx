import React from "react";
import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="min-h-screen bg-[#EAEDED] flex items-center justify-center px-4">
    <div className="text-center max-w-md">
      <div className="text-[120px] font-black text-[#232F3E] leading-none mb-4">404</div>
      <h1 className="font-black text-2xl uppercase text-[#0F1111] mb-2">Page introuvable</h1>
      <p className="text-[#565959] text-sm mb-8">
        Cette page n'existe pas ou a été déplacée.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] px-6 py-3 rounded font-black text-[10px] uppercase tracking-widest transition-colors"
        >
          <i className="fa-solid fa-house text-xs"></i> Accueil
        </Link>
        <Link
          to="/store"
          className="inline-flex items-center justify-center gap-2 border border-[#D5D9D9] text-[#0F1111] hover:bg-white px-6 py-3 rounded font-black text-[10px] uppercase tracking-widest transition-colors"
        >
          <i className="fa-solid fa-bag-shopping text-xs"></i> Explorer le store
        </Link>
      </div>
    </div>
  </div>
);

export default NotFound;
