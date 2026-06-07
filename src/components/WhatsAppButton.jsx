import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

export const WA_KEY = "ofs_whatsapp_v1";

export const getWhatsAppSettings = () => {
  try { const s = localStorage.getItem(WA_KEY); return s ? JSON.parse(s) : null; }
  catch { return null; }
};

const WhatsAppButton = () => {
  const location = useLocation();
  const [hovered, setHovered] = useState(false);

  const settings = getWhatsAppSettings();
  if (!settings?.phone) return null;

  const phone = settings.phone.replace(/\D/g, '');

  const getMessage = () => {
    const path = location.pathname;
    if (path.startsWith('/product/')) {
      const name = document.title.replace(/\s*[-|].*$/, '').trim();
      const tpl = settings.message_product || "Bonjour, je suis intéressé par \"{product}\" sur OFS";
      return tpl.replace('{product}', name);
    }
    if (path === '/cart' || path.startsWith('/cart')) {
      return settings.message_cart || "Bonjour, j'ai besoin d'aide pour finaliser ma commande sur OFS";
    }
    return settings.message_default || "Bonjour, j'ai une question sur OFS";
  };

  const handleClick = () => {
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(getMessage())}`, '_blank');
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 pointer-events-none">
      {hovered && (
        <div className="pointer-events-none bg-white text-[#0F1111] text-xs font-semibold px-3 py-2 rounded-xl shadow-lg border border-gray-100 whitespace-nowrap">
          Discutons sur WhatsApp
        </div>
      )}
      <button
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="pointer-events-auto w-14 h-14 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
        aria-label="Contacter via WhatsApp"
      >
        <i className="fa-brands fa-whatsapp text-2xl"></i>
      </button>
    </div>
  );
};

export default WhatsAppButton;
