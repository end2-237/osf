import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const SECTIONS = [
  { id: "vendeur",       label: "Identification du vendeur" },
  { id: "produits",      label: "Produits" },
  { id: "commande",      label: "Commande" },
  { id: "paiement",      label: "Paiement" },
  { id: "livraison",     label: "Livraison" },
  { id: "retours",       label: "Retours & Remboursements" },
  { id: "fidelite",      label: "Programme Rewards" },
  { id: "affiliation",   label: "Programme d'affiliation" },
  { id: "donnees",       label: "Données personnelles" },
  { id: "litiges",       label: "Litiges" },
];

const SectionBlock = ({ id, number, title, children }) => (
  <section id={id} className="scroll-mt-28 mb-10">
    <div className="flex items-center gap-3 mb-4">
      <span className="w-8 h-8 bg-[#FFF3E0] border border-[#FFE0B2] rounded-lg flex items-center justify-center text-sm font-black text-[#FF9900]">{number}</span>
      <h2 className="text-lg font-bold text-[#0F1111]">{title}</h2>
    </div>
    <div className="text-[15px] text-[#565959] leading-relaxed space-y-3 pl-11">{children}</div>
  </section>
);

const CGVPage = () => {
  const [active, setActive] = useState("vendeur");
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
            <span className="px-3 py-1 bg-[#FF9900]/20 border border-[#FF9900]/30 rounded-full text-[11px] font-bold text-[#FF9900] uppercase tracking-wider">Mentions légales</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Conditions Générales de Vente</h1>
          <p className="text-[#8899A6] text-sm">Dernière mise à jour : Juin 2026 · <span className="text-[#FF9900]">buyticle.com</span></p>
        </div>
      </div>

      {/* Content area */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 flex gap-8">
        {/* Sidebar nav */}
        <nav className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-24">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#ADBAC7] mb-4 px-3">Sommaire</p>
            <ul className="space-y-0.5">
              {SECTIONS.map(({ id, label }, i) => (
                <li key={id}>
                  <button
                    onClick={() => scrollTo(id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2.5 ${
                      active === id
                        ? "bg-[#FFF3E0] text-[#E68A00] border-l-[3px] border-[#FF9900]"
                        : "text-[#565959] hover:bg-[#F0F2F4] hover:text-[#0F1111]"
                    }`}
                  >
                    <span className={`text-[11px] font-bold w-5 text-center ${active === id ? "text-[#FF9900]" : "text-[#AAB8C2]"}`}>{i + 1}</span>
                    {label}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-6 px-3">
              <Link to="/about" className="flex items-center gap-2 text-[13px] text-[#007185] hover:text-[#FF9900] font-medium transition-colors">
                <i className="fa-solid fa-arrow-left text-[10px]" /> À propos de Buyticle
              </Link>
            </div>
          </div>
        </nav>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-[#E8ECEF] shadow-sm p-6 md:p-10">

            <SectionBlock id="vendeur" number="1" title="Identification du vendeur">
              <p><strong className="text-[#0F1111]">BUYTICLE ETS</strong>, établissement spécialisé en informatique, prestation de service et commerce général, exploitant la marque <strong className="text-[#0F1111]">Buyticle</strong> — « Tu cherches, on l'a toujours ».</p>
              <div className="bg-[#F9FAFB] border border-[#E8ECEF] rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm"><i className="fa-solid fa-location-dot text-[#FF9900] w-4" /><span>Siège : Bonamoussadi, Douala — Cameroun</span></div>
                <div className="flex items-center gap-2 text-sm"><i className="fa-solid fa-id-card text-[#FF9900] w-4" /><span>RCCM : CM-DLA-01-2025-A10-01482</span></div>
                <div className="flex items-center gap-2 text-sm"><i className="fa-solid fa-calendar text-[#FF9900] w-4" /><span>Créée le 17 juin 2025</span></div>
                <div className="flex items-center gap-2 text-sm"><i className="fa-solid fa-phone text-[#FF9900] w-4" /><span>(+237) 696 99 58 79</span></div>
                <div className="flex items-center gap-2 text-sm"><i className="fa-solid fa-globe text-[#FF9900] w-4" /><span>buyticle.com</span></div>
              </div>
            </SectionBlock>

            <SectionBlock id="produits" number="2" title="Produits">
              <p>Les produits proposés sont ceux figurant sur le site au moment de la commande. Les prix sont indiqués en <strong className="text-[#0F1111]">francs CFA (FCFA)</strong> toutes taxes comprises.</p>
              <p>Buyticle se réserve le droit de modifier les prix à tout moment, mais les produits seront facturés sur la base des tarifs en vigueur au moment de la validation de la commande.</p>
            </SectionBlock>

            <SectionBlock id="commande" number="3" title="Commande">
              <p>Toute commande passée sur Buyticle vaut acceptation des présentes CGV. La commande est confirmée par email ou SMS dès sa validation.</p>
              <p>Buyticle se réserve le droit d'annuler toute commande en cas de stock indisponible ou d'erreur manifeste de prix.</p>
            </SectionBlock>

            <SectionBlock id="paiement" number="4" title="Paiement">
              <div className="space-y-3">
                <div className="bg-[#F9FAFB] border border-[#E8ECEF] rounded-lg p-4">
                  <p className="font-bold text-[#0F1111] text-sm mb-1"><i className="fa-solid fa-money-bill-wave text-[#FF9900] mr-2" />Paiement à la livraison (COD)</p>
                  <p className="text-sm">Le règlement s'effectue en espèces auprès du livreur. Le montant exact doit être préparé à l'avance.</p>
                </div>
                <div className="bg-[#F9FAFB] border border-[#E8ECEF] rounded-lg p-4">
                  <p className="font-bold text-[#0F1111] text-sm mb-1"><i className="fa-solid fa-mobile-screen-button text-[#FF9900] mr-2" />Mobile Money (Orange Money / MTN MoMo)</p>
                  <p className="text-sm">Le paiement est traité via Monetbil. La commande est confirmée dès validation du paiement.</p>
                </div>
              </div>
            </SectionBlock>

            <SectionBlock id="livraison" number="5" title="Livraison">
              <p>La livraison est assurée à Douala dans un délai de <strong className="text-[#0F1111]">2 heures</strong> pour les produits en stock local. Les produits importés (CJ Dropshipping) sont livrés sous <strong className="text-[#0F1111]">3 à 7 jours ouvrés</strong>.</p>
              <p>Les frais de livraison locale sont offerts. Les frais d'expédition internationale sont indiqués au moment de la commande.</p>
            </SectionBlock>

            <SectionBlock id="retours" number="6" title="Retours et remboursements">
              <p>Tout retour doit être signalé dans les <strong className="text-[#0F1111]">7 jours</strong> suivant la réception du colis. Le produit doit être retourné dans son état d'origine, non utilisé et dans son emballage d'origine.</p>
              <p>Le remboursement est effectué par le même moyen de paiement que l'achat initial, dans un délai de 5 à 10 jours ouvrés.</p>
            </SectionBlock>

            <SectionBlock id="fidelite" number="7" title="Programme de fidélité Buyticle Rewards">
              <p>Les points Rewards sont crédités à titre commercial et n'ont aucune valeur monétaire en dehors du programme. Buyticle se réserve le droit de modifier ou d'arrêter le programme à tout moment.</p>
            </SectionBlock>

            <SectionBlock id="affiliation" number="8" title="Programme d'affiliation">
              <p>Les commissions d'affiliation (<strong className="text-[#0F1111]">5% du montant de la commande</strong>) sont versées selon les conditions définies dans l'espace parrain. Buyticle se réserve le droit de refuser toute commission en cas d'utilisation frauduleuse du code de parrainage.</p>
            </SectionBlock>

            <SectionBlock id="donnees" number="9" title="Données personnelles">
              <p>Les données collectées (nom, téléphone, adresse) sont utilisées uniquement pour le traitement des commandes et la livraison. Elles ne sont pas cédées à des tiers sans consentement.</p>
              <p>Conformément à la loi camerounaise sur les données personnelles, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour toute demande : <strong className="text-[#0F1111]">(+237) 696 99 58 79</strong>.</p>
            </SectionBlock>

            <SectionBlock id="litiges" number="10" title="Litiges">
              <p>En cas de litige, une solution amiable sera recherchée en priorité. À défaut, les tribunaux compétents de <strong className="text-[#0F1111]">Douala (Cameroun)</strong> seront saisis. Le droit applicable est le droit camerounais.</p>
            </SectionBlock>

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-[#E8ECEF]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <p className="text-xs text-[#8899A6]">© 2026 BUYTICLE ETS · Tous droits réservés</p>
                <div className="flex items-center gap-4">
                  <Link to="/about" className="text-xs font-bold text-[#007185] hover:text-[#FF9900] transition-colors">À propos</Link>
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

export default CGVPage;
