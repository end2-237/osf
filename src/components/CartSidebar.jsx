import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const MEMBER_DISCOUNT            = 0.20;
const BUNDLE_DISCOUNT_NON_MEMBER = 0.02;
const BUNDLE_DISCOUNT_MEMBER     = 0.05;

const getUnitPrice = (item, isMember) => {
  const base = Number(item.price) || 0;
  const vendorHasPromo =
    item.vendor?.member_discount_enabled ??
    item.vendor_member_discount_enabled ??
    false;
  if (isMember && vendorHasPromo) return Math.round(base * (1 - MEMBER_DISCOUNT));
  return base;
};

// ─── STEP BREADCRUMB ─────────────────────────────────────────────────────────
const STEPS = [
  { key: 'cart',     label: 'Panier',    icon: 'fa-bag-shopping' },
  { key: 'checkout', label: 'Livraison', icon: 'fa-truck-fast'   },
  { key: 'payment',  label: 'Paiement',  icon: 'fa-mobile-screen-button' },
];

const StepBar = ({ step }) => {
  const idx = STEPS.findIndex(s => s.key === step);
  return (
    <div className="bg-[#232F3E] px-5 py-2.5 flex items-center gap-2 flex-shrink-0">
      {STEPS.map((s, i) => {
        const active = i === idx;
        const done   = i < idx;
        return (
          <React.Fragment key={s.key}>
            <div className={`flex items-center gap-1.5 ${active ? 'text-[#FF9900]' : done ? 'text-[#adb5bd]' : 'text-[#37475A]'}`}>
              {done
                ? <i className="fa-solid fa-circle-check text-[#FF9900] text-xs"></i>
                : <i className={`fa-solid ${s.icon} text-[10px]`}></i>}
              <span className="text-[11px] font-bold">{s.label}</span>
            </div>
            {i < 2 && <i className="fa-solid fa-chevron-right text-[#37475A] text-[8px]"></i>}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const CartSidebar = ({ isOpen, cart, removeFromCart, updateQuantity, toggleCart, clearCart }) => {
  const { user, isMember } = useAuth();

  const [step,           setStep]           = useState('cart');
  const [info,           setInfo]           = useState({ name:'', phone:'', neighborhood:'', street:'', extra:'' });
  const [paymentMethod,  setPaymentMethod]  = useState('');
  const [showToast,      setShowToast]      = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [cartVendors,    setCartVendors]    = useState({});
  const [userProfile,    setUserProfile]    = useState(null);
  const [userAddresses,  setUserAddresses]  = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState(null);

  // Monetbil
  const [monetbilPhone,   setMonetbilPhone]   = useState('');
  const [paymentPhase,    setPaymentPhase]    = useState('select'); // 'select' | 'awaiting' | 'failed'
  const [pendingOrderIds, setPendingOrderIds] = useState([]);
  const [pollError,       setPollError]       = useState('');
  const pollTimerRef = useRef(null);

  useEffect(() => {
    if (!user || !isOpen) return;
    const load = async () => {
      const [{ data: prof }, { data: addrs }] = await Promise.all([
        supabase.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle(),
        supabase.from('user_addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }),
      ]);
      if (prof) setUserProfile(prof);
      if (addrs?.length) {
        setUserAddresses(addrs);
        const def = addrs.find(a => a.is_default) || addrs[0];
        setSelectedAddrId(def.id);
        setInfo({
          name:         def.full_name    || prof?.full_name || '',
          phone:        def.phone        || prof?.phone    || '',
          neighborhood: def.neighborhood || '',
          street:       def.street       || '',
          extra:        def.extra        || '',
        });
      } else if (prof) {
        setSelectedAddrId(null);
        setInfo({ name: prof.full_name || '', phone: prof.phone || '', neighborhood:'', street:'', extra:'' });
      }
    };
    load();
  }, [user, isOpen]);

  const handleSelectAddr = (addrId) => {
    setSelectedAddrId(addrId);
    if (addrId === null) {
      setInfo({ name: userProfile?.full_name || '', phone: userProfile?.phone || '', neighborhood:'', street:'', extra:'' });
    } else {
      const a = userAddresses.find(x => x.id === addrId);
      if (a) setInfo({
        name:         a.full_name    || userProfile?.full_name || '',
        phone:        a.phone        || userProfile?.phone    || '',
        neighborhood: a.neighborhood || '',
        street:       a.street       || '',
        extra:        a.extra        || '',
      });
    }
  };

  const fullAddress = () =>
    [info.neighborhood, info.street, info.extra, 'Douala 🇨🇲'].filter(Boolean).join(', ');

  const vendorIds     = [...new Set(cart.map(i => i.vendor_id || 'no_vendor'))].filter(id => id !== 'no_vendor');

  useEffect(() => {
    if (step !== 'payment' || vendorIds.length === 0) return;
    supabase.from('vendors').select('id, phone, shop_name').in('id', vendorIds)
      .then(({ data }) => {
        if (data) {
          const map = {};
          data.forEach(v => { map[v.id] = v; });
          setCartVendors(map);
        }
      });
  }, [step]);

  // Pre-fill Monetbil phone from checkout info
  useEffect(() => {
    if (step === 'payment' && !monetbilPhone && info.phone) {
      setMonetbilPhone(info.phone);
    }
  }, [step]);

  // ─── POLLING ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (paymentPhase !== 'awaiting' || pendingOrderIds.length === 0) return;

    const started   = Date.now();
    const TIMEOUT   = 3 * 60 * 1000;

    const check = async () => {
      if (Date.now() - started > TIMEOUT) {
        clearInterval(pollTimerRef.current);
        setPaymentPhase('failed');
        setPollError('Délai dépassé (3 min). Vérifiez votre téléphone et réessayez.');
        return;
      }
      try {
        const { data } = await supabase
          .from('orders')
          .select('id, status')
          .in('id', pendingOrderIds);

        const allPaid   = data?.length > 0 && data.every(o => o.status === 'paid');
        const anyFailed = data?.some(o => o.status === 'payment_failed');

        if (allPaid) {
          clearInterval(pollTimerRef.current);
          setShowToast(true);
          setTimeout(() => {
            setShowToast(false);
            setStep('cart');
            setInfo({ name:'', phone:'', neighborhood:'', street:'', extra:'' });
            setPaymentMethod('');
            setMonetbilPhone('');
            setPaymentPhase('select');
            setPendingOrderIds([]);
            clearCart();
            toggleCart();
          }, 3500);
        } else if (anyFailed) {
          clearInterval(pollTimerRef.current);
          setPaymentPhase('failed');
          setPollError('Paiement refusé ou annulé. Vérifiez votre solde et réessayez.');
        }
      } catch { /* network glitch — keep polling */ }
    };

    pollTimerRef.current = setInterval(check, 5000);
    return () => clearInterval(pollTimerRef.current);
  }, [paymentPhase, pendingOrderIds]);

  // ─── CALCULS ─────────────────────────────────────────────────────────────────
  const rawTotal            = cart.reduce((s, i) => s + (Number(i.price)||0) * (Number(i.quantity)||1), 0);
  const subtotalAfterMember = cart.reduce((s, i) => s + getUnitPrice(i, isMember) * (Number(i.quantity)||1), 0);
  const memberSavingsAmount = rawTotal - subtotalAfterMember;
  const hasMemberSavings    = memberSavingsAmount > 0;
  const hasBundle           = cart.length >= 2;
  const bundleRate          = isMember ? BUNDLE_DISCOUNT_MEMBER : BUNDLE_DISCOUNT_NON_MEMBER;
  const bundleAmount        = hasBundle ? Math.round(subtotalAfterMember * bundleRate) : 0;
  const finalTotal          = subtotalAfterMember - bundleAmount;

  const potentialMemberSavings = cart.reduce((s, i) => {
    const has = i.vendor?.member_discount_enabled ?? i.vendor_member_discount_enabled ?? false;
    return has ? s + Math.round((Number(i.price)||0) * i.quantity * MEMBER_DISCOUNT) : s;
  }, 0);

  const getVendorAmount = (vId) => {
    const items = cart.filter(i => (i.vendor_id||'no_vendor') === vId);
    const sub   = items.reduce((s, i) => s + getUnitPrice(i, isMember) * i.quantity, 0);
    return hasBundle ? Math.round(sub * (1 - bundleRate)) : sub;
  };

  const formatPhoneForMonetbil = (phone) => {
    let p = phone.replace(/[\s\-\.\(\)]/g, '');
    if (p.startsWith('+')) p = p.slice(1);
    if (/^6\d{8}$/.test(p)) p = '237' + p;
    return p;
  };

  // ─── ORDER HELPERS ────────────────────────────────────────────────────────────
  const buildOrderItems = (vendorItems, orderId) =>
    vendorItems.map(item => ({
      order_id:             orderId,
      product_id:           item.id,
      product_name:         item.name,
      product_img:          item.img,
      quantity:             item.quantity,
      unit_price:           getUnitPrice(item, isMember),
      selected_size:        item.selectedSize       || null,
      selected_color:       item.selectedColor      || null,
      selected_variant_id:  item.selectedVariantId  || null,
      selected_variant_sku: item.selectedVariantSku || null,
      cj_product_id:        item.cj_product_id      || null,
      delivery_city:        item.deliveryCity        || null,
    }));

  const groupByVendor = () =>
    cart.reduce((acc, item) => {
      const vId = item.vendor_id || 'no_vendor';
      if (!acc[vId]) acc[vId] = [];
      acc[vId].push(item);
      return acc;
    }, {});

  // Cash-on-delivery order creation
  const createOrder = async () => {
    setLoading(true); setError('');
    try {
      for (const [vId, vendorItems] of Object.entries(groupByVendor())) {
        const vendorSub   = vendorItems.reduce((s, i) => s + getUnitPrice(i, isMember) * (Number(i.quantity)||1), 0);
        const vendorFinal = hasBundle ? Math.round(vendorSub * (1 - bundleRate)) : vendorSub;

        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert({
            client_name:             info.name,
            client_phone:            info.phone,
            client_address:          fullAddress(),
            total_amount:            vendorFinal,
            payment_method:          paymentMethod,
            payment_reference:       null,
            status:                  'pending',
            vendor_id:               vId === 'no_vendor' ? null : vId,
            member_discount_applied: isMember && hasMemberSavings,
            user_id:                 user?.id || null,
          })
          .select()
          .single();

        if (orderError) throw orderError;
        await supabase.from('order_items').insert(buildOrderItems(vendorItems, orderData.id));
      }

      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        setStep('cart');
        setInfo({ name:'', phone:'', neighborhood:'', street:'', extra:'' });
        setPaymentMethod('');
        clearCart();
        toggleCart();
      }, 3500);
    } catch {
      setError('Une erreur est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  // Monetbil USSD push order creation
  const createOrdersForMonetbil = async () => {
    setLoading(true); setError('');
    try {
      const orderIds = [];

      for (const [vId, vendorItems] of Object.entries(groupByVendor())) {
        const vendorSub   = vendorItems.reduce((s, i) => s + getUnitPrice(i, isMember) * (Number(i.quantity)||1), 0);
        const vendorFinal = hasBundle ? Math.round(vendorSub * (1 - bundleRate)) : vendorSub;

        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert({
            client_name:             info.name,
            client_phone:            info.phone,
            client_address:          fullAddress(),
            total_amount:            vendorFinal,
            payment_method:          paymentMethod,
            payment_reference:       null,
            status:                  'pending_payment',
            vendor_id:               vId === 'no_vendor' ? null : vId,
            member_discount_applied: isMember && hasMemberSavings,
            user_id:                 user?.id || null,
          })
          .select()
          .single();

        if (orderError) throw orderError;
        orderIds.push(orderData.id);
        await supabase.from('order_items').insert(buildOrderItems(vendorItems, orderData.id));
      }

      const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/monetbil-init`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${supabaseAnon}`,
          'apikey':        supabaseAnon,
        },
        body: JSON.stringify({
          order_ids: orderIds,
          amount:    Math.round(finalTotal),
          phone:     formatPhoneForMonetbil(monetbilPhone),
          operator:  paymentMethod === 'orange_money' ? 'ORANGE_CM' : 'MTN_CM',
        }),
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Erreur Monetbil');

      setPendingOrderIds(orderIds);
      setPaymentPhase('awaiting');
    } catch (err) {
      setError(err.message || 'Une erreur est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  // ─── NAVIGATION ──────────────────────────────────────────────────────────────
  const handleProcess = async () => {
    setError('');
    if (step === 'cart') {
      setStep('checkout');
    } else if (step === 'checkout') {
      if (!info.name || !info.phone || (!info.neighborhood && !info.street)) {
        setError("Veuillez remplir le nom, le téléphone et l'adresse");
        return;
      }
      setStep('payment');
    } else if (step === 'payment') {
      if (!paymentMethod) { setError('Veuillez choisir un mode de paiement'); return; }
      if (paymentMethod === 'orange_money' || paymentMethod === 'mtn_momo') {
        if (!monetbilPhone.trim()) {
          setError('Saisissez votre numéro de téléphone Mobile Money');
          return;
        }
        await createOrdersForMonetbil();
      } else {
        await createOrder();
      }
    }
  };

  const close = () => {
    if (paymentPhase === 'awaiting') return;
    clearInterval(pollTimerRef.current);
    setStep('cart');
    setError('');
    setPaymentPhase('select');
    setPollError('');
    setPendingOrderIds([]);
    toggleCart();
  };

  const inputCls = 'w-full bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded px-3 py-2.5 text-sm text-[#0F1111] placeholder-[#adb5bd] transition-colors';

  const isOM          = paymentMethod === 'orange_money';
  const isMTN         = paymentMethod === 'mtn_momo';
  const isMobileMoney = isOM || isMTN;
  const isAwaiting    = paymentPhase === 'awaiting';

  // ─── RENDU ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* BACKDROP */}
      {isOpen && (
        <div
          className={`fixed inset-0 bg-black/50 z-[240] transition-opacity ${isAwaiting ? 'cursor-not-allowed' : ''}`}
          onClick={close}
        />
      )}

      {/* SUCCESS TOAST */}
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-3 bg-[#007600] text-white px-6 py-4 rounded shadow-2xl min-w-[300px]">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-circle-check text-white text-lg"></i>
          </div>
          <div>
            <p className="font-bold text-sm">Commande confirmée ! 🎉</p>
            <p className="text-xs text-green-200 mt-0.5">Livraison à Douala 🇨🇲 · Suivi par SMS</p>
          </div>
        </div>
      )}

      {/* PANEL */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[480px] z-[250] flex flex-col shadow-2xl transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* ── HEADER ── */}
        <div className="bg-[#131921] px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#FF9900] rounded flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-bag-shopping text-[#0F1111] text-sm"></i>
            </div>
            <div>
              <h2 className="font-bold text-white text-sm leading-none">
                {step === 'cart' ? 'Mon Panier' : step === 'checkout' ? 'Livraison' : 'Paiement'}
              </h2>
              <p className="text-[10px] text-[#adb5bd] mt-0.5">
                {step === 'cart'
                  ? `${cart.length} article${cart.length !== 1 ? 's' : ''} · OneFreestyle 🇨🇲`
                  : step === 'checkout' ? 'Où livrer votre commande ?'
                  : 'Comment souhaitez-vous payer ?'}
              </p>
            </div>
          </div>
          <button onClick={close} disabled={isAwaiting}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition flex-shrink-0 disabled:opacity-40">
            <i className="fa-solid fa-xmark text-white text-sm"></i>
          </button>
        </div>

        {/* ── STEP BAR ── */}
        <StepBar step={step} />

        {/* ── ERROR BANNER ── */}
        {error && (
          <div className="bg-red-50 border-b border-red-100 px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
            <i className="fa-solid fa-circle-exclamation text-red-400 text-sm flex-shrink-0"></i>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* ── MAIN SCROLLABLE AREA ── */}
        <div className="flex-grow overflow-y-auto bg-[#EAEDED]">

          {/* ════ STEP CART ════ */}
          {step === 'cart' && (
            <>
              {cart.length > 0 && (hasBundle || (isMember && hasMemberSavings) || (!user && potentialMemberSavings > 0)) && (
                <div className="bg-white border-b border-[#D5D9D9] divide-y divide-[#D5D9D9]">
                  {hasBundle && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-[#FFF8D3]">
                      <i className="fa-solid fa-tag text-[#FF9900] text-base flex-shrink-0"></i>
                      <div>
                        <p className="text-sm font-bold text-[#0F1111]">Bundle Deal −{isMember ? 5 : 2}% ✓</p>
                        <p className="text-xs text-[#565959]">−{bundleAmount.toLocaleString()} FCFA sur votre panier</p>
                      </div>
                    </div>
                  )}
                  {isMember && hasMemberSavings && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-[#FFF8D3]">
                      <i className="fa-solid fa-crown text-[#FF9900] text-base flex-shrink-0"></i>
                      <div>
                        <p className="text-sm font-bold text-[#0F1111]">Remise Membre Elite −20% ✓</p>
                        <p className="text-xs text-[#565959]">−{memberSavingsAmount.toLocaleString()} FCFA économisés</p>
                      </div>
                    </div>
                  )}
                  {!user && potentialMemberSavings > 0 && (
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="text-sm font-bold text-[#0F1111]">🏷 Prix membre disponible</p>
                        <p className="text-xs text-[#565959]">Économisez {potentialMemberSavings.toLocaleString()} FCFA avec un compte</p>
                      </div>
                      <Link to="/register" onClick={close}
                        className="shrink-0 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] px-3 py-1.5 text-xs font-bold rounded transition">
                        S'inscrire
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {cart.length === 0 ? (
                <div className="bg-white flex flex-col items-center justify-center py-20 px-6 text-center min-h-[50vh]">
                  <div className="w-24 h-24 bg-[#EAEDED] rounded-full flex items-center justify-center mb-5">
                    <i className="fa-solid fa-bag-shopping text-[#adb5bd] text-4xl"></i>
                  </div>
                  <h3 className="font-bold text-xl text-[#0F1111] mb-2">Votre panier est vide</h3>
                  <p className="text-[#565959] text-sm mb-2">Découvrez nos meilleures offres 🇨🇲</p>
                  <p className="text-[#565959] text-xs mb-6">Livraison express à Douala · Paiement Mobile Money</p>
                  <Link to="/store" onClick={close}
                    className="bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] px-8 py-3 rounded font-bold text-sm transition">
                    <i className="fa-solid fa-bag-shopping mr-2 text-xs"></i>Explorer le store
                  </Link>
                </div>
              ) : (
                <div className="bg-white divide-y divide-[#F3F4F4]">
                  {cart.map((item, idx) => {
                    const base      = Number(item.price) || 0;
                    const unitEff   = getUnitPrice(item, isMember);
                    const lineTotal = unitEff * (Number(item.quantity) || 1);
                    const isDisc    = unitEff < base;
                    return (
                      <div key={`${item.id}-${idx}`} className="p-4 flex gap-3">
                        <div className="w-[88px] h-[88px] flex-shrink-0 bg-white border border-[#D5D9D9] rounded overflow-hidden">
                          <img
                            src={item.img || 'https://via.placeholder.com/100'}
                            className="w-full h-full object-contain p-1.5"
                            alt={item.name}
                          />
                        </div>
                        <div className="flex-grow min-w-0 flex flex-col gap-1">
                          <p className="text-sm text-[#0F1111] leading-snug line-clamp-2">{item.name || 'Produit'}</p>
                          {(item.selectedSize || item.selectedColor) && (
                            <p className="text-xs text-[#565959]">
                              {item.selectedSize && `Taille: ${item.selectedSize}`}
                              {item.selectedSize && item.selectedColor && ' · '}
                              {item.selectedColor && `Couleur: ${item.selectedColor}`}
                            </p>
                          )}
                          <p className="text-[10px] text-[#007600] font-bold flex items-center gap-1">
                            <i className="fa-solid fa-bolt text-[#FF9900]"></i>
                            Livraison 2h · Douala 🇨🇲
                          </p>
                          <div className="flex items-baseline gap-2">
                            <span className={`font-bold text-base leading-none ${isDisc ? 'text-[#B12704]' : 'text-[#0F1111]'}`}>
                              {lineTotal.toLocaleString()} FCFA
                            </span>
                            {isDisc && (
                              <span className="text-xs text-[#565959] line-through">
                                {(base * (Number(item.quantity)||1)).toLocaleString()} F
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex items-center border border-[#D5D9D9] rounded overflow-hidden">
                              <button onClick={() => updateQuantity(idx, -1)}
                                className="w-8 h-8 text-[#565959] hover:bg-[#F3F4F4] hover:text-[#FF9900] transition font-bold flex items-center justify-center text-base leading-none">
                                −
                              </button>
                              <span className="w-9 text-center text-sm font-bold text-[#0F1111] border-x border-[#D5D9D9] py-1">
                                {item.quantity || 1}
                              </span>
                              <button onClick={() => updateQuantity(idx, 1)}
                                className="w-8 h-8 text-[#565959] hover:bg-[#F3F4F4] hover:text-[#FF9900] transition font-bold flex items-center justify-center text-base leading-none">
                                +
                              </button>
                            </div>
                            <span className="text-[#D5D9D9] text-xs">|</span>
                            <button onClick={() => removeFromCart(idx)}
                              className="text-xs text-[#007185] hover:text-[#C45500] hover:underline transition">
                              Retirer
                            </button>
                            <span className="text-[#D5D9D9] text-xs">|</span>
                            <Link to="/studio" state={{ productId: item.id }} onClick={close}
                              className="text-xs text-[#007185] hover:text-[#C45500] hover:underline transition">
                              <i className="fa-solid fa-wand-magic-sparkles text-[9px] mr-1"></i>Perso
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {cart.length > 0 && (
                <div className="bg-white border-t border-[#D5D9D9] px-4 py-3 flex items-center justify-between mt-2">
                  <Link to="/store" onClick={close} className="text-sm text-[#007185] hover:text-[#C45500] hover:underline flex items-center gap-1.5">
                    <i className="fa-solid fa-arrow-left text-xs"></i> Continuer mes achats
                  </Link>
                  <button onClick={() => { if (window.confirm('Vider le panier ?')) clearCart(); }}
                    className="text-xs text-[#565959] hover:text-red-500 transition">
                    Vider le panier
                  </button>
                </div>
              )}
            </>
          )}

          {/* ════ STEP CHECKOUT ════ */}
          {step === 'checkout' && (
            <div className="bg-white p-4 space-y-5">
              {user && (
                <div className="flex items-center gap-3 bg-[#F3F4F4] border border-[#D5D9D9] rounded p-3">
                  <div className="w-10 h-10 rounded-full bg-[#FF9900]/10 border border-[#FF9900]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#FF9900] font-bold text-sm">
                      {(userProfile?.full_name || user.email || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-bold text-sm text-[#0F1111] truncate">
                      {userProfile?.full_name || user.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-[#565959] truncate">{user.email}</p>
                  </div>
                  <i className="fa-solid fa-circle-check text-[#007600] text-base flex-shrink-0"></i>
                </div>
              )}

              {user && userAddresses.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-2">
                    <i className="fa-solid fa-location-dot text-[#FF9900] mr-1.5"></i>Adresse de livraison
                  </p>
                  <div className="space-y-2">
                    {userAddresses.map(a => (
                      <button key={a.id} onClick={() => handleSelectAddr(a.id)}
                        className={`w-full text-left p-3 rounded border-2 transition-all ${selectedAddrId === a.id ? 'border-[#FF9900] bg-[#FFF8D3]' : 'border-[#D5D9D9] bg-white hover:border-[#FF9900]'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-[#0F1111]">{a.label || 'Adresse'}</span>
                          <div className="flex items-center gap-1.5">
                            {a.is_default && (
                              <span className="text-[9px] font-bold uppercase text-[#FF9900] bg-[#FF9900]/10 border border-[#FF9900]/20 px-1.5 py-0.5 rounded">
                                Défaut
                              </span>
                            )}
                            {selectedAddrId === a.id && <i className="fa-solid fa-circle-check text-[#FF9900] text-sm"></i>}
                          </div>
                        </div>
                        <p className="text-xs text-[#565959]">{[a.street, a.neighborhood, a.city].filter(Boolean).join(', ')}</p>
                        <p className="text-xs text-[#565959] mt-0.5">{a.phone}</p>
                      </button>
                    ))}
                    <button onClick={() => handleSelectAddr(null)}
                      className={`w-full text-left p-3 rounded border-2 transition-all ${selectedAddrId === null ? 'border-[#FF9900] bg-[#FFF8D3]' : 'border-dashed border-[#D5D9D9] bg-white hover:border-[#FF9900]'}`}>
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-plus text-[#FF9900] text-sm"></i>
                        <span className="text-sm font-bold text-[#565959]">Nouvelle adresse</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {!user && (
                <div className="flex items-center justify-between gap-3 bg-[#F3F4F4] border border-[#D5D9D9] rounded p-3">
                  <div>
                    <p className="text-sm font-bold text-[#0F1111]">Déjà un compte ?</p>
                    <p className="text-xs text-[#565959] mt-0.5">Checkout rapide avec vos adresses</p>
                  </div>
                  <Link to="/login" state={{ from: '/' }} onClick={close}
                    className="shrink-0 border-2 border-[#FF9900] text-[#FF9900] hover:bg-[#FF9900] hover:text-[#0F1111] px-3 py-1.5 text-xs font-bold rounded transition whitespace-nowrap">
                    Se connecter
                  </Link>
                </div>
              )}

              {(selectedAddrId === null || !user || userAddresses.length === 0) && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#565959]">
                    <i className="fa-solid fa-pen text-[#FF9900] mr-1.5"></i>Infos de livraison
                  </p>
                  {[
                    { key: 'name',  label: 'Nom complet *',           ph: 'Ex: Jean Mbarga',  icon: 'fa-user'  },
                    { key: 'phone', label: 'Téléphone (livraison) *', ph: '+237 6XX XXX XXX', icon: 'fa-phone' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-1.5">{f.label}</label>
                      <div className="relative">
                        <i className={`fa-solid ${f.icon} absolute left-3 top-1/2 -translate-y-1/2 text-[#adb5bd] text-sm`}></i>
                        <input type={f.key === 'phone' ? 'tel' : 'text'} value={info[f.key]}
                          onChange={e => setInfo(p => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={f.ph} className={`${inputCls} pl-9`} />
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'neighborhood', label: 'Quartier *',   ph: 'Bonamoussadi' },
                      { key: 'street',       label: 'Rue / Avenue', ph: 'Rue Njo Njo'  },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-1.5">{f.label}</label>
                        <input type="text" value={info[f.key]}
                          onChange={e => setInfo(p => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={f.ph} className={inputCls} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-1.5">Repère / Précisions</label>
                    <input type="text" value={info.extra}
                      onChange={e => setInfo(p => ({ ...p, extra: e.target.value }))}
                      placeholder="Près de l'église, portail noir, bâtiment bleu..."
                      className={inputCls} />
                  </div>
                </div>
              )}

              {user && selectedAddrId !== null && userAddresses.length > 0 && (
                <div className="bg-[#F3F4F4] border border-[#D5D9D9] rounded p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-2">
                    <i className="fa-solid fa-location-dot text-[#FF9900] mr-1.5"></i>Livraison vers
                  </p>
                  <p className="font-bold text-sm text-[#0F1111]">{info.name}</p>
                  <p className="text-xs text-[#565959] mt-0.5">{info.phone}</p>
                  <p className="text-xs text-[#565959] mt-0.5">{fullAddress()}</p>
                </div>
              )}

              {user && (
                <Link to="/profile?tab=addresses" onClick={close}
                  className="flex items-center justify-center gap-2 border border-[#D5D9D9] hover:border-[#FF9900] rounded py-2.5 text-sm text-[#007185] hover:text-[#C45500] transition">
                  <i className="fa-solid fa-location-dot text-xs"></i>
                  Gérer mes adresses →
                </Link>
              )}
            </div>
          )}

          {/* ════ STEP PAYMENT ════ */}
          {step === 'payment' && (
            <div className="p-4 space-y-3">

              {/* ── AWAITING SCREEN ── */}
              {paymentPhase === 'awaiting' && (
                <div className="bg-white rounded border border-[#D5D9D9] overflow-hidden">
                  <div className="p-6 text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isOM ? 'bg-orange-100' : 'bg-yellow-100'}`}>
                      <i className={`fa-solid fa-mobile-screen-button text-2xl animate-pulse ${isOM ? 'text-orange-500' : 'text-yellow-600'}`}></i>
                    </div>
                    <p className="font-bold text-[#0F1111] text-base mb-1">Confirmation en cours…</p>
                    <p className="text-sm text-[#565959] mb-1">Un push USSD a été envoyé au</p>
                    <p className={`font-mono font-bold text-sm mb-3 ${isOM ? 'text-orange-600' : 'text-yellow-700'}`}>
                      {monetbilPhone}
                    </p>
                    <p className="text-xs text-[#565959] mb-4">
                      Validez le paiement de{' '}
                      <strong className="text-[#0F1111]">{Math.round(finalTotal).toLocaleString()} FCFA</strong>{' '}
                      sur votre application <strong>{isOM ? 'Orange Money' : 'MTN MoMo'}</strong>.
                    </p>
                    <div className="flex items-center justify-center gap-2 text-xs text-[#adb5bd]">
                      <i className="fa-solid fa-spinner fa-spin text-[#FF9900]"></i>
                      En attente de validation…
                    </div>
                  </div>
                  <div className={`px-4 py-3 border-t text-xs ${isOM ? 'bg-orange-50 border-orange-100 text-orange-700' : 'bg-yellow-50 border-yellow-100 text-yellow-700'}`}>
                    <i className="fa-solid fa-circle-info mr-1.5"></i>
                    Ne fermez pas cette fenêtre. La page se met à jour automatiquement.
                  </div>
                </div>
              )}

              {/* ── FAILED SCREEN ── */}
              {paymentPhase === 'failed' && (
                <div className="bg-white rounded border border-red-200 overflow-hidden">
                  <div className="p-5 text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <i className="fa-solid fa-circle-xmark text-red-400 text-xl"></i>
                    </div>
                    <p className="font-bold text-[#0F1111] text-sm mb-1">Paiement non confirmé</p>
                    <p className="text-xs text-[#565959] mb-4">{pollError}</p>
                    <button
                      onClick={() => { setPaymentPhase('select'); setPollError(''); setPendingOrderIds([]); setError(''); }}
                      className="bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] px-5 py-2 rounded font-bold text-sm transition">
                      Réessayer
                    </button>
                  </div>
                </div>
              )}

              {/* ── SELECT SCREEN ── */}
              {paymentPhase === 'select' && (
                <>
                  {/* ORANGE MONEY */}
                  <div className="bg-white rounded border border-[#D5D9D9] overflow-hidden">
                    <button onClick={() => { setPaymentMethod('orange_money'); setError(''); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 transition ${isOM ? 'bg-orange-50' : 'hover:bg-[#F3F4F4]'}`}>
                      <div className={`w-10 h-10 rounded flex items-center justify-center flex-shrink-0 ${isOM ? 'bg-orange-100' : 'bg-[#F3F4F4]'}`}>
                        <i className="fa-solid fa-mobile-screen-button text-orange-500 text-lg"></i>
                      </div>
                      <div className="flex-grow text-left">
                        <p className={`font-bold text-sm ${isOM ? 'text-orange-600' : 'text-[#0F1111]'}`}>Orange Money</p>
                        <p className="text-xs text-[#565959]">Push USSD automatique · Confirmation instantanée</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isOM ? 'border-orange-500 bg-orange-500' : 'border-[#D5D9D9]'}`}>
                        {isOM && <i className="fa-solid fa-check text-white text-[8px]"></i>}
                      </div>
                    </button>
                    {isOM && (
                      <div className="border-t border-orange-100 px-4 pb-4 pt-3 bg-orange-50/30">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-orange-600 mb-1.5">
                          Numéro Orange Money *
                        </label>
                        <div className="relative">
                          <i className="fa-solid fa-phone absolute left-3 top-1/2 -translate-y-1/2 text-orange-400 text-sm"></i>
                          <input
                            type="tel"
                            value={monetbilPhone}
                            onChange={e => setMonetbilPhone(e.target.value)}
                            placeholder="+237 6 9X XX XX XX"
                            className="w-full bg-white border border-orange-200 focus:border-orange-400 focus:outline-none rounded pl-9 pr-3 py-2.5 text-sm font-mono text-[#0F1111] placeholder-[#adb5bd] transition-colors"
                          />
                        </div>
                        <p className="text-[10px] text-orange-500 mt-1.5">
                          <i className="fa-solid fa-circle-info mr-1"></i>
                          Un push USSD sera envoyé sur ce numéro pour valider le paiement.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* MTN MOMO */}
                  <div className="bg-white rounded border border-[#D5D9D9] overflow-hidden">
                    <button onClick={() => { setPaymentMethod('mtn_momo'); setError(''); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 transition ${isMTN ? 'bg-yellow-50' : 'hover:bg-[#F3F4F4]'}`}>
                      <div className={`w-10 h-10 rounded flex items-center justify-center flex-shrink-0 ${isMTN ? 'bg-yellow-100' : 'bg-[#F3F4F4]'}`}>
                        <i className="fa-solid fa-mobile-screen-button text-yellow-600 text-lg"></i>
                      </div>
                      <div className="flex-grow text-left">
                        <p className={`font-bold text-sm ${isMTN ? 'text-yellow-700' : 'text-[#0F1111]'}`}>MTN MoMo</p>
                        <p className="text-xs text-[#565959]">Push USSD automatique · Confirmation instantanée</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isMTN ? 'border-yellow-500 bg-yellow-500' : 'border-[#D5D9D9]'}`}>
                        {isMTN && <i className="fa-solid fa-check text-white text-[8px]"></i>}
                      </div>
                    </button>
                    {isMTN && (
                      <div className="border-t border-yellow-100 px-4 pb-4 pt-3 bg-yellow-50/30">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-yellow-700 mb-1.5">
                          Numéro MTN MoMo *
                        </label>
                        <div className="relative">
                          <i className="fa-solid fa-phone absolute left-3 top-1/2 -translate-y-1/2 text-yellow-500 text-sm"></i>
                          <input
                            type="tel"
                            value={monetbilPhone}
                            onChange={e => setMonetbilPhone(e.target.value)}
                            placeholder="+237 6 7X XX XX XX"
                            className="w-full bg-white border border-yellow-200 focus:border-yellow-400 focus:outline-none rounded pl-9 pr-3 py-2.5 text-sm font-mono text-[#0F1111] placeholder-[#adb5bd] transition-colors"
                          />
                        </div>
                        <p className="text-[10px] text-yellow-600 mt-1.5">
                          <i className="fa-solid fa-circle-info mr-1"></i>
                          Un push USSD sera envoyé sur ce numéro pour valider le paiement.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* CASH ON DELIVERY */}
                  <div className="bg-white rounded border border-[#D5D9D9] overflow-hidden">
                    <button onClick={() => { setPaymentMethod('cash_on_delivery'); setError(''); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 transition ${paymentMethod === 'cash_on_delivery' ? 'bg-green-50' : 'hover:bg-[#F3F4F4]'}`}>
                      <div className={`w-10 h-10 rounded flex items-center justify-center flex-shrink-0 ${paymentMethod === 'cash_on_delivery' ? 'bg-green-100' : 'bg-[#F3F4F4]'}`}>
                        <i className="fa-solid fa-truck-fast text-[#007600] text-lg"></i>
                      </div>
                      <div className="flex-grow text-left">
                        <p className={`font-bold text-sm ${paymentMethod === 'cash_on_delivery' ? 'text-[#007600]' : 'text-[#0F1111]'}`}>
                          Payer à la livraison
                        </p>
                        <p className="text-xs text-[#565959]">Cash · Espèces à la réception · Douala 2h</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${paymentMethod === 'cash_on_delivery' ? 'border-[#007600] bg-[#007600]' : 'border-[#D5D9D9]'}`}>
                        {paymentMethod === 'cash_on_delivery' && <i className="fa-solid fa-check text-white text-[8px]"></i>}
                      </div>
                    </button>
                    {paymentMethod === 'cash_on_delivery' && (
                      <div className="border-t border-green-100 px-4 py-3 bg-green-50">
                        <p className="text-xs text-[#007600] font-bold flex items-center gap-2">
                          <i className="fa-solid fa-circle-info"></i>
                          Préparez le montant exact à la livraison. Notre livreur contactera le{' '}
                          <strong>{info.phone || '...'}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* RECAP LIVRAISON (toujours visible sauf pendant awaiting) */}
              {!isAwaiting && (
                <div className="bg-white rounded border border-[#D5D9D9] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-3">
                    <i className="fa-solid fa-location-dot text-[#FF9900] mr-1.5"></i>Livraison vers
                  </p>
                  <p className="font-bold text-sm text-[#0F1111]">{info.name}</p>
                  <p className="text-xs text-[#565959] mt-0.5">{info.phone}</p>
                  <p className="text-xs text-[#565959] mt-0.5">{fullAddress()}</p>
                  <button onClick={() => setStep('checkout')}
                    className="text-xs text-[#007185] hover:text-[#C45500] hover:underline mt-2 block">
                    Modifier l'adresse →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── STICKY FOOTER ── */}
        <div className="bg-white border-t border-[#D5D9D9] p-4 flex-shrink-0">
          {cart.length > 0 && (
            <div className="space-y-3">
              {/* PRICE BREAKDOWN */}
              {step === 'cart' && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#565959]">Sous-total ({cart.reduce((s, i) => s + (i.quantity || 1), 0)} art.)</span>
                    <span className="font-bold text-[#0F1111]">{rawTotal.toLocaleString()} FCFA</span>
                  </div>
                  {hasMemberSavings && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#007600]">Remise membre −20%</span>
                      <span className="font-bold text-[#007600]">−{memberSavingsAmount.toLocaleString()} F</span>
                    </div>
                  )}
                  {hasBundle && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#007600]">Bundle Deal −{isMember ? 5 : 2}%</span>
                      <span className="font-bold text-[#007600]">−{bundleAmount.toLocaleString()} F</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-[#565959]">Livraison · Douala 🇨🇲</span>
                    <span className="font-bold text-[#007600]">Gratuite</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-[#D5D9D9]">
                    <span className="font-bold text-[#0F1111]">Total de la commande :</span>
                    <div className="text-right">
                      <span className="text-xl font-bold text-[#0F1111]">{Math.round(finalTotal).toLocaleString()}</span>
                      <span className="text-sm text-[#565959] ml-1">FCFA</span>
                    </div>
                  </div>
                  {(hasMemberSavings || hasBundle) && (
                    <p className="text-xs text-[#007600] font-bold text-right">
                      Vous économisez {(memberSavingsAmount + bundleAmount).toLocaleString()} FCFA 🎉
                    </p>
                  )}
                </div>
              )}

              {/* CTA BUTTON */}
              {isAwaiting ? (
                <button disabled
                  className="w-full bg-[#F3F4F4] text-[#565959] border border-[#D5D9D9] py-3.5 rounded font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed">
                  <i className="fa-solid fa-spinner fa-spin text-xs text-[#FF9900]"></i>
                  En attente de paiement…
                </button>
              ) : (
                <button onClick={handleProcess} disabled={loading || (step === 'cart' && cart.length === 0)}
                  className="w-full bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] py-3.5 rounded font-bold text-sm transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm">
                  {loading
                    ? <><i className="fa-solid fa-spinner fa-spin text-xs"></i> Traitement...</>
                    : step === 'cart'
                      ? <><i className="fa-solid fa-truck-fast text-xs"></i> Passer à la livraison</>
                    : step === 'checkout'
                      ? <><i className="fa-solid fa-mobile-screen-button text-xs"></i> Choisir le paiement</>
                    : isMobileMoney
                      ? <><i className="fa-solid fa-bolt text-xs"></i> Payer {Math.round(finalTotal).toLocaleString()} FCFA maintenant</>
                      : <><i className="fa-solid fa-circle-check text-xs"></i> Confirmer la commande</>}
                </button>
              )}

              {/* TRUST BADGES */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <span className="flex items-center gap-1 text-[10px] text-[#565959]">
                  <i className="fa-solid fa-shield-check text-[#007600] text-xs"></i> Sécurisé
                </span>
                <span className="flex items-center gap-1 text-[10px] text-[#565959]">
                  <i className="fa-solid fa-rotate-left text-[#007185] text-xs"></i> Retour 7j
                </span>
                <span className="flex items-center gap-1 text-[10px] text-[#565959]">
                  <i className="fa-solid fa-bolt text-[#FF9900] text-xs"></i> Livraison 2h
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CartSidebar;
