import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// Fetch all site_settings rows and return as { key: value } map
export const fetchSiteSettings = async (keys) => {
  const { data } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', keys);
  if (!data) return {};
  return Object.fromEntries(data.map(r => [r.key, r.value]));
};

export const saveSiteSettings = async (map) => {
  const rows = Object.entries(map).map(([key, value]) => ({ key, value: value ?? '' }));
  return supabase.from('site_settings').upsert(rows, { onConflict: 'key' });
};

const WA_KEYS = ['whatsapp_phone', 'whatsapp_msg_default', 'whatsapp_msg_product', 'whatsapp_msg_cart'];

const WhatsAppButton = () => {
  const location = useLocation();
  const [hovered, setHovered] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchSiteSettings(WA_KEYS).then(s => setSettings(s));
  }, []);

  if (!settings?.whatsapp_phone) return null;

  const phone = settings.whatsapp_phone.replace(/\D/g, '');

  const getMessage = () => {
    const path = location.pathname;
    const pageUrl = window.location.href;

    if (path.startsWith('/product/')) {
      const prod = window.__ofs_product || {};
      const name = prod.name || (document.title !== 'OFS' ? document.title : '');
      const tpl = settings.whatsapp_msg_product || 'Bonjour, je suis intéressé par "{product}" sur OFS';
      const text = name ? tpl.replace('{product}', name) : (settings.whatsapp_msg_default || "Bonjour, j'ai une question sur OFS");
      // Include product URL so WhatsApp shows a link (and possibly a preview)
      const lines = [text, pageUrl];
      if (prod.img) lines.push(prod.img);
      return lines.join('\n');
    }
    if (path.startsWith('/cart')) {
      return settings.whatsapp_msg_cart || "Bonjour, j'ai besoin d'aide pour finaliser ma commande sur OFS";
    }
    return `${settings.whatsapp_msg_default || "Bonjour, j'ai une question sur OFS"}\n${pageUrl}`;
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
