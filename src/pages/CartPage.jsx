import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const MEMBER_DISCOUNT            = 0.20;
const BUNDLE_DISCOUNT_NON_MEMBER = 0.02;
const BUNDLE_DISCOUNT_MEMBER     = 0.05;

const getUnitPrice = (item, isMember) => {
  const base = Number(item.price) || 0;
  const vendorHasPromo = item.vendor?.member_discount_enabled ?? item.vendor_member_discount_enabled ?? false;
  if (isMember && vendorHasPromo) return Math.round(base * (1 - MEMBER_DISCOUNT));
  return base;
};

export default function CartPage() {
  const { isMember } = useAuth();
  const navigate     = useNavigate();

  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ofs_cart') || '[]'); } catch { return []; }
  });

  const [promoInput,   setPromoInput]   = useState('');
  const [promoApplied, setPromoApplied] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError,   setPromoError]   = useState('');

  useEffect(() => {
    try { localStorage.setItem('ofs_cart', JSON.stringify(cart)); } catch {}
    window.dispatchEvent(new CustomEvent('ofs:cartUpdated'));
  }, [cart]);

  const updateQty = (idx, delta) => {
    setCart(prev => {
      const next = (prev[idx].quantity || 1) + delta;
      if (next < 1) return prev.filter((_, i) => i !== idx);
      const c = [...prev];
      c[idx] = { ...c[idx], quantity: next };
      return c;
    });
  };

  const removeItem = (idx) => setCart(prev => prev.filter((_, i) => i !== idx));

  // ─── CALCULATIONS ───────────────────────────────────────────────────────────
  const rawTotal            = cart.reduce((s, i) => s + (Number(i.price)||0) * (i.quantity||1), 0);
  const subtotalAfterMember = cart.reduce((s, i) => s + getUnitPrice(i, isMember) * (i.quantity||1), 0);
  const memberSavings       = rawTotal - subtotalAfterMember;
  const hasBundle           = cart.length >= 2;
  const bundleRate          = isMember ? BUNDLE_DISCOUNT_MEMBER : BUNDLE_DISCOUNT_NON_MEMBER;
  const bundleAmount        = hasBundle ? Math.round(subtotalAfterMember * bundleRate) : 0;

  const promoDiscount = promoApplied
    ? (promoApplied.discount_type === 'percent'
        ? Math.round((subtotalAfterMember - bundleAmount) * promoApplied.discount_value / 100)
        : Math.min(Number(promoApplied.discount_value), subtotalAfterMember - bundleAmount))
    : 0;

  const cjItems       = cart.filter(i => !i.vendor_id);
  const cjShipWeightG = cjItems.reduce((s, i) => s + ((i.ship_weight_g || i.weight_g || 200) * (i.quantity || 1)), 0);
  const cjShipping    = cjItems.length > 0 ? Math.round(1015 + (cjShipWeightG / 1000) * 10000) : 0;
  const finalTotal    = subtotalAfterMember - bundleAmount - promoDiscount + cjShipping;
  const totalSaved    = memberSavings + bundleAmount + promoDiscount;
  const totalQty      = cart.reduce((s, i) => s + (i.quantity || 1), 0);

  // ─── PROMO ──────────────────────────────────────────────────────────────────
  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoLoading(true); setPromoError('');
    const { data } = await supabase
      .from('promo_codes')
      .select('id, code, discount_type, discount_value, min_order_amount, max_uses, current_uses, expires_at, is_active')
      .eq('code', code)
      .maybeSingle();
    if (!data || !data.is_active) { setPromoError('Code promo invalide ou inactif.'); setPromoLoading(false); return; }
    if (data.expires_at && new Date(data.expires_at) < new Date()) { setPromoError('Ce code promo a expiré.'); setPromoLoading(false); return; }
    if (data.max_uses != null && data.current_uses >= data.max_uses) { setPromoError("Limite d'utilisation atteinte."); setPromoLoading(false); return; }
    const base = subtotalAfterMember - bundleAmount;
    if (data.min_order_amount && base < Number(data.min_order_amount)) {
      setPromoError(`Minimum requis : ${Number(data.min_order_amount).toLocaleString()} FCFA`);
      setPromoLoading(false); return;
    }
    setPromoApplied(data);
    setPromoInput('');
    setPromoLoading(false);
  };

  const removePromo = () => { setPromoApplied(null); setPromoError(''); setPromoInput(''); };

  // ─── CHECKOUT ───────────────────────────────────────────────────────────────
  const handleCheckout = () => {
    if (promoApplied) {
      try { sessionStorage.setItem('ofs_pending_promo', JSON.stringify(promoApplied)); } catch {}
    }
    window.dispatchEvent(new CustomEvent('ofs:openCart'));
    navigate('/');
  };

  // ─── EMPTY STATE ────────────────────────────────────────────────────────────
  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#EAEDED] py-6 px-4">
        <div className="max-w-[1200px] mx-auto bg-white rounded-lg p-8 flex flex-col sm:flex-row items-center gap-8">
          <img src="https://m.media-amazon.com/images/G/01/cart/empty/kettle-desaturated._CB445243794_.svg"
            onError={e => { e.currentTarget.style.display = 'none'; }}
            alt="" className="w-44 h-44" />
          <div>
            <h1 className="text-[28px] font-bold text-[#0F1111] leading-tight">Votre panier OFS est vide</h1>
            <p className="text-sm text-[#0F1111] mt-2">Découvrez nos meilleures offres au Cameroun 🇨🇲 · Livraison express Douala.</p>
            <Link to="/store"
              className="inline-block mt-4 bg-[#FFD814] hover:bg-[#F7CA00] border border-[#FCD200] rounded-lg text-[#0F1111] font-medium text-sm px-6 py-2 transition">
              Explorer le store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EAEDED] py-5">
      <div className="max-w-[1200px] mx-auto px-3 md:px-5">
        <div className="flex flex-col lg:flex-row gap-4 items-start">

          {/* ═══ LEFT: ITEMS PANEL (Amazon style) ══════════════════════════════ */}
          <div className="flex-1 min-w-0 bg-white rounded-lg px-5 pt-4 pb-2">

            {/* Heading */}
            <div className="flex items-end justify-between border-b border-[#DDD] pb-1">
              <h1 className="text-[28px] font-normal text-[#0F1111] leading-none">Panier</h1>
              <span className="text-[13px] text-[#565959] hidden sm:block">Prix</span>
            </div>

            {/* Member / bundle highlight (Amazon-ish info strip) */}
            {(hasBundle || (isMember && memberSavings > 0)) && (
              <div className="mt-3 flex items-start gap-2 text-[13px] text-[#0F1111]">
                <i className="fa-solid fa-circle-check text-[#007600] mt-0.5"></i>
                <span>
                  {isMember && memberSavings > 0 && <>Remise membre Elite <b>−20 %</b> appliquée. </>}
                  {hasBundle && <>Bundle Deal <b>−{isMember ? 5 : 2} %</b> sur votre panier multi-articles. </>}
                  Vous économisez <b className="text-[#B12704]">{(memberSavings + bundleAmount).toLocaleString()} FCFA</b>.
                </span>
              </div>
            )}

            {/* Items */}
            <div>
              {cart.map((item, idx) => {
                const base    = Number(item.price) || 0;
                const unitEff = getUnitPrice(item, isMember);
                const isDisc  = unitEff < base;
                const lineTot = unitEff * (item.quantity || 1);
                const qty     = item.quantity || 1;

                return (
                  <div key={idx} className="flex gap-3 sm:gap-5 py-5 border-b border-[#E7E7E7]">
                    {/* Image */}
                    <Link to={`/product/${item.id}`}
                      className="w-[100px] h-[100px] sm:w-[180px] sm:h-[180px] flex-shrink-0 flex items-center justify-center">
                      <img src={item.img || 'https://via.placeholder.com/180'}
                        alt={item.name} className="max-w-full max-h-full object-contain" />
                    </Link>

                    {/* Middle */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <Link to={`/product/${item.id}`}
                          className="text-[15px] sm:text-[18px] text-[#0F1111] hover:text-[#C7511F] leading-snug line-clamp-2 transition-colors">
                          {item.name}
                        </Link>
                        {/* Price (right) */}
                        <div className="text-right flex-shrink-0">
                          <p className={`text-[15px] sm:text-[18px] font-bold ${isDisc ? 'text-[#B12704]' : 'text-[#0F1111]'}`}>
                            {lineTot.toLocaleString()}<span className="text-[11px] align-top ml-0.5">FCFA</span>
                          </p>
                          {isDisc && (
                            <p className="text-[12px] text-[#565959] line-through">
                              {(base * qty).toLocaleString()} F
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Variant */}
                      {(item.selectedSize || item.selectedColor) && (
                        <p className="text-[12px] text-[#565959] mt-1">
                          {item.selectedSize && <>Taille : {item.selectedSize}</>}
                          {item.selectedSize && item.selectedColor && '  '}
                          {item.selectedColor && <>Couleur : {item.selectedColor}</>}
                        </p>
                      )}

                      {/* In stock */}
                      <p className="text-[12px] text-[#007600] mt-1">En stock</p>
                      <p className="text-[12px] text-[#565959] mt-0.5">
                        <i className="fa-solid fa-bolt text-[#FF9900] mr-1 text-[9px]"></i>
                        Livraison 2h · Douala 🇨🇲
                      </p>

                      {/* Controls row */}
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        {/* Qty pill (Amazon) */}
                        <div className="inline-flex items-center bg-white border border-[#D5D9D9] rounded-full h-[34px] shadow-[0_2px_5px_rgba(15,17,17,.10)] overflow-hidden">
                          <button onClick={() => updateQty(idx, -1)}
                            className="w-[38px] h-full flex items-center justify-center text-[#007185] hover:bg-[#F7FAFA] transition"
                            title={qty === 1 ? 'Supprimer' : 'Diminuer'}>
                            {qty === 1
                              ? <i className="fa-solid fa-trash-can text-[13px]"></i>
                              : <span className="text-lg leading-none">−</span>}
                          </button>
                          <span className="min-w-[34px] text-center text-[15px] font-bold text-[#0F1111] border-x border-[#E7E7E7]">
                            {qty}
                          </span>
                          <button onClick={() => updateQty(idx, 1)}
                            className="w-[38px] h-full flex items-center justify-center text-[#007185] hover:bg-[#F7FAFA] transition"
                            title="Augmenter">
                            <span className="text-lg leading-none">+</span>
                          </button>
                        </div>

                        <span className="text-[#D5D9D9]">|</span>
                        <button onClick={() => removeItem(idx)}
                          className="text-[13px] text-[#007185] hover:text-[#C7511F] hover:underline transition">
                          Supprimer
                        </button>
                        <span className="text-[#D5D9D9]">|</span>
                        <Link to="/studio" state={{ productId: item.id }}
                          className="text-[13px] text-[#007185] hover:text-[#C7511F] hover:underline transition">
                          Personnaliser
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Subtotal line (right aligned, Amazon) */}
            <div className="text-right py-4 text-[18px] text-[#0F1111]">
              Sous-total ({totalQty} article{totalQty > 1 ? 's' : ''}) :{' '}
              <span className="font-bold">{Math.round(finalTotal).toLocaleString()} FCFA</span>
            </div>
          </div>

          {/* ═══ RIGHT: CHECKOUT BOX (Amazon style) ════════════════════════════ */}
          <div className="w-full lg:w-[300px] flex-shrink-0 space-y-3">

            {/* Subtotal box */}
            <div className="bg-white rounded-lg p-5">
              {totalSaved > 0 && (
                <p className="text-[13px] text-[#007600] mb-2 leading-snug">
                  <i className="fa-solid fa-circle-check mr-1"></i>
                  Vous économisez <b>{totalSaved.toLocaleString()} FCFA</b> sur cette commande
                </p>
              )}

              <p className="text-[18px] text-[#0F1111] leading-tight mb-3">
                Sous-total ({totalQty} article{totalQty > 1 ? 's' : ''}) :{' '}
                <span className="font-bold">{Math.round(finalTotal).toLocaleString()} FCFA</span>
              </p>

              <button onClick={handleCheckout}
                className="w-full bg-[#FFD814] hover:bg-[#F7CA00] border border-[#FCD200] rounded-full text-[#0F1111] text-[13px] font-medium py-2 transition shadow-[0_2px_5px_rgba(213,217,217,.5)]">
                Passer à la livraison
              </button>
            </div>

            {/* Promo code box */}
            <div className="bg-white rounded-lg p-5">
              <p className="text-[15px] font-bold text-[#0F1111] mb-2">Code promo</p>
              {promoApplied ? (
                <div className="flex items-center justify-between bg-[#E8F5E8] border border-[#007600]/20 rounded-md px-3 py-2.5">
                  <div>
                    <span className="text-[14px] font-bold text-[#007600]">{promoApplied.code}</span>
                    <span className="text-[12px] text-[#565959] ml-2">−{promoDiscount.toLocaleString()} FCFA</span>
                  </div>
                  <button onClick={removePromo} className="text-[12px] text-[#007185] hover:text-[#C7511F] hover:underline">
                    Retirer
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={e => setPromoInput(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && applyPromo()}
                    placeholder="Entrer le code"
                    className="w-full border border-[#888C8C] focus:border-[#E77600] focus:outline-none focus:shadow-[0_0_0_3px_rgba(228,121,17,.25)] rounded-md px-3 py-2 text-[14px] font-mono uppercase bg-white placeholder-[#767676] transition"
                  />
                  {promoError && (
                    <p className="text-[12px] text-[#B12704]">
                      <i className="fa-solid fa-circle-exclamation mr-1 text-[10px]"></i>{promoError}
                    </p>
                  )}
                  <button onClick={applyPromo} disabled={promoLoading || !promoInput.trim()}
                    className="w-full border border-[#D5D9D9] bg-[#F0F2F2] hover:bg-[#E3E6E6] rounded-full text-[#0F1111] text-[13px] py-1.5 transition disabled:opacity-50">
                    {promoLoading ? <i className="fa-solid fa-spinner fa-spin text-xs"></i> : 'Appliquer'}
                  </button>
                </div>
              )}
            </div>

            {/* Price details box */}
            <div className="bg-white rounded-lg p-5 text-[13px]">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#565959]">Sous-total</span>
                  <span className="text-[#0F1111]">{rawTotal.toLocaleString()} FCFA</span>
                </div>
                {memberSavings > 0 && (
                  <div className="flex justify-between text-[#007600]">
                    <span>Remise membre −20 %</span>
                    <span>−{memberSavings.toLocaleString()} F</span>
                  </div>
                )}
                {hasBundle && (
                  <div className="flex justify-between text-[#007600]">
                    <span>Bundle Deal −{isMember ? 5 : 2} %</span>
                    <span>−{bundleAmount.toLocaleString()} F</span>
                  </div>
                )}
                {promoDiscount > 0 && (
                  <div className="flex justify-between text-[#007600]">
                    <span>Code {promoApplied?.code}</span>
                    <span>−{promoDiscount.toLocaleString()} F</span>
                  </div>
                )}
                {cjShipping > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-[#565959]">Expédition internationale</span>
                    <span className="text-[#007185]">~{cjShipping.toLocaleString()} F</span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-[#565959]">Livraison · Douala</span>
                    <span className="text-[#007600]">Gratuite</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-[#E7E7E7] pt-2 mt-1 text-[16px]">
                  <span className="font-bold text-[#B12704]">Total</span>
                  <span className="font-bold text-[#B12704]">{Math.round(finalTotal).toLocaleString()} FCFA</span>
                </div>
              </div>
            </div>

            {/* Payment methods */}
            <div className="bg-white rounded-lg px-5 py-3">
              <div className="flex items-center justify-center gap-4 flex-wrap text-[11px] text-[#565959]">
                <span className="flex items-center gap-1"><i className="fa-solid fa-mobile-screen-button text-orange-500"></i> Orange Money</span>
                <span className="flex items-center gap-1"><i className="fa-solid fa-mobile-screen-button text-yellow-500"></i> MTN MoMo</span>
                <span className="flex items-center gap-1"><i className="fa-solid fa-money-bill-wave text-[#007600]"></i> Cash</span>
              </div>
            </div>

            <Link to="/store" className="block text-center text-[13px] text-[#007185] hover:text-[#C7511F] hover:underline">
              ← Continuer mes achats
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
