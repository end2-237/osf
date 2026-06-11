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

const ABANDON_MS = 30 * 60 * 1000; // 30 minutes

const readLocalCart = () => {
  try { return JSON.parse(localStorage.getItem('ofs_cart') || '[]'); } catch { return []; }
};

const WhatsAppButton = () => {
  const location = useLocation();
  const [hovered,       setHovered]       = useState(false);
  const [settings,      setSettings]      = useState(null);
  const [cartReminder,  setCartReminder]  = useState(false);

  useEffect(() => {
    fetchSiteSettings(WA_KEYS).then(s => setSettings(s));
  }, []);

  // Abandoned-cart detection: check every minute if cart has items idle > 30 min
  useEffect(() => {
    const check = () => {
      const ts   = parseInt(localStorage.getItem('ofs_cart_ts') || '0');
      if (!ts) { setCartReminder(false); return; }
      const cart = readLocalCart();
      setCartReminder(cart.length > 0 && Date.now() - ts > ABANDON_MS);
    };
    check();
    const iv = setInterval(check, 60_000);
    return () => clearInterval(iv);
  }, []);

  if (!settings?.whatsapp_phone) return null;

  const phone = settings.whatsapp_phone.replace(/\D/g, '');

  const getMessage = () => {
    const path    = location.pathname;
    const pageUrl = window.location.href;

    // Abandoned cart message takes priority
    if (cartReminder) {
      const cart = readLocalCart();
      if (cart.length > 0) {
        const lines = cart.slice(0, 4).map(i => `• ${i.name} (x${i.quantity})`);
        const total = cart.reduce((s, i) => s + (Number(i.price) || 0) * i.quantity, 0);
        return [
          "Bonjour ! J'avais des articles dans mon panier OFS et je souhaitais finaliser ma commande :",
          lines.join('\n'),
          `Total estimé : ~${Math.round(total).toLocaleString('fr-FR')} FCFA`,
          'Pouvez-vous m\'aider ?',
        ].join('\n');
      }
    }

    if (path.startsWith('/product/')) {
      const prod = window.__ofs_product || {};
      const name = prod.name || '';
      const tpl  = settings.whatsapp_msg_product || 'Bonjour, je suis intéressé par "{product}" sur OFS';
      const text = name ? tpl.replace('{product}', name) : (settings.whatsapp_msg_default || "Bonjour, j'ai une question sur OFS");
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
    // Dismiss reminder on click
    if (cartReminder) setCartReminder(false);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(getMessage())}`, '_blank');
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 pointer-events-none">
      {/* Abandoned-cart reminder tooltip */}
      {cartReminder && !hovered && (
        <div className="pointer-events-auto bg-white text-[#0F1111] text-xs font-semibold px-3 py-2 rounded-xl shadow-lg border border-gray-100 whitespace-nowrap animate-bounce cursor-pointer"
          onClick={handleClick}>
          🛒 Vous avez des articles en attente !
        </div>
      )}
      {hovered && !cartReminder && (
        <div className="pointer-events-none bg-white text-[#0F1111] text-xs font-semibold px-3 py-2 rounded-xl shadow-lg border border-gray-100 whitespace-nowrap">
          {cartReminder ? '🛒 Finaliser ma commande' : 'Discutons sur WhatsApp'}
        </div>
      )}
      <div className="relative pointer-events-auto">
        {cartReminder && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-ping z-10" />
        )}
        {cartReminder && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center z-20">
            <i className="fa-solid fa-cart-shopping text-[7px] text-white" />
          </span>
        )}
        <button
          onClick={handleClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={`w-14 h-14 text-white rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 ${cartReminder ? 'bg-[#128C7E] hover:bg-[#0d7a6b]' : 'bg-[#25D366] hover:bg-[#1ebe5d]'}`}
          aria-label="Contacter via WhatsApp"
        >
          <i className="fa-brands fa-whatsapp text-2xl"></i>
        </button>
      </div>
    </div>
  );
};

export default WhatsAppButton;
