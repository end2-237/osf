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
  const [suggestions,  setSuggestions]  = useState([]);
  const [carousel,     setCarousel]     = useState([]);
  const [addedId,      setAddedId]      = useState(null);
  const [shareCopied,  setShareCopied]  = useState(false);

  useEffect(() => {
    try { localStorage.setItem('ofs_cart', JSON.stringify(cart)); } catch {}
    window.dispatchEvent(new CustomEvent('ofs:cartUpdated'));
  }, [cart]);

  // ─── SUGGESTIONS — max products, all categories mixed ───────────────────────
  useEffect(() => {
    const load = async () => {
      const cartIds    = cart.map(i => i.id).filter(Boolean);
      const cartTypes  = [...new Set(cart.map(i => i.type).filter(Boolean))];
      const notInCart  = q => cartIds.length > 0
        ? q.not('id', 'in', `(${cartIds.map(i => `"${i}"`).join(',')})`)
        : q;

      // Same-category products (priority) + a large batch of everything else
      const [sameCat, latest] = await Promise.all([
        cartTypes.length > 0
          ? notInCart(
              supabase.from('products')
                .select('*, vendor:vendors!vendor_id(member_discount_enabled)')
                .in('type', cartTypes)
                .order('created_at', { ascending: false })
                .limit(15)
            ).then(r => r.data || [])
          : Promise.resolve([]),
        notInCart(
          supabase.from('products')
            .select('*, vendor:vendors!vendor_id(member_discount_enabled)')
            .order('created_at', { ascending: false })
            .limit(60)
        ).then(r => r.data || []),
      ]);

      // Merge: same category first, then everything else (dedup)
      const seen = new Set();
      const all  = [];
      [...sameCat, ...latest].forEach(p => {
        if (!seen.has(p.id)) { seen.add(p.id); all.push(p); }
      });

      // Grid: first 20 · Carousel: the next batch (shuffled for variety)
      setSuggestions(all.slice(0, 20));
      const rest = all.slice(20);
      const pool = rest.length >= 8 ? rest : all;
      setCarousel([...pool].sort(() => Math.random() - 0.5).slice(0, 18));
    };
    load();
    // Reload only when the set of product ids changes (not on qty change)
  }, [cart.map(i => i.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const addSuggestion = (p) => {
    setCart(prev => {
      const existing = prev.findIndex(i => i.id === p.id && !i.selectedSize && !i.selectedColor);
      if (existing > -1) {
        const c = [...prev];
        c[existing] = { ...c[existing], quantity: (c[existing].quantity || 1) + 1 };
        return c;
      }
      return [...prev, {
        id: p.id, name: p.name, price: p.price, img: p.img, quantity: 1,
        vendor_id: p.vendor_id || null,
        vendor_member_discount_enabled: p.vendor?.member_discount_enabled || false,
        cj_product_id: p.cj_product_id || null,
        weight_g: p.weight_g || null, ship_weight_g: p.ship_weight_g || null,
      }];
    });
    setAddedId(p.id);
    setTimeout(() => setAddedId(null), 1500);
  };

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

  // ─── SHARE CART ─────────────────────────────────────────────────────────────
  const shareCart = () => {
    const FIELDS = ['id','name','price','img','quantity','selectedSize','selectedColor',
      'vendor_id','vendor_member_discount_enabled','cj_product_id','weight_g','ship_weight_g'];
    const minimal = cart.map(item =>
      Object.fromEntries(FIELDS.filter(k => item[k] != null).map(k => [k, item[k]]))
    );
    const url = `${window.location.origin}/store?cart=${btoa(JSON.stringify(minimal))}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    });
  };

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
      <div className="min-h-screen bg-[#E3E6E6] p-3">
        <div className="max-w-[1500px] mx-auto bg-white p-10 flex flex-col sm:flex-row items-center gap-10">
          <div className="w-40 h-40 bg-[#F0F2F2] rounded-full flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-bag-shopping text-[#D5D9D9] text-6xl"></i>
          </div>
          <div>
            <h1 className="text-[28px] font-bold text-[#0F1111] leading-tight">Votre panier OFS est vide</h1>
            <p className="text-sm text-[#0F1111] mt-2">Découvrez nos meilleures offres au Cameroun 🇨🇲 · Livraison express Douala.</p>
            <Link to="/store"
              className="inline-block mt-4 bg-[#FFD814] hover:bg-[#F7CA00] border border-[#FCD200] rounded-full text-[#0F1111] font-medium text-sm px-8 py-2 transition shadow-[0_2px_5px_rgba(213,217,217,.5)]">
              Explorer le store
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E3E6E6] p-2 md:p-3">
      <div className="max-w-[1500px] mx-auto flex flex-col lg:flex-row gap-2 md:gap-3 items-start">

        {/* ═══ LEFT RAIL — Amazon flyout style ═════════════════════════════════ */}
        <aside className="w-full lg:w-[240px] flex-shrink-0 lg:sticky lg:top-3 bg-white">

          {/* Subtotal header */}
          <div className="px-4 pt-4 pb-3 text-center border-b border-[#E7E7E7]">
            <p className="text-[15px] text-[#0F1111]">Sous-total</p>
            <p className="text-[20px] font-bold text-[#B12704] leading-tight">
              {Math.round(finalTotal).toLocaleString()} FCFA
            </p>
            {totalSaved > 0 && (
              <p className="text-[11px] text-[#007600] mt-0.5">
                Vous économisez {totalSaved.toLocaleString()} F
              </p>
            )}
            <button onClick={handleCheckout}
              className="mt-3 w-full bg-white hover:bg-[#F7FAFA] border border-[#D5D9D9] rounded-full text-[#0F1111] text-[13px] py-1.5 transition shadow-[0_2px_5px_rgba(213,217,217,.5)]">
              Passer à la livraison
            </button>
            <button onClick={shareCart}
              className="mt-2 w-full bg-white hover:bg-[#F7FAFA] border border-[#D5D9D9] rounded-full text-[13px] py-1.5 transition shadow-[0_2px_5px_rgba(213,217,217,.5)] flex items-center justify-center gap-1.5
                text-[#007185] hover:text-[#C7511F]">
              <i className={`fa-solid ${shareCopied ? 'fa-circle-check text-[#007600]' : 'fa-share-nodes'} text-[11px]`}></i>
              {shareCopied ? 'Lien copié !' : 'Partager mon panier'}
            </button>
          </div>

          {/* Items stack */}
          <div className="divide-y divide-[#E7E7E7]">
            {cart.map((item, idx) => {
              const unitEff = getUnitPrice(item, isMember);
              const lineTot = unitEff * (item.quantity || 1);
              const qty     = item.quantity || 1;
              return (
                <div key={idx} className="px-4 py-4 flex flex-col items-center">
                  <Link to={`/product/${item.id}`} className="w-[120px] h-[120px] flex items-center justify-center">
                    <img src={item.img || 'https://via.placeholder.com/120'}
                      alt={item.name} className="max-w-full max-h-full object-contain mix-blend-multiply" />
                  </Link>
                  <p className="text-[15px] font-bold text-[#0F1111] mt-2">
                    {lineTot.toLocaleString()} <span className="text-[10px] align-top">FCFA</span>
                  </p>
                  {/* Qty pill with yellow ring */}
                  <div className="mt-2 inline-flex items-center bg-white border-[3px] border-[#FFD814] rounded-full h-[36px] overflow-hidden">
                    <button onClick={() => updateQty(idx, -1)}
                      className="w-[36px] h-full flex items-center justify-center text-[#0F1111] hover:bg-[#F7FAFA] transition"
                      title={qty === 1 ? 'Supprimer' : 'Diminuer'}>
                      {qty === 1
                        ? <i className="fa-solid fa-trash-can text-[13px]"></i>
                        : <span className="text-lg leading-none">−</span>}
                    </button>
                    <span className="min-w-[32px] text-center text-[15px] font-bold text-[#0F1111]">
                      {qty}
                    </span>
                    <button onClick={() => updateQty(idx, 1)}
                      className="w-[36px] h-full flex items-center justify-center text-[#0F1111] hover:bg-[#F7FAFA] transition"
                      title="Augmenter">
                      <span className="text-lg leading-none">+</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Promo */}
          <div className="px-4 py-3 border-t border-[#E7E7E7]">
            <p className="text-[13px] font-bold text-[#0F1111] mb-2">Code promo</p>
            {promoApplied ? (
              <div className="flex items-center justify-between bg-[#E8F5E8] border border-[#007600]/20 rounded-md px-2.5 py-2">
                <div className="min-w-0">
                  <span className="text-[12px] font-bold text-[#007600]">{promoApplied.code}</span>
                  <span className="text-[11px] text-[#565959] ml-1.5">−{promoDiscount.toLocaleString()} F</span>
                </div>
                <button onClick={removePromo} className="text-[11px] text-[#007185] hover:text-[#C7511F] hover:underline flex-shrink-0">
                  Retirer
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={e => setPromoInput(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && applyPromo()}
                    placeholder="Code"
                    className="flex-1 min-w-0 border border-[#888C8C] focus:border-[#E77600] focus:outline-none focus:shadow-[0_0_0_3px_rgba(228,121,17,.25)] rounded-md px-2.5 py-1.5 text-[12px] font-mono uppercase bg-white placeholder-[#767676] transition"
                  />
                  <button onClick={applyPromo} disabled={promoLoading || !promoInput.trim()}
                    className="border border-[#D5D9D9] bg-[#F0F2F2] hover:bg-[#E3E6E6] rounded-full text-[#0F1111] text-[11px] px-3 transition disabled:opacity-50 flex-shrink-0">
                    {promoLoading ? <i className="fa-solid fa-spinner fa-spin text-[10px]"></i> : 'OK'}
                  </button>
                </div>
                {promoError && (
                  <p className="text-[11px] text-[#B12704] mt-1.5">
                    <i className="fa-solid fa-circle-exclamation mr-1 text-[9px]"></i>{promoError}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Price details */}
          <div className="px-4 py-3 border-t border-[#E7E7E7] text-[12px] space-y-1">
            <div className="flex justify-between">
              <span className="text-[#565959]">Sous-total</span>
              <span className="text-[#0F1111]">{rawTotal.toLocaleString()} F</span>
            </div>
            {memberSavings > 0 && (
              <div className="flex justify-between text-[#007600]">
                <span>Membre −20 %</span><span>−{memberSavings.toLocaleString()} F</span>
              </div>
            )}
            {hasBundle && (
              <div className="flex justify-between text-[#007600]">
                <span>Bundle −{isMember ? 5 : 2} %</span><span>−{bundleAmount.toLocaleString()} F</span>
              </div>
            )}
            {promoDiscount > 0 && (
              <div className="flex justify-between text-[#007600]">
                <span>Code {promoApplied?.code}</span><span>−{promoDiscount.toLocaleString()} F</span>
              </div>
            )}
            {cjShipping > 0 ? (
              <div className="flex justify-between">
                <span className="text-[#565959]">Expédition int.</span>
                <span className="text-[#007185]">~{cjShipping.toLocaleString()} F</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-[#565959]">Livraison</span>
                <span className="text-[#007600]">Gratuite</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[#E7E7E7] pt-1.5 text-[13px]">
              <span className="font-bold text-[#B12704]">Total</span>
              <span className="font-bold text-[#B12704]">{Math.round(finalTotal).toLocaleString()} F</span>
            </div>
          </div>
        </aside>

        {/* ═══ MAIN — items + suggestions ══════════════════════════════════════ */}
        <div className="flex-1 min-w-0 w-full space-y-2 md:space-y-3">

          {/* Items panel */}
          <div className="bg-white px-4 md:px-6 pt-5 pb-3">
            <div className="flex items-end justify-between border-b border-[#DDD] pb-2">
              <h1 className="text-[26px] md:text-[28px] font-medium text-[#0F1111] leading-none">Panier</h1>
              <span className="text-[13px] text-[#565959] hidden sm:block pr-1">Prix</span>
            </div>

            {(hasBundle || (isMember && memberSavings > 0)) && (
              <div className="flex items-start gap-2 text-[13px] text-[#0F1111] py-2.5 border-b border-[#E7E7E7]">
                <i className="fa-solid fa-circle-check text-[#007600] mt-0.5"></i>
                <span>
                  {isMember && memberSavings > 0 && <>Remise membre Elite <b>−20 %</b> appliquée. </>}
                  {hasBundle && <>Bundle Deal <b>−{isMember ? 5 : 2} %</b> sur votre panier multi-articles. </>}
                  Vous économisez <b className="text-[#B12704]">{(memberSavings + bundleAmount).toLocaleString()} FCFA</b>.
                </span>
              </div>
            )}

            {cart.map((item, idx) => {
              const base    = Number(item.price) || 0;
              const unitEff = getUnitPrice(item, isMember);
              const isDisc  = unitEff < base;
              const lineTot = unitEff * (item.quantity || 1);
              const qty     = item.quantity || 1;

              return (
                <div key={idx} className="flex gap-3 sm:gap-4 py-4 border-b border-[#E7E7E7]">
                  <Link to={`/product/${item.id}`}
                    className="w-[96px] h-[96px] sm:w-[150px] sm:h-[150px] flex-shrink-0 flex items-center justify-center bg-white">
                    <img src={item.img || 'https://via.placeholder.com/150'}
                      alt={item.name} className="max-w-full max-h-full object-contain mix-blend-multiply" />
                  </Link>

                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/product/${item.id}`}
                        className="text-[14px] sm:text-[16px] text-[#0F1111] hover:text-[#C7511F] hover:underline leading-snug line-clamp-2 transition-colors">
                        {item.name}
                      </Link>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-[15px] sm:text-[17px] font-bold leading-none ${isDisc ? 'text-[#B12704]' : 'text-[#0F1111]'}`}>
                          {lineTot.toLocaleString()}<span className="text-[10px] align-top ml-0.5">FCFA</span>
                        </p>
                        {isDisc && (
                          <p className="text-[11px] text-[#565959] line-through mt-0.5">
                            {(base * qty).toLocaleString()} F
                          </p>
                        )}
                      </div>
                    </div>

                    {(item.selectedSize || item.selectedColor) && (
                      <p className="text-[12px] text-[#565959] mt-0.5">
                        {item.selectedSize && <>Taille : {item.selectedSize}</>}
                        {item.selectedSize && item.selectedColor && ' · '}
                        {item.selectedColor && <>Couleur : {item.selectedColor}</>}
                      </p>
                    )}

                    <p className="text-[12px] mt-0.5">
                      <span className="text-[#007600]">En stock</span>
                      <span className="text-[#565959]"> · <i className="fa-solid fa-bolt text-[#FF9900] text-[9px]"></i> Livraison 2h Douala 🇨🇲</span>
                    </p>

                    <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
                      <div className="inline-flex items-center bg-white border border-[#D5D9D9] rounded-full h-[30px] shadow-[0_2px_5px_rgba(15,17,17,.08)] overflow-hidden">
                        <button onClick={() => updateQty(idx, -1)}
                          className="w-[34px] h-full flex items-center justify-center text-[#007185] hover:bg-[#F7FAFA] transition">
                          {qty === 1
                            ? <i className="fa-solid fa-trash-can text-[12px]"></i>
                            : <span className="text-base leading-none">−</span>}
                        </button>
                        <span className="min-w-[30px] text-center text-[14px] font-bold text-[#0F1111] border-x border-[#E7E7E7]">
                          {qty}
                        </span>
                        <button onClick={() => updateQty(idx, 1)}
                          className="w-[34px] h-full flex items-center justify-center text-[#007185] hover:bg-[#F7FAFA] transition">
                          <span className="text-base leading-none">+</span>
                        </button>
                      </div>

                      <span className="text-[#D5D9D9] text-xs">|</span>
                      <button onClick={() => removeItem(idx)}
                        className="text-[12px] text-[#007185] hover:text-[#C7511F] hover:underline transition">
                        Supprimer
                      </button>
                      <span className="text-[#D5D9D9] text-xs">|</span>
                      <Link to="/studio" state={{ productId: item.id }}
                        className="text-[12px] text-[#007185] hover:text-[#C7511F] hover:underline transition">
                        Personnaliser
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="text-right py-3 text-[17px] text-[#0F1111]">
              Sous-total ({totalQty} article{totalQty > 1 ? 's' : ''}) :{' '}
              <span className="font-bold">{Math.round(finalTotal).toLocaleString()} FCFA</span>
            </div>
          </div>

          {/* ── CARROUSEL ANIMÉ — défilement infini sur X ── */}
          {carousel.length > 0 && (
            <div className="bg-white py-5 overflow-hidden cart-carousel-wrap">
              <h2 className="text-[20px] font-bold text-[#0F1111] mb-4 px-4 md:px-6">
                <i className="fa-solid fa-fire text-[#FF9900] mr-2 text-[16px]"></i>
                Les clients ajoutent aussi
              </h2>
              <div className="cart-carousel-track inline-flex items-stretch gap-3 whitespace-nowrap pl-4">
                {[...carousel, ...carousel].map((p, i) => (
                  <div key={`${p.id}-${i}`}
                    className="w-[170px] flex-shrink-0 flex flex-col bg-white border border-[#E7E7E7] rounded-lg p-3 whitespace-normal hover:shadow-md transition-shadow">
                    <Link to={`/product/${p.id}`}
                      className="w-full h-[130px] flex items-center justify-center bg-[#F7F7F7] rounded-md overflow-hidden mb-2">
                      <img src={p.img || 'https://via.placeholder.com/150'} alt={p.name} loading="lazy"
                        className="max-w-full max-h-full object-contain mix-blend-multiply" />
                    </Link>
                    <Link to={`/product/${p.id}`}
                      className="text-[12px] text-[#0F1111] hover:text-[#C7511F] leading-snug line-clamp-2 min-h-[30px] transition-colors">
                      {p.name}
                    </Link>
                    <p className="text-[14px] font-bold text-[#B12704] mt-1">
                      {Number(p.price || 0).toLocaleString()}<span className="text-[9px] align-top ml-0.5">F</span>
                    </p>
                    <button onClick={() => addSuggestion(p)}
                      className={`mt-auto pt-1.5 w-full rounded-full text-[11px] font-medium py-1 border transition ${
                        addedId === p.id
                          ? 'bg-[#E8F5E8] border-[#007600]/30 text-[#007600]'
                          : 'bg-[#FFD814] hover:bg-[#F7CA00] border-[#FCD200] text-[#0F1111]'
                      }`}>
                      {addedId === p.id ? <><i className="fa-solid fa-check mr-1 text-[10px]"></i>Ajouté</> : 'Ajouter'}
                    </button>
                  </div>
                ))}
              </div>
              <style>{`
                @keyframes cart-scroll-x { from { transform: translateX(0); } to { transform: translateX(-50%); } }
                .cart-carousel-track { animation: cart-scroll-x ${Math.max(30, carousel.length * 4)}s linear infinite; will-change: transform; }
                .cart-carousel-wrap:hover .cart-carousel-track { animation-play-state: paused; }
                .cart-carousel-wrap {
                  -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 3%, black 97%, transparent 100%);
                  mask-image: linear-gradient(90deg, transparent 0%, black 3%, black 97%, transparent 100%);
                }
              `}</style>
            </div>
          )}

          {/* ── SUGGESTIONS — large cards, max 5 per row ── */}
          {suggestions.length > 0 && (
            <div className="bg-white px-4 md:px-6 py-5">
              <h2 className="text-[20px] font-bold text-[#0F1111] mb-4">
                Suggestions pour vous
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
                {suggestions.map(p => (
                  <div key={p.id} className="flex flex-col group">
                    <Link to={`/product/${p.id}`}
                      className="aspect-square w-full bg-[#F7F7F7] rounded-lg flex items-center justify-center overflow-hidden mb-2">
                      <img src={p.img || 'https://via.placeholder.com/300'}
                        alt={p.name} loading="lazy"
                        className="max-w-full max-h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300" />
                    </Link>
                    <Link to={`/product/${p.id}`}
                      className="text-[13px] text-[#0F1111] hover:text-[#C7511F] leading-snug line-clamp-2 min-h-[34px] transition-colors">
                      {p.name}
                    </Link>
                    <p className="text-[16px] font-bold text-[#B12704] mt-1">
                      {Number(p.price || 0).toLocaleString()}<span className="text-[10px] align-top ml-0.5">FCFA</span>
                    </p>
                    <button onClick={() => addSuggestion(p)}
                      className={`mt-2 w-full rounded-full text-[12px] font-medium py-1.5 border transition shadow-[0_2px_5px_rgba(213,217,217,.5)] ${
                        addedId === p.id
                          ? 'bg-[#E8F5E8] border-[#007600]/30 text-[#007600]'
                          : 'bg-[#FFD814] hover:bg-[#F7CA00] border-[#FCD200] text-[#0F1111]'
                      }`}>
                      {addedId === p.id
                        ? <><i className="fa-solid fa-circle-check mr-1.5 text-[11px]"></i>Ajouté !</>
                        : 'Ajouter au panier'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
