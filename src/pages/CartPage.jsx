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

  // Sync to localStorage so App.jsx cart state stays in sync on navigation
  useEffect(() => {
    try { localStorage.setItem('ofs_cart', JSON.stringify(cart)); } catch {}
    // Notify App.jsx of cart change
    window.dispatchEvent(new CustomEvent('ofs:cartUpdated'));
  }, [cart]);

  const updateQty = (idx, delta) => {
    setCart(prev => {
      const c = [...prev];
      c[idx] = { ...c[idx], quantity: Math.max(1, (c[idx].quantity || 1) + delta) };
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
      <div className="min-h-screen bg-[#EAEDED] flex flex-col items-center justify-center p-8">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-5 border border-[#D5D9D9]">
          <i className="fa-solid fa-bag-shopping text-[#D5D9D9] text-4xl"></i>
        </div>
        <h2 className="text-2xl font-black text-[#0F1111] mb-2">Votre panier est vide</h2>
        <p className="text-[#565959] mb-6">Découvrez nos meilleures offres 🇨🇲</p>
        <Link to="/store"
          className="bg-[#FFD814] hover:bg-[#F7CA00] border border-[#FCD200] text-[#0F1111] font-bold px-8 py-3 rounded transition">
          <i className="fa-solid fa-bag-shopping mr-2 text-xs"></i>Explorer le store
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EAEDED]">

      {/* ── PAGE HEADER ── */}
      <div className="bg-white border-b border-[#D5D9D9]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-[#0F1111]">Mon Panier</h1>
            <p className="text-[11px] text-[#565959] mt-0.5">
              {totalQty} article{totalQty > 1 ? 's' : ''} · Livraison à Douala 🇨🇲
            </p>
          </div>
          <Link to="/store" className="text-sm text-[#007185] hover:text-[#C45500] hover:underline transition flex items-center gap-1.5">
            <i className="fa-solid fa-arrow-left text-xs"></i> Continuer les achats
          </Link>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="max-w-[1280px] mx-auto px-4 md:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ═══ LEFT: ITEMS ════════════════════════════════════════════════════ */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* Bundle / member banner */}
            {(hasBundle || (isMember && memberSavings > 0)) && (
              <div className="bg-[#FFF8D3] border border-[#FCD200]/40 rounded-xl px-4 py-3 flex items-center gap-3">
                <i className="fa-solid fa-tag text-[#FF9900] text-base flex-shrink-0"></i>
                <div>
                  {hasBundle && <p className="text-sm font-bold text-[#0F1111]">Bundle Deal −{isMember ? 5 : 2}% appliqué · {bundleAmount.toLocaleString()} FCFA économisés</p>}
                  {isMember && memberSavings > 0 && <p className="text-sm font-bold text-[#0F1111]">Remise membre Elite −20% · {memberSavings.toLocaleString()} FCFA économisés</p>}
                </div>
              </div>
            )}

            {/* Items card */}
            <div className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#F3F4F4] flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#565959]">
                  <i className="fa-solid fa-bag-shopping text-[#FF9900] mr-1.5"></i>Articles ({totalQty})
                </p>
                <button onClick={() => { if (window.confirm('Vider le panier ?')) setCart([]); }}
                  className="text-[11px] text-[#565959] hover:text-[#B12704] transition">
                  Vider le panier
                </button>
              </div>

              <div className="divide-y divide-[#F3F4F4]">
                {cart.map((item, idx) => {
                  const base    = Number(item.price) || 0;
                  const unitEff = getUnitPrice(item, isMember);
                  const isDisc  = unitEff < base;
                  const lineTot = unitEff * (item.quantity || 1);

                  return (
                    <div key={idx} className="flex gap-4 p-5">
                      {/* Image */}
                      <div className="w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] flex-shrink-0 bg-[#F3F4F4] rounded-lg border border-[#D5D9D9] overflow-hidden">
                        <img src={item.img || 'https://via.placeholder.com/120'}
                          alt={item.name} className="w-full h-full object-contain p-2" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <p className="font-bold text-[#0F1111] text-sm leading-snug line-clamp-2">{item.name}</p>

                        {(item.selectedSize || item.selectedColor) && (
                          <p className="text-xs text-[#565959]">
                            {item.selectedSize && `Taille: ${item.selectedSize}`}
                            {item.selectedSize && item.selectedColor && ' · '}
                            {item.selectedColor && `Couleur: ${item.selectedColor}`}
                          </p>
                        )}

                        <p className="text-xs text-[#007600] font-bold">
                          <i className="fa-solid fa-bolt text-[#FF9900] mr-1 text-[9px]"></i>
                          Livraison 2h · Douala 🇨🇲
                        </p>

                        {/* Price + Controls row */}
                        <div className="flex items-center justify-between flex-wrap gap-3 mt-auto">
                          {/* Qty */}
                          <div className="flex items-center border border-[#D5D9D9] rounded-lg overflow-hidden">
                            <button onClick={() => updateQty(idx, -1)}
                              className="w-9 h-9 text-[#565959] hover:bg-[#F3F4F4] hover:text-[#FF9900] transition font-bold text-lg flex items-center justify-center">
                              −
                            </button>
                            <span className="w-10 text-center text-sm font-black text-[#0F1111] border-x border-[#D5D9D9] py-1.5">
                              {item.quantity || 1}
                            </span>
                            <button onClick={() => updateQty(idx, 1)}
                              className="w-9 h-9 text-[#565959] hover:bg-[#F3F4F4] hover:text-[#FF9900] transition font-bold text-lg flex items-center justify-center">
                              +
                            </button>
                          </div>

                          {/* Price */}
                          <div className="text-right">
                            <p className={`font-black text-lg leading-none ${isDisc ? 'text-[#B12704]' : 'text-[#0F1111]'}`}>
                              {lineTot.toLocaleString()} FCFA
                            </p>
                            {isDisc && (
                              <p className="text-xs text-[#565959] line-through mt-0.5">
                                {(base * (item.quantity||1)).toLocaleString()} F
                              </p>
                            )}
                          </div>
                        </div>

                        <button onClick={() => removeItem(idx)}
                          className="text-xs text-[#007185] hover:text-[#C45500] hover:underline transition self-start mt-0.5">
                          <i className="fa-solid fa-trash text-[9px] mr-1"></i>Retirer
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ═══ RIGHT: SUMMARY ════════════════════════════════════════════════ */}
          <div className="w-full lg:w-[340px] flex-shrink-0 lg:sticky lg:top-4 space-y-3">

            {/* Summary card */}
            <div className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden">

              {/* Total header */}
              <div className="px-5 pt-5 pb-4 border-b border-[#F3F4F4]">
                <p className="text-sm text-[#565959] mb-1">
                  Sous-total ({totalQty} art.) :
                </p>
                <p className="text-3xl font-black text-[#B12704] leading-none">
                  {Math.round(finalTotal).toLocaleString()}
                  <span className="text-base font-bold text-[#565959] ml-1.5">FCFA</span>
                </p>
                {totalSaved > 0 && (
                  <p className="text-xs text-[#007600] font-bold mt-1.5">
                    <i className="fa-solid fa-circle-check text-[9px] mr-1"></i>
                    Vous économisez {totalSaved.toLocaleString()} FCFA
                  </p>
                )}
              </div>

              <div className="px-5 py-4 space-y-4">

                {/* Promo code */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#565959] mb-2">
                    <i className="fa-solid fa-tag text-[#FF9900] mr-1.5"></i>Code promo
                  </p>
                  {promoApplied ? (
                    <div className="flex items-center justify-between bg-[#E8F5E8] border border-[#007600]/20 rounded-lg px-3 py-2.5">
                      <div>
                        <span className="text-sm font-black text-[#007600]">{promoApplied.code}</span>
                        <span className="text-xs text-[#565959] ml-2">−{promoDiscount.toLocaleString()} FCFA</span>
                      </div>
                      <button onClick={removePromo} className="text-[11px] text-[#B12704] hover:underline font-bold">
                        Retirer
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={promoInput}
                          onChange={e => setPromoInput(e.target.value.toUpperCase())}
                          onKeyDown={e => e.key === 'Enter' && applyPromo()}
                          placeholder="Entrer le code"
                          className="flex-1 border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded-lg px-3 py-2.5 text-sm font-mono uppercase bg-white placeholder-[#adb5bd] transition-colors"
                        />
                        <button onClick={applyPromo} disabled={promoLoading || !promoInput.trim()}
                          className="bg-[#232F3E] hover:bg-[#37475A] text-white px-4 py-2.5 rounded-lg text-sm font-black transition disabled:opacity-50 flex-shrink-0">
                          {promoLoading ? <i className="fa-solid fa-spinner fa-spin text-xs"></i> : 'OK'}
                        </button>
                      </div>
                      {promoError && (
                        <p className="text-[11px] text-[#B12704]">
                          <i className="fa-solid fa-circle-exclamation mr-1 text-[10px]"></i>{promoError}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Price breakdown */}
                <div className="space-y-1.5 text-sm border-t border-[#F3F4F4] pt-3">
                  <div className="flex justify-between">
                    <span className="text-[#565959]">Sous-total</span>
                    <span className="font-bold text-[#0F1111]">{rawTotal.toLocaleString()} FCFA</span>
                  </div>
                  {memberSavings > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#007600]">Remise membre −20%</span>
                      <span className="font-bold text-[#007600]">−{memberSavings.toLocaleString()} F</span>
                    </div>
                  )}
                  {hasBundle && (
                    <div className="flex justify-between">
                      <span className="text-[#007600]">Bundle Deal −{isMember ? 5 : 2}%</span>
                      <span className="font-bold text-[#007600]">−{bundleAmount.toLocaleString()} F</span>
                    </div>
                  )}
                  {promoDiscount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#007600] flex items-center gap-1">
                        <i className="fa-solid fa-tag text-[9px]" /> Code {promoApplied?.code}
                      </span>
                      <span className="font-bold text-[#007600]">−{promoDiscount.toLocaleString()} F</span>
                    </div>
                  )}
                  {cjShipping > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-[#565959] flex items-center gap-1">
                        <i className="fa-solid fa-plane text-[#007185] text-[9px]" /> Expédition int.
                      </span>
                      <span className="font-bold text-[#007185]">~{cjShipping.toLocaleString()} F</span>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-[#565959]">Livraison · Douala</span>
                      <span className="font-bold text-[#007600]">Gratuite</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline border-t border-[#D5D9D9] pt-2 mt-2">
                    <span className="font-black text-[#0F1111]">Total :</span>
                    <div>
                      <span className="text-2xl font-black text-[#0F1111]">{Math.round(finalTotal).toLocaleString()}</span>
                      <span className="text-sm text-[#565959] ml-1">FCFA</span>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <button onClick={handleCheckout}
                  className="w-full bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] py-4 rounded-lg font-black text-sm transition active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm">
                  <i className="fa-solid fa-truck-fast text-xs"></i>
                  Passer à la livraison
                </button>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-5 pt-1 border-t border-[#F3F4F4]">
                  <span className="flex items-center gap-1 text-[10px] text-[#565959]">
                    <i className="fa-solid fa-lock text-[#007600] text-xs"></i> Sécurisé
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-[#565959]">
                    <i className="fa-solid fa-rotate-left text-[#007185] text-xs"></i> Retour 7j
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-[#565959]">
                    <i className="fa-solid fa-bolt text-[#FF9900] text-xs"></i> 2h Douala
                  </span>
                </div>
              </div>
            </div>

            {/* Payment methods */}
            <div className="bg-white border border-[#D5D9D9] rounded-xl px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#565959] mb-2">
                Modes de paiement acceptés
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1.5 text-[11px] text-[#565959]">
                  <i className="fa-solid fa-mobile-screen-button text-orange-500"></i> Orange Money
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-[#565959]">
                  <i className="fa-solid fa-mobile-screen-button text-yellow-500"></i> MTN MoMo
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-[#565959]">
                  <i className="fa-solid fa-money-bill-wave text-[#007600]"></i> Cash livraison
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
