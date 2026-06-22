import React from "react";
import { Link } from "react-router-dom";

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="font-black text-base uppercase tracking-widest text-[#0F1111] mb-3 border-b border-[#D5D9D9] pb-2">{title}</h2>
    <div className="text-sm text-[#565959] leading-relaxed space-y-2">{children}</div>
  </div>
);

const CGVPage = () => (
  <div className="min-h-screen bg-[#EAEDED]">
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-white border border-[#D5D9D9] rounded overflow-hidden">
        <div className="bg-[#232F3E] px-6 py-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#FF9900] mb-1">Mentions légales</p>
          <h1 className="font-black text-xl text-white uppercase">Conditions Générales de Vente</h1>
          <p className="text-[#ADBAC7] text-xs mt-1">Buyticle · BUYTICLE ETS · Douala, Cameroun · Mise à jour : juin 2026</p>
        </div>
        <div className="p-6 md:p-8">

          <Section title="1. Identification du vendeur">
            <p><strong>BUYTICLE ETS</strong>, établissement de commerce électronique exploitant la marque <strong>Buyticle</strong> (« Tu cherches, on l'a toujours »).</p>
            <p>Siège : Bonamoussadi, Douala — Cameroun.</p>
            <p>RCCM : CM-DLA-01-2025-A10-01482 · Établissement créé le 17 juin 2025.</p>
            <p>Téléphone : (+237) 696 99 58 79 · Contact également via WhatsApp et email disponibles sur le site.</p>
          </Section>

          <Section title="2. Produits">
            <p>Les produits proposés sont ceux figurant sur le site au moment de la commande. Les prix sont indiqués en francs CFA (FCFA) toutes taxes comprises.</p>
            <p>Buyticle se réserve le droit de modifier les prix à tout moment, mais les produits seront facturés sur la base des tarifs en vigueur au moment de la validation de la commande.</p>
          </Section>

          <Section title="3. Commande">
            <p>Toute commande passée sur Buyticle vaut acceptation des présentes CGV. La commande est confirmée par email ou SMS dès sa validation.</p>
            <p>Buyticle se réserve le droit d'annuler toute commande en cas de stock indisponible ou d'erreur manifeste de prix.</p>
          </Section>

          <Section title="4. Paiement">
            <p><strong>Paiement à la livraison (COD) :</strong> Le règlement s'effectue en espèces auprès du livreur. Le montant exact doit être préparé à l'avance.</p>
            <p><strong>Mobile Money (Orange Money / MTN MoMo) :</strong> Le paiement est traité via Monetbil. La commande est confirmée dès validation du paiement.</p>
          </Section>

          <Section title="5. Livraison">
            <p>La livraison est assurée à Douala dans un délai de 2 heures pour les produits en stock local. Les produits importés (CJ Dropshipping) sont livrés sous 3 à 7 jours ouvrés.</p>
            <p>Les frais de livraison locale sont offerts. Les frais d'expédition internationale sont indiqués au moment de la commande.</p>
          </Section>

          <Section title="6. Retours et remboursements">
            <p>Tout retour doit être signalé dans les <strong>7 jours</strong> suivant la réception du colis. Le produit doit être retourné dans son état d'origine, non utilisé et dans son emballage d'origine.</p>
            <p>Le remboursement est effectué par le même moyen de paiement que l'achat initial, dans un délai de 5 à 10 jours ouvrés.</p>
          </Section>

          <Section title="7. Programme de fidélité Buyticle Rewards">
            <p>Les points Rewards sont crédités à titre commercial et n'ont aucune valeur monétaire en dehors du programme. Buyticle se réserve le droit de modifier ou d'arrêter le programme à tout moment.</p>
          </Section>

          <Section title="8. Programme d'affiliation">
            <p>Les commissions d'affiliation (5% du montant de la commande) sont versées selon les conditions définies dans l'espace parrain. Buyticle se réserve le droit de refuser toute commission en cas d'utilisation frauduleuse du code de parrainage.</p>
          </Section>

          <Section title="9. Données personnelles">
            <p>Les données collectées (nom, téléphone, adresse) sont utilisées uniquement pour le traitement des commandes et la livraison. Elles ne sont pas cédées à des tiers sans consentement.</p>
            <p>Conformément à la loi camerounaise sur les données personnelles, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour toute demande : (+237) 696 99 58 79.</p>
          </Section>

          <Section title="10. Litiges">
            <p>En cas de litige, une solution amiable sera recherchée en priorité. À défaut, les tribunaux compétents de Douala (Cameroun) seront saisis. Le droit applicable est le droit camerounais.</p>
          </Section>

          <div className="mt-8 pt-6 border-t border-[#D5D9D9] flex items-center justify-between flex-wrap gap-4">
            <p className="text-[10px] text-[#565959]">© 2026 BUYTICLE ETS · Tous droits réservés</p>
            <div className="flex items-center gap-4">
              <Link to="/about" className="text-[10px] font-black uppercase text-[#007185] hover:text-[#C45500] hover:underline">
                À propos
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

export default CGVPage;
