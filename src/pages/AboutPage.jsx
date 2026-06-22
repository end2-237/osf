import React from "react";
import { Link } from "react-router-dom";

const InfoRow = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 py-3 border-b border-[#F3F4F4] last:border-0">
    <div className="w-9 h-9 bg-[#FFF8F0] border border-[#FFE0B2] flex items-center justify-center flex-shrink-0">
      <i className={`fa-solid ${icon} text-[#FF9900] text-sm`}></i>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#ADBAC7]">{label}</p>
      <p className="text-sm text-[#0F1111] font-medium mt-0.5">{value}</p>
    </div>
  </div>
);

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="font-black text-base uppercase tracking-widest text-[#0F1111] mb-3 border-b border-[#D5D9D9] pb-2">{title}</h2>
    <div className="text-sm text-[#565959] leading-relaxed space-y-2">{children}</div>
  </div>
);

const AboutPage = () => (
  <div className="min-h-screen bg-[#EAEDED]">
    <div className="max-w-3xl mx-auto px-4 py-10">

      {/* Hero */}
      <div className="bg-white border border-[#D5D9D9] rounded overflow-hidden mb-6">
        <div className="bg-gradient-to-br from-[#232F3E] to-[#131921] px-6 py-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-3xl font-black text-[#FF9900]">Buyticle</span>
          </div>
          <p className="text-[#ADBAC7] text-sm italic">« Tu cherches, on l'a toujours »</p>
          <p className="text-[#565959] text-[11px] mt-3">Marketplace camerounaise · Douala 🇨🇲</p>
        </div>

        {/* Legal identity */}
        <div className="p-6 md:p-8">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#FF9900] mb-4">Informations légales</p>
          <div className="space-y-0">
            <InfoRow icon="fa-building"      label="Raison sociale"     value="BUYTICLE ETS" />
            <InfoRow icon="fa-store"         label="Marque commerciale" value="Buyticle" />
            <InfoRow icon="fa-id-card"       label="N° RCCM"            value="CM-DLA-01-2025-A10-01482" />
            <InfoRow icon="fa-calendar-day"  label="Date de création"  value="17 juin 2025" />
            <InfoRow icon="fa-location-dot"  label="Siège social"      value="Bonamoussadi, Douala — Cameroun" />
            <InfoRow icon="fa-phone"         label="Téléphone"         value="(+237) 696 99 58 79" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white border border-[#D5D9D9] rounded overflow-hidden">
        <div className="p-6 md:p-8">

          <Section title="Qui sommes-nous ?">
            <p>
              <strong>Buyticle</strong> est une marketplace de commerce électronique opérée par
              l'établissement <strong>BUYTICLE ETS</strong>, basé à Douala au Cameroun.
              Notre mission : permettre à chaque Camerounais de trouver et de se faire livrer
              les produits qu'il cherche, rapidement et en toute confiance.
            </p>
            <p>
              Notre devise résume notre engagement : <em>« Tu cherches, on l'a toujours »</em>.
              Que ce soit un produit local d'une de nos boutiques partenaires ou un article
              importé, nous mettons tout en œuvre pour le rendre accessible.
            </p>
          </Section>

          <Section title="Nos activités">
            <ul className="list-disc pl-5 space-y-1">
              <li>Commerce de gros non spécialisé (commerce général)</li>
              <li>Conseil et autres activités informatiques</li>
              <li>Autres services personnels (prestation de service)</li>
            </ul>
          </Section>

          <Section title="Ce que nous proposons">
            <ul className="list-disc pl-5 space-y-1">
              <li>Une marketplace réunissant des boutiques locales camerounaises</li>
              <li>Des produits importés via nos partenaires de dropshipping</li>
              <li>Le paiement Mobile Money (Orange Money, MTN MoMo) et le paiement à la livraison</li>
              <li>La livraison express à Douala en 2 heures pour les produits en stock local</li>
              <li>Un programme de fidélité <strong>Buyticle Rewards</strong> et un programme d'affiliation</li>
            </ul>
          </Section>

          <Section title="Nous contacter">
            <p>Pour toute question, réclamation ou demande d'information :</p>
            <ul className="list-none space-y-1">
              <li><i className="fa-solid fa-phone text-[#FF9900] mr-2"></i>(+237) 696 99 58 79</li>
              <li><i className="fa-solid fa-location-dot text-[#FF9900] mr-2"></i>Bonamoussadi, Douala — Cameroun</li>
            </ul>
            <div className="flex flex-wrap gap-3 mt-4">
              <a href="tel:+237696995879"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFD814] hover:bg-[#F7CA00] border border-[#FCD200] text-[12px] font-bold text-[#0F1111] transition-colors">
                <i className="fa-solid fa-phone"></i>Appeler
              </a>
              <a href="https://wa.me/237696995879" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#1ebe5d] text-[12px] font-bold text-white transition-colors">
                <i className="fa-brands fa-whatsapp"></i>WhatsApp
              </a>
            </div>
          </Section>

          <div className="mt-8 pt-6 border-t border-[#D5D9D9] flex items-center justify-between flex-wrap gap-4">
            <p className="text-[10px] text-[#565959]">© 2026 BUYTICLE ETS · Tous droits réservés</p>
            <div className="flex items-center gap-4">
              <Link to="/cgv" className="text-[10px] font-black uppercase text-[#007185] hover:text-[#C45500] hover:underline">
                CGV
              </Link>
              <Link to="/" className="text-[10px] font-black uppercase text-[#007185] hover:text-[#C45500] hover:underline">
                ← Accueil
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default AboutPage;
