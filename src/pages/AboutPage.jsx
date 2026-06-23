import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const SECTIONS = [
  { id: "presentation", label: "Qui sommes-nous" },
  { id: "activites",    label: "Nos activités" },
  { id: "identite",     label: "Identité légale" },
  { id: "services",     label: "Ce que nous proposons" },
  { id: "contact",      label: "Nous contacter" },
];

const SectionBlock = ({ id, icon, title, children }) => (
  <section id={id} className="scroll-mt-28 mb-10">
    <div className="flex items-center gap-3 mb-4">
      <span className="w-8 h-8 bg-[#FFF3E0] border border-[#FFE0B2] rounded-lg flex items-center justify-center">
        <i className={`fa-solid ${icon} text-[#FF9900] text-sm`} />
      </span>
      <h2 className="text-lg font-bold text-[#0F1111]">{title}</h2>
    </div>
    <div className="text-[15px] text-[#565959] leading-relaxed space-y-3 pl-11">{children}</div>
  </section>
);

const AboutPage = () => {
  const [active, setActive] = useState("presentation");
  const observerRef = useRef(null);

  useEffect(() => {
    const callback = (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActive(entry.target.id);
          break;
        }
      }
    };
    observerRef.current = new IntersectionObserver(callback, { rootMargin: "-100px 0px -60% 0px", threshold: 0.1 });
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-[#232F3E] via-[#1a2530] to-[#131921] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="max-w-6xl mx-auto px-6 py-14 relative">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-3 py-1 bg-[#FF9900]/20 border border-[#FF9900]/30 rounded-full text-[11px] font-bold text-[#FF9900] uppercase tracking-wider">À propos</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Buyticle</h1>
          <p className="text-[#8899A6] text-sm italic">« Tu cherches, on l'a toujours » · <span className="text-[#FF9900]">buyticle.com</span></p>
          <p className="text-[#6B7D8D] text-xs mt-3">Informatique · Prestation de service · Commerce général · Douala, Cameroun 🇨🇲</p>
        </div>
      </div>

      {/* Content area */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 flex gap-8">
        {/* Sidebar nav */}
        <nav className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-24">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#ADBAC7] mb-4 px-3">Navigation</p>
            <ul className="space-y-0.5">
              {SECTIONS.map(({ id, label }) => (
                <li key={id}>
                  <button
                    onClick={() => scrollTo(id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                      active === id
                        ? "bg-[#FFF3E0] text-[#E68A00] border-l-[3px] border-[#FF9900]"
                        : "text-[#565959] hover:bg-[#F0F2F4] hover:text-[#0F1111]"
                    }`}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-6 px-3 space-y-2">
              <Link to="/cgv" className="flex items-center gap-2 text-[13px] text-[#007185] hover:text-[#FF9900] font-medium transition-colors">
                <i className="fa-solid fa-file-contract text-[10px]" /> Conditions de vente
              </Link>
              <Link to="/" className="flex items-center gap-2 text-[13px] text-[#007185] hover:text-[#FF9900] font-medium transition-colors">
                <i className="fa-solid fa-arrow-left text-[10px]" /> Retour à l'accueil
              </Link>
            </div>

            {/* Quick contact card */}
            <div className="mt-8 bg-gradient-to-br from-[#232F3E] to-[#131921] rounded-xl p-4">
              <p className="text-[11px] font-bold text-[#FF9900] uppercase tracking-wider mb-3">Contact rapide</p>
              <div className="space-y-2">
                <a href="tel:+237696995879" className="flex items-center gap-2 text-white text-xs hover:text-[#FF9900] transition-colors">
                  <i className="fa-solid fa-phone text-[10px] text-[#FF9900]" /> (+237) 696 99 58 79
                </a>
                <a href="https://wa.me/237696995879" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white text-xs hover:text-[#25D366] transition-colors">
                  <i className="fa-brands fa-whatsapp text-[10px] text-[#25D366]" /> WhatsApp
                </a>
              </div>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-[#E8ECEF] shadow-sm p-6 md:p-10">

            <SectionBlock id="presentation" icon="fa-building" title="Qui sommes-nous ?">
              <p><strong className="text-[#0F1111]">Buyticle</strong> est une plateforme de commerce électronique et de services numériques opérée par l'établissement <strong className="text-[#0F1111]">BUYTICLE ETS</strong>, basé à Douala au Cameroun.</p>
              <p>Notre mission : permettre à chaque Camerounais de trouver et de se faire livrer les produits qu'il cherche, rapidement et en toute confiance. Nous combinons l'expertise en <strong className="text-[#0F1111]">informatique</strong>, la <strong className="text-[#0F1111]">prestation de service</strong> et le <strong className="text-[#0F1111]">commerce général</strong> pour offrir une expérience d'achat complète.</p>
              <p>Notre devise résume notre engagement : <em className="text-[#FF9900] font-medium">« Tu cherches, on l'a toujours »</em>. Que ce soit un produit local d'une de nos boutiques partenaires ou un article importé, nous mettons tout en œuvre pour le rendre accessible.</p>
            </SectionBlock>

            <SectionBlock id="activites" icon="fa-briefcase" title="Nos activités">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#F9FAFB] border border-[#E8ECEF] rounded-lg p-4 text-center">
                  <div className="w-10 h-10 mx-auto bg-[#FFF3E0] border border-[#FFE0B2] rounded-lg flex items-center justify-center mb-3">
                    <i className="fa-solid fa-laptop-code text-[#FF9900]" />
                  </div>
                  <p className="font-bold text-sm text-[#0F1111] mb-1">Informatique</p>
                  <p className="text-xs text-[#565959]">Conseil et autres activités informatiques</p>
                </div>
                <div className="bg-[#F9FAFB] border border-[#E8ECEF] rounded-lg p-4 text-center">
                  <div className="w-10 h-10 mx-auto bg-[#FFF3E0] border border-[#FFE0B2] rounded-lg flex items-center justify-center mb-3">
                    <i className="fa-solid fa-handshake text-[#FF9900]" />
                  </div>
                  <p className="font-bold text-sm text-[#0F1111] mb-1">Prestation de service</p>
                  <p className="text-xs text-[#565959]">Autres services personnels</p>
                </div>
                <div className="bg-[#F9FAFB] border border-[#E8ECEF] rounded-lg p-4 text-center">
                  <div className="w-10 h-10 mx-auto bg-[#FFF3E0] border border-[#FFE0B2] rounded-lg flex items-center justify-center mb-3">
                    <i className="fa-solid fa-store text-[#FF9900]" />
                  </div>
                  <p className="font-bold text-sm text-[#0F1111] mb-1">Commerce général</p>
                  <p className="text-xs text-[#565959]">Commerce de gros non spécialisé</p>
                </div>
              </div>
            </SectionBlock>

            <SectionBlock id="identite" icon="fa-id-card" title="Identité légale">
              <div className="bg-[#F9FAFB] border border-[#E8ECEF] rounded-lg divide-y divide-[#E8ECEF]">
                {[
                  { icon: "fa-building",     label: "Raison sociale",     value: "BUYTICLE ETS" },
                  { icon: "fa-store",        label: "Marque commerciale", value: "Buyticle" },
                  { icon: "fa-globe",        label: "Site officiel",      value: "buyticle.com" },
                  { icon: "fa-id-card",      label: "N° RCCM",           value: "CM-DLA-01-2025-A10-01482" },
                  { icon: "fa-calendar-day", label: "Date de création",   value: "17 juin 2025" },
                  { icon: "fa-location-dot", label: "Siège social",       value: "Bonamoussadi, Douala — Cameroun" },
                  { icon: "fa-phone",        label: "Téléphone",          value: "(+237) 696 99 58 79" },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3 px-4 py-3">
                    <i className={`fa-solid ${icon} text-[#FF9900] w-4 text-center text-xs`} />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#ADBAC7] w-36">{label}</span>
                    <span className="text-sm text-[#0F1111] font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </SectionBlock>

            <SectionBlock id="services" icon="fa-rocket" title="Ce que nous proposons">
              <div className="space-y-3">
                {[
                  { icon: "fa-store",             text: "Une marketplace réunissant des boutiques locales camerounaises" },
                  { icon: "fa-plane-departure",   text: "Des produits importés via nos partenaires de dropshipping" },
                  { icon: "fa-mobile-screen",     text: "Le paiement Mobile Money (Orange Money, MTN MoMo) et le paiement à la livraison" },
                  { icon: "fa-truck-fast",        text: "La livraison express à Douala en 2 heures pour les produits en stock local" },
                  { icon: "fa-gift",              text: "Un programme de fidélité Buyticle Rewards et un programme d'affiliation" },
                  { icon: "fa-laptop-code",       text: "Des services informatiques et du conseil en technologie" },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-start gap-3 bg-[#F9FAFB] border border-[#E8ECEF] rounded-lg p-3">
                    <div className="w-7 h-7 bg-[#FFF3E0] border border-[#FFE0B2] rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                      <i className={`fa-solid ${icon} text-[#FF9900] text-[11px]`} />
                    </div>
                    <p className="text-sm text-[#565959]">{text}</p>
                  </div>
                ))}
              </div>
            </SectionBlock>

            <SectionBlock id="contact" icon="fa-envelope" title="Nous contacter">
              <p>Pour toute question, réclamation ou demande d'information :</p>
              <div className="bg-[#F9FAFB] border border-[#E8ECEF] rounded-lg p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-phone text-[#FF9900] w-4 text-center" />
                  <span className="text-sm text-[#0F1111] font-medium">(+237) 696 99 58 79</span>
                </div>
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-location-dot text-[#FF9900] w-4 text-center" />
                  <span className="text-sm text-[#0F1111] font-medium">Bonamoussadi, Douala — Cameroun</span>
                </div>
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-globe text-[#FF9900] w-4 text-center" />
                  <span className="text-sm text-[#0F1111] font-medium">buyticle.com</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mt-2">
                <a href="tel:+237696995879" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF9900] hover:bg-[#E68A00] text-white text-[13px] font-bold rounded-lg transition-colors shadow-sm">
                  <i className="fa-solid fa-phone text-xs" /> Appeler
                </a>
                <a href="https://wa.me/237696995879" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-[13px] font-bold rounded-lg transition-colors shadow-sm">
                  <i className="fa-brands fa-whatsapp text-xs" /> WhatsApp
                </a>
              </div>
            </SectionBlock>

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-[#E8ECEF]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <p className="text-xs text-[#8899A6]">© 2026 BUYTICLE ETS · Tous droits réservés</p>
                <div className="flex items-center gap-4">
                  <Link to="/cgv" className="text-xs font-bold text-[#007185] hover:text-[#FF9900] transition-colors">CGV</Link>
                  <Link to="/" className="text-xs font-bold text-[#007185] hover:text-[#FF9900] transition-colors">← Accueil</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
