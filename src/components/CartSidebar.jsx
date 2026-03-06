import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const MEMBER_DISCOUNT = 0.20;
const BUNDLE_DISCOUNT = 0.15;

const getUnitPrice = (item, isMember) => {
  const base = Number(item.price) || 0;
  const vendorHasPromo =
    item.vendor?.member_discount_enabled ??
    item.vendor_member_discount_enabled ??
    false;
  if (isMember && vendorHasPromo) return Math.round(base * (1 - MEMBER_DISCOUNT));
  return base;
};

const CartSidebar = ({ isOpen, cart, removeFromCart, updateQuantity, toggleCart, clearCart }) => {
  const { user, isMember } = useAuth();

  const [step,           setStep]           = useState('cart');
  const [info,           setInfo]           = useState({ name:'', phone:'', neighborhood:'', street:'', extra:'' });
  const [paymentMethod,  setPaymentMethod]  = useState('');
  const [showToast,      setShowToast]      = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [paymentRefs,    setPaymentRefs]    = useState({});
  const [cartVendors,    setCartVendors]    = useState({});

  const [userProfile,    setUserProfile]    = useState(null);
  const [userAddresses,  setUserAddresses]  = useState([]);
  const [selectedAddrId, setSelectedAddrId] = useState(null);

  useEffect(() => {
    if (!user || !isOpen) return;
    const load = async () => {
      const [{ data: prof }, { data: addrs }] = await Promise.all([
        supabase.from('profiles').select('full_name,phone').eq('id', user.id).single(),
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

  // Adresse complète pour la commande
  const fullAddress = () =>
    [info.neighborhood, info.street, info.extra, 'Douala'].filter(Boolean).join(', ');

  const vendorIds     = [...new Set(cart.map(i => i.vendor_id || 'no_vendor'))].filter(id => id !== 'no_vendor');
  const isMultiVendor = vendorIds.length > 1;

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

  // ─── CALCULS ─────────────────────────────────────────────────────────────────
  const rawTotal            = cart.reduce((s, i) => s + (Number(i.price)||0) * (Number(i.quantity)||1), 0);
  const subtotalAfterMember = cart.reduce((s, i) => s + getUnitPrice(i, isMember) * (Number(i.quantity)||1), 0);
  const memberSavingsAmount = rawTotal - subtotalAfterMember;
  const hasMemberSavings    = memberSavingsAmount > 0;
  const hasBundle           = cart.length >= 2;
  const bundleAmount        = hasBundle ? Math.round(subtotalAfterMember * BUNDLE_DISCOUNT) : 0;
  const finalTotal          = subtotalAfterMember - bundleAmount;

  const potentialMemberSavings = cart.reduce((s, i) => {
    const has = i.vendor?.member_discount_enabled ?? i.vendor_member_discount_enabled ?? false;
    return has ? s + Math.round((Number(i.price)||0) * i.quantity * MEMBER_DISCOUNT) : s;
  }, 0);

  const getVendorAmount = (vId) => {
    const items = cart.filter(i => (i.vendor_id||'no_vendor') === vId);
    const sub   = items.reduce((s, i) => s + getUnitPrice(i, isMember) * i.quantity, 0);
    return hasBundle ? Math.round(sub * (1 - BUNDLE_DISCOUNT)) : sub;
  };

  // ─── PROCESS ─────────────────────────────────────────────────────────────────
  const handleProcess = async () => {
    setError('');
    if (step === 'cart') {
      setStep('checkout');
    } else if (step === 'checkout') {
      if (!info.name || !info.phone || (!info.neighborhood && !info.street)) {
        setError('Veuillez remplir le nom, le téléphone et l\'adresse');
        return;
      }
      setStep('payment');
    } else if (step === 'payment') {
      if (!paymentMethod) { setError('Veuillez choisir un mode de paiement'); return; }
      if (paymentMethod === 'orange_money' || paymentMethod === 'mtn_momo') {
        const ids = [...vendorIds, ...(cart.some(i => !i.vendor_id) ? ['no_vendor'] : [])];
        if (!ids.every(id => (paymentRefs[id]||'').trim())) {
          setError(isMultiVendor ? 'Saisissez l\'ID de transaction pour chaque boutique' : 'Saisissez l\'ID de transaction');
          return;
        }
      }
      await createOrder();
    }
  };

  const createOrder = async () => {
    setLoading(true);
    setError('');
    try {
      const ordersByVendor = cart.reduce((acc, item) => {
        const vId = item.vendor_id || 'no_vendor';
        if (!acc[vId]) acc[vId] = [];
        acc[vId].push(item);
        return acc;
      }, {});

      for (const vId of Object.keys(ordersByVendor)) {
        const vendorItems = ordersByVendor[vId];
        const vendorSub   = vendorItems.reduce((s, i) => s + getUnitPrice(i, isMember) * (Number(i.quantity)||1), 0);
        const vendorFinal = hasBundle ? Math.round(vendorSub * (1 - BUNDLE_DISCOUNT)) : vendorSub;

        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert({
            client_name:             info.name,
            client_phone:            info.phone,
            client_address:          fullAddress(),
            total_amount:            vendorFinal,
            payment_method:          paymentMethod,
            payment_reference:       paymentRefs[vId] || null,
            status:                  'pending',
            vendor_id:               vId === 'no_vendor' ? null : vId,
            member_discount_applied: isMember && hasMemberSavings,
            user_id:                 user?.id || null,
          })
          .select()
          .single();

        if (orderError) throw orderError;

        const itemsToInsert = vendorItems.map(item => ({
          order_id:       orderData.id,
          product_id:     item.id,
          product_name:   item.name,
          product_img:    item.img,
          quantity:       item.quantity,
          unit_price:     getUnitPrice(item, isMember),
          selected_size:  item.selectedSize  || null,
          selected_color: item.selectedColor || null,
        }));

        const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;

        if (vId !== 'no_vendor') {
          try {
            const { data: tokenData } = await supabase.from('fcm_tokens').select('token').eq('vendor_id', vId).maybeSingle();
            if (tokenData?.token) {
              await sendDirectNotification(tokenData.token,
                `🛒 Nouvelle Commande #${orderData.order_number}`,
                `${info.name} — ${vendorFinal.toLocaleString()} FCFA`
              );
            }
          } catch (e) { console.warn('[NOTIF] non-bloquant:', e); }
        }
      }

      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        setStep('cart');
        setInfo({ name:'', phone:'', neighborhood:'', street:'', extra:'' });
        setPaymentMethod('');
        setPaymentRefs({});
        setCartVendors({});
        clearCart();
        toggleCart();
      }, 3000);
    } catch (err) {
      console.error('Erreur commande:', err);
      setError('Une erreur est survenue lors de la validation de votre arsenal.');
    } finally {
      setLoading(false);
    }
  };

  // ─── BLOC TRANSACTION PARTAGÉ (OM + MoMo) ────────────────────────────────────
  const TransactionBlock = ({ method }) => {
    const isOM = method === 'orange_money';
    const accentColor = isOM ? 'text-orange-400' : 'text-yellow-400';
    const borderColor = isOM ? 'border-orange-500/20 bg-orange-500/5' : 'border-yellow-400/20 bg-yellow-400/5';
    const ids = [...vendorIds, ...(cart.some(i => !i.vendor_id) ? ['no_vendor'] : [])];

    return (
      <div className="space-y-3 mt-3">
        {ids.map(vId => {
          const v   = cartVendors[vId];
          const amt = getVendorAmount(vId);
          const txId = paymentRefs[vId] || '';
          return (
            <div key={vId} className={`p-4 rounded-xl border space-y-3 ${borderColor}`}>
              {/* Boutique + montant */}
              <div className="flex items-center justify-between">
                <span className={`font-black text-[10px] uppercase ${accentColor}`}>
                  {v?.shop_name || 'Boutique'}
                </span>
                <span className="font-black text-[11px] text-white">{amt.toLocaleString()} FCFA</span>
              </div>

              {/* Instructions étapes */}
              <div className="space-y-1.5 text-[9px] font-bold">
                {isOM ? (
                  <>
                    <p className="text-zinc-400">
                      <span className={`${accentColor} font-black`}>① </span>
                      Composez <span className="text-white font-black font-mono">#150*50#</span> ou ouvrez l'app <span className="text-white">Orange Money</span>
                    </p>
                    <p className="text-zinc-400">
                      <span className={`${accentColor} font-black`}>② </span>
                      Envoyez <span className="text-white font-black">{amt.toLocaleString()} FCFA</span> au <span className="text-white font-black font-mono">{v?.phone || '...'}</span>
                    </p>
                    <p className="text-zinc-400">
                      <span className={`${accentColor} font-black`}>③ </span>
                      Copiez l'<span className="text-white font-black">ID de transaction</span> dans le SMS de confirmation
                    </p>
                    <p className={`${accentColor} font-mono text-[8px] pl-3`}>Ex : MP241201.1234.A12345</p>
                  </>
                ) : (
                  <>
                    <p className="text-zinc-400">
                      <span className={`${accentColor} font-black`}>① </span>
                      Composez <span className="text-white font-black font-mono">*126#</span> ou ouvrez l'app <span className="text-white">MTN MoMo</span>
                    </p>
                    <p className="text-zinc-400">
                      <span className={`${accentColor} font-black`}>② </span>
                      Envoyez <span className="text-white font-black">{amt.toLocaleString()} FCFA</span> au <span className="text-white font-black font-mono">{v?.phone || '...'}</span>
                    </p>
                    <p className="text-zinc-400">
                      <span className={`${accentColor} font-black`}>③ </span>
                      Copiez l'<span className="text-white font-black">ID de transaction</span> dans le SMS de confirmation
                    </p>
                    <p className={`${accentColor} font-mono text-[8px] pl-3`}>Ex : 2312345678</p>
                  </>
                )}
              </div>

              {/* Saisie ID */}
              <div>
                <label className={`text-[8px] font-black uppercase tracking-widest mb-1.5 block ${accentColor}`}>
                  ID de transaction *
                </label>
                <input
                  type="text"
                  placeholder={isOM ? 'MP241201.1234.A12345' : '2312345678'}
                  value={txId}
                  onChange={e => setPaymentRefs(p => ({ ...p, [vId]: e.target.value }))}
                  className={`w-full bg-black border p-3 text-xs font-black font-mono focus:outline-none rounded-lg text-white tracking-widest transition-colors ${txId.trim() ? (isOM ? 'border-orange-400/50' : 'border-yellow-400/50') : 'border-zinc-700 focus:border-white/30'}`}
                />
                {txId.trim() && (
                  <p className={`text-[8px] font-black mt-1 flex items-center gap-1 ${accentColor}`}>
                    <i className="fa-solid fa-circle-check text-[8px]"></i> ID enregistré
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── FORMULAIRE ADRESSE (réutilisé connecté + invité) ────────────────────────
  const AddressForm = ({ darkBg = false }) => {
    const base = darkBg
      ? 'bg-zinc-900 border border-white/8 rounded-xl p-3 text-xs font-bold focus:border-primary outline-none dark:text-white w-full'
      : 'bg-white/5 border border-zinc-800 p-3 text-xs font-bold focus:border-primary outline-none dark:text-white w-full';
    const labelCls = `text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block`;

    return (
      <div className="space-y-3">
        {/* Nom */}
        <div>
          <label className={labelCls}>Nom complet *</label>
          <input type="text" value={info.name}
            onChange={e => setInfo(p => ({ ...p, name: e.target.value }))}
            placeholder={userProfile?.full_name || 'Ex : Jean xxx'}
            className={base} />
        </div>
        {/* Téléphone livraison */}
        <div>
          <label className={labelCls}>Téléphone (livraison) *</label>
          <input type="tel" value={info.phone}
            onChange={e => setInfo(p => ({ ...p, phone: e.target.value }))}
            placeholder={userProfile?.phone || '+237 6XX XXX XXX'}
            className={base} />
        </div>
        {/* Quartier + Rue côte à côte */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Quartier *</label>
            <input type="text" value={info.neighborhood}
              onChange={e => setInfo(p => ({ ...p, neighborhood: e.target.value }))}
              placeholder="Bonamoussadi..."
              className={base} />
          </div>
          <div>
            <label className={labelCls}>Rue / Avenue</label>
            <input type="text" value={info.street}
              onChange={e => setInfo(p => ({ ...p, street: e.target.value }))}
              placeholder="Rue Njo Njo..."
              className={base} />
          </div>
        </div>
        {/* Repère */}
        <div>
          <label className={labelCls}>Repère / Précisions</label>
          <input type="text" value={info.extra}
            onChange={e => setInfo(p => ({ ...p, extra: e.target.value }))}
            placeholder="Près de l'église, portail noir, bâtiment bleu..."
            className={base} />
        </div>
      </div>
    );
  };

  // ─── RENDU ────────────────────────────────────────────────────────────────────
  return (
    <>
      {showToast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[300] animate-bounce">
          <div className="bg-black border-2 border-primary px-8 py-4 rounded-full shadow-[0_0_30px_rgba(0,255,136,0.4)] backdrop-blur-xl flex items-center space-x-4">
            <div className="bg-primary rounded-full p-1">
              <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-white font-black uppercase text-[10px] tracking-[0.2em]">Commande Elite Validée</p>
          </div>
        </div>
      )}

      <div className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-white dark:bg-zinc-950 z-[250] transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-700 shadow-2xl p-10 flex flex-col`}>

        {/* HEADER */}
        <div className="flex justify-between items-center mb-8 border-b dark:border-zinc-800 pb-6">
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">
              {step === 'cart' ? 'Arsenal' : step === 'checkout' ? 'Livraison' : 'Paiement'}
            </h2>
            {isMember && step === 'cart' && hasMemberSavings && (
              <span className="inline-flex items-center gap-1 text-[7px] font-black uppercase tracking-widest text-primary mt-0.5">
                <span className="w-1 h-1 rounded-full bg-primary inline-block" />Prix membre actifs
              </span>
            )}
          </div>
          <button onClick={() => { setStep('cart'); setError(''); toggleCart(); }}
            className="text-xs font-black uppercase border px-4 py-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >✕</button>
        </div>

        {/* TEASER visiteur */}
        {!user && cart.length > 0 && step === 'cart' && potentialMemberSavings > 0 && (
          <div className="mb-4 border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase text-primary">🏷 Prix membre disponible</p>
              <p className="text-[8px] text-zinc-400 font-bold uppercase mt-0.5">
                Économisez {potentialMemberSavings.toLocaleString()} FCFA avec un compte
              </p>
            </div>
            <Link to="/register" onClick={() => { setStep('cart'); toggleCart(); }}
              className="shrink-0 bg-primary text-black px-3 py-1.5 text-[7px] font-black uppercase tracking-widest hover:bg-white transition whitespace-nowrap"
            >S'inscrire →</Link>
          </div>
        )}

        {/* BANNIÈRE membre */}
        {isMember && cart.length > 0 && step === 'cart' && hasMemberSavings && (
          <div className="mb-4 border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
            <span className="text-primary text-lg">✦</span>
            <div>
              <p className="text-[9px] font-black uppercase text-primary">
                Vous économisez {Math.round(memberSavingsAmount + bundleAmount).toLocaleString()} FCFA
              </p>
              <p className="text-[8px] text-zinc-400 font-bold uppercase mt-0.5">
                Remise membre −20%{hasBundle && ' + bundle −15%'}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
            <p className="text-red-500 text-[9px] font-bold uppercase text-center">{error}</p>
          </div>
        )}

        <div className="flex-grow overflow-y-auto space-y-4 hide-scrollbar">

          {/* ── PANIER ── */}
          {step === 'cart' && (
            cart.length === 0
              ? <p className="text-center pt-20 italic opacity-50 uppercase text-[10px] tracking-widest">Votre arsenal est vide</p>
              : cart.map((item, idx) => {
                  const base      = Number(item.price) || 0;
                  const unitEff   = getUnitPrice(item, isMember);
                  const lineTotal = unitEff * (Number(item.quantity) || 1);
                  const isDisc    = unitEff < base;
                  return (
                    <div key={`${item.id}-${idx}`} className="flex items-center space-x-4 py-4 border-b dark:border-zinc-900">
                      <img src={item.img || 'https://via.placeholder.com/100'} className="w-16 h-16 object-cover rounded-xl bg-zinc-800" alt={item.name} />
                      <div className="flex-grow">
                        <p className="font-black uppercase text-[10px] italic leading-tight mb-1">{item.name || 'Produit Inconnu'}</p>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase">{item.selectedSize || 'Standard'} / {item.selectedColor || 'Original'}</p>
                        <div className="flex items-center space-x-3 mt-2">
                          <button onClick={() => updateQuantity(idx, -1)} className="text-zinc-500 hover:text-primary transition">-</button>
                          <span className="font-black text-[10px] w-4 text-center">{item.quantity || 1}</span>
                          <button onClick={() => updateQuantity(idx, 1)} className="text-zinc-500 hover:text-primary transition">+</button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-[10px] font-black whitespace-nowrap ${isDisc ? 'text-primary' : 'text-zinc-900 dark:text-white'}`}>
                          {lineTotal.toLocaleString()} FCFA
                        </p>
                        {isDisc && <p className="text-[8px] line-through text-zinc-500 whitespace-nowrap">{(base * (Number(item.quantity)||1)).toLocaleString()} F</p>}
                        <button onClick={() => removeFromCart(idx)} className="text-[8px] font-bold uppercase text-red-500 mt-2 hover:underline">Remove</button>
                      </div>
                    </div>
                  );
                })
          )}

          {/* ── CHECKOUT ── */}
          {step === 'checkout' && (
            user ? (
              /* ─── CAS CONNECTÉ ─── */
              <div className="space-y-5">
                {/* Badge identité */}
                <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-black text-sm">
                      {(userProfile?.full_name || user.email || '?')[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-black text-[11px] text-white truncate">
                      {userProfile?.full_name || user.email?.split('@')[0]}
                    </p>
                    <p className="text-[8px] text-zinc-500 font-bold truncate">{user.email}</p>
                  </div>
                  <i className="fa-solid fa-circle-check text-primary text-sm flex-shrink-0"></i>
                </div>

                {/* Sélecteur adresses sauvegardées */}
                {userAddresses.length > 0 && (
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-2.5">Adresse de livraison</p>
                    <div className="space-y-2">
                      {userAddresses.map(a => (
                        <button key={a.id} onClick={() => handleSelectAddr(a.id)}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all ${selectedAddrId === a.id ? 'border-primary bg-primary/5' : 'border-white/8 bg-zinc-900/40 hover:border-white/15'}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-black text-[10px] text-white uppercase">{a.label || 'Adresse'}</span>
                            <div className="flex items-center gap-1.5">
                              {a.is_default && (
                                <span className="text-[6px] font-black uppercase text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">Défaut</span>
                              )}
                              {selectedAddrId === a.id && (
                                <i className="fa-solid fa-circle-check text-primary text-xs"></i>
                              )}
                            </div>
                          </div>
                          <p className="text-[9px] text-zinc-400 font-bold">
                            {[a.street, a.neighborhood, a.city].filter(Boolean).join(', ')}
                          </p>
                          <p className="text-[8px] text-zinc-600 font-bold mt-0.5">{a.phone}</p>
                        </button>
                      ))}
                      <button onClick={() => handleSelectAddr(null)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all ${selectedAddrId === null ? 'border-primary bg-primary/5' : 'border-white/8 bg-zinc-900/40 hover:border-white/15'}`}
                      >
                        <div className="flex items-center gap-2">
                          <i className="fa-solid fa-plus text-primary text-xs"></i>
                          <span className="font-black text-[10px] text-zinc-400 uppercase">Saisir une nouvelle adresse</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Formulaire nouvelle adresse ou aucune adresse */}
                {(selectedAddrId === null || userAddresses.length === 0) && (
                  <>
                    {userAddresses.length === 0 && (
                      <p className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">Aucune adresse enregistrée</p>
                    )}
                    <AddressForm darkBg />
                  </>
                )}

                {/* Récap adresse sélectionnée */}
                {selectedAddrId !== null && userAddresses.length > 0 && (
                  <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-4 space-y-1">
                    <p className="text-[7px] font-black uppercase text-zinc-600 tracking-widest mb-2">Livraison vers</p>
                    <p className="font-black text-[11px] text-white">{info.name}</p>
                    <p className="text-[10px] text-zinc-400 font-bold">{info.phone}</p>
                    <p className="text-[10px] text-zinc-400 font-bold">{fullAddress()}</p>
                  </div>
                )}

                <Link to="/profile?tab=addresses" onClick={toggleCart}
                  className="flex items-center justify-center gap-2 border border-white/8 text-zinc-500 hover:text-primary hover:border-primary/30 rounded-xl py-2.5 text-[8px] font-black uppercase tracking-widest transition"
                >
                  <i className="fa-solid fa-location-dot text-xs"></i>
                  Gérer mes adresses →
                </Link>
              </div>

            ) : (
              /* ─── CAS NON CONNECTÉ ─── */
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 bg-zinc-900/40 border border-white/8 rounded-xl p-3.5">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase text-zinc-300">Déjà un compte ?</p>
                    <p className="text-[8px] text-zinc-500 font-bold mt-0.5">Checkout rapide avec vos adresses sauvegardées</p>
                  </div>
                  <Link to="/login" state={{ from: '/' }} onClick={toggleCart}
                    className="shrink-0 border border-primary/40 text-primary px-3 py-1.5 text-[7px] font-black uppercase tracking-widest hover:bg-primary/10 transition rounded-lg whitespace-nowrap"
                  >Connexion</Link>
                </div>
                <AddressForm darkBg={false} />
              </div>
            )
          )}

          {/* ── PAIEMENT ── */}
          {step === 'payment' && (
            <div className="space-y-4">

              {/* ORANGE MONEY */}
              <div>
                <button onClick={() => setPaymentMethod('orange_money')}
                  className={`w-full border p-5 flex items-center justify-between transition group text-left rounded-xl ${paymentMethod === 'orange_money' ? 'border-orange-400 bg-orange-500/5' : 'border-zinc-800 hover:border-orange-400/50'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${paymentMethod === 'orange_money' ? 'bg-orange-500/20' : 'bg-zinc-800'}`}>
                      <i className="fa-solid fa-mobile-screen-button text-orange-400 text-sm"></i>
                    </div>
                    <span className={`font-black text-xs uppercase italic ${paymentMethod === 'orange_money' ? 'text-orange-400' : 'text-zinc-300 group-hover:text-orange-400'}`}>
                      Orange Money
                    </span>
                  </div>
                  {paymentMethod === 'orange_money'
                    ? <i className="fa-solid fa-circle-check text-orange-400"></i>
                    : <i className="fa-solid fa-chevron-down text-zinc-600 text-xs"></i>
                  }
                </button>
                {paymentMethod === 'orange_money' && <TransactionBlock method="orange_money" />}
              </div>

              {/* MTN MOMO */}
              <div>
                <button onClick={() => setPaymentMethod('mtn_momo')}
                  className={`w-full border p-5 flex items-center justify-between transition group text-left rounded-xl ${paymentMethod === 'mtn_momo' ? 'border-yellow-400 bg-yellow-400/5' : 'border-zinc-800 hover:border-yellow-400/50'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${paymentMethod === 'mtn_momo' ? 'bg-yellow-400/20' : 'bg-zinc-800'}`}>
                      <i className="fa-solid fa-mobile-screen-button text-yellow-400 text-sm"></i>
                    </div>
                    <span className={`font-black text-xs uppercase italic ${paymentMethod === 'mtn_momo' ? 'text-yellow-400' : 'text-zinc-300 group-hover:text-yellow-400'}`}>
                      MTN MoMo
                    </span>
                  </div>
                  {paymentMethod === 'mtn_momo'
                    ? <i className="fa-solid fa-circle-check text-yellow-400"></i>
                    : <i className="fa-solid fa-chevron-down text-zinc-600 text-xs"></i>
                  }
                </button>
                {paymentMethod === 'mtn_momo' && <TransactionBlock method="mtn_momo" />}
              </div>

              {/* CASH ON DELIVERY */}
              <div>
                <button onClick={() => setPaymentMethod('cash_on_delivery')}
                  className={`w-full border p-5 flex items-center justify-between transition group text-left rounded-xl ${paymentMethod === 'cash_on_delivery' ? 'border-primary bg-primary/5' : 'border-zinc-800 hover:border-primary'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${paymentMethod === 'cash_on_delivery' ? 'bg-primary/20' : 'bg-zinc-800'}`}>
                      <i className="fa-solid fa-truck-fast text-primary text-sm"></i>
                    </div>
                    <span className={`font-black text-xs uppercase italic ${paymentMethod === 'cash_on_delivery' ? 'text-primary' : 'text-zinc-300 group-hover:text-primary'}`}>
                      Payer à la livraison
                    </span>
                  </div>
                  {paymentMethod === 'cash_on_delivery' && <i className="fa-solid fa-circle-check text-primary"></i>}
                </button>
              </div>

            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="pt-6 border-t dark:border-zinc-800 mt-6">
          {cart.length > 0 && (
            <>
              <div className="space-y-1.5 mb-4">
                {hasMemberSavings && <>
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">Sous-total</span>
                    <span className="text-[9px] font-black line-through text-zinc-500">{rawTotal.toLocaleString()} FCFA</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black uppercase text-primary tracking-widest">Remise membre −20%</span>
                    <span className="text-[9px] font-black text-primary">−{memberSavingsAmount.toLocaleString()} FCFA</span>
                  </div>
                </>}
                {hasBundle && (
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black uppercase text-primary tracking-widest">Bundle −15%</span>
                    <span className="text-[9px] font-black text-primary">−{bundleAmount.toLocaleString()} FCFA</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-end mb-5">
                <span className="font-black text-[10px] uppercase text-zinc-500 tracking-widest">Elite Total</span>
                <span className="text-3xl font-black italic tracking-tighter">{Math.round(finalTotal).toLocaleString()} FCFA</span>
              </div>

              <div className="flex gap-1 mb-4">
                {['cart','checkout','payment'].map((s, i) => (
                  <div key={s} className={`h-1 flex-grow rounded-full transition-colors ${['cart','checkout','payment'].indexOf(step) >= i ? 'bg-primary' : 'bg-zinc-800'}`} />
                ))}
              </div>

              <button onClick={handleProcess} disabled={loading}
                className="w-full bg-primary text-black font-black py-5 uppercase tracking-[0.2em] text-[10px] shadow-[0_10px_30px_rgba(0,255,136,0.2)] hover:scale-105 transition rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading
                  ? <><i className="fa-solid fa-spinner fa-spin"></i> Traitement...</>
                  : step === 'cart'      ? 'Passer à la livraison'
                  : step === 'checkout' ? 'Choisir le paiement'
                  :                       'Confirmer la commande'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default CartSidebar;