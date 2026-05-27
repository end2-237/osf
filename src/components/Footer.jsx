import React from "react";
import { Link } from "react-router-dom";

const COLUMNS = [
  {
    title: "Aide & Support",
    links: [
      { label: "FAQ",                  path: "/" },
      { label: "Retours & Échanges",   path: "/" },
      { label: "Guide des Tailles",    path: "/" },
      { label: "Livraison Douala",     path: "/" },
      { label: "Nous contacter",       path: "/" },
    ],
  },
  {
    title: "Nos Services",
    links: [
      { label: "Studio Lab",           path: "/studio"    },
      { label: "Devenir Vendeur",      path: "/register"  },
      { label: "Programme Membres",    path: "/rewards"   },
      { label: "Boutiques",            path: "/boutiques" },
      { label: "Dashboard Vendeur",    path: "/admin"     },
    ],
  },
  {
    title: "Collections",
    links: [
      { label: "Audio Lab",            path: "/store" },
      { label: "Streetwear",           path: "/store" },
      { label: "Mode Femme",           path: "/store" },
      { label: "Tech Lab",             path: "/store" },
      { label: "Sneakers",             path: "/store" },
      { label: "Parfums Elite",        path: "/store" },
    ],
  },
  {
    title: "OneFreestyle",
    links: [
      { label: "À propos de nous",     path: "/" },
      { label: "Opportunités",         path: "/" },
      { label: "Presse",               path: "/" },
      { label: "Confidentialité",      path: "/" },
      { label: "Conditions d'utilisation", path: "/" },
    ],
  },
];

const SOCIALS = [
  { icon: "fa-instagram", href: "#", color: "hover:bg-pink-500"  },
  { icon: "fa-tiktok",    href: "#", color: "hover:bg-black"     },
  { icon: "fa-whatsapp",  href: "#", color: "hover:bg-green-500" },
  { icon: "fa-twitter",   href: "#", color: "hover:bg-sky-500"   },
];

const Footer = () => {
  return (
    <footer>
      {/* BACK TO TOP */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="w-full py-3 bg-[#37475A] hover:bg-[#3D5166] text-white text-sm font-medium transition-colors text-center"
      >
        Retour en haut de page
      </button>

      {/* MAIN LINKS */}
      <div className="bg-[#232F3E] py-10">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h5 className="font-bold text-white text-sm mb-4">{col.title}</h5>
                <ul className="space-y-2">
                  {col.links.map(({ label, path }) => (
                    <li key={label}>
                      <Link
                        to={path}
                        className="text-[#DDD] hover:text-white text-sm transition-colors"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DIVIDER */}
      <div className="h-px bg-[#3D5166]" />

      {/* MID BAR — language, socials */}
      <div className="bg-[#232F3E] py-6">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">

          {/* LOGO */}
          <Link to="/" className="logo-font font-bold text-2xl text-white hover:text-[#FF9900] transition-colors">
            OneFree<span className="text-[#FF9900]">Style</span>
          </Link>

          {/* SOCIAL LINKS */}
          <div className="flex items-center gap-2">
            {SOCIALS.map(({ icon, href, color }) => (
              <a key={icon} href={href} aria-label={icon}
                className={`w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white transition-all hover:text-white ${color}`}
              >
                <i className={`fa-brands ${icon} text-sm`}></i>
              </a>
            ))}
          </div>

          {/* LOCATION */}
          <div className="flex items-center gap-2 border border-[#3D5166] rounded px-3 py-2 text-white text-sm">
            <i className="fa-solid fa-location-dot text-[#FF9900] text-xs"></i>
            <span>Douala, Cameroun 🇨🇲</span>
          </div>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="bg-[#131921] py-5">
        <div className="max-w-[1200px] mx-auto px-6">
          {/* PAYMENT METHODS */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
            {[
              { icon: "fa-mobile-screen-button", label: "Mobile Money"  },
              { icon: "fa-money-bill-wave",       label: "Cash"         },
              { icon: "fa-truck-fast",            label: "Livraison"    },
              { icon: "fa-shield-check",          label: "Sécurisé"     },
            ].map(({ icon, label }) => (
              <div key={label}
                className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-xs text-gray-400"
              >
                <i className={`fa-solid ${icon} text-[#FF9900] text-xs`}></i>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* COPYRIGHT & LINKS */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-[#888]">
            <span>© {new Date().getFullYear()} OneFreestyle Elite</span>
            <span className="hidden md:inline">·</span>
            <a href="#" className="hover:text-white transition-colors">Conditions</a>
            <span>·</span>
            <a href="#" className="hover:text-white transition-colors">Confidentialité</a>
            <span>·</span>
            <a href="#" className="hover:text-white transition-colors">Cookies</a>
            <span>·</span>
            <a href="#" className="hover:text-white transition-colors">Accessibilité</a>
          </div>

          <p className="text-center text-xs text-[#555] mt-2">
            Bonamoussadi, Akwa — Douala, Cameroun
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
