import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const MEMBER_DISCOUNT = 0.20;
const BUNDLE_DISCOUNT = 0.15;

// ─── Prix unitaire effectif ────────────────────────────────────────────────────
// −25% seulement si : membre connecté ET vendeur de cet article a activé la promo
const getUnitPrice = (item, isMember) => {
  const base = Number(item.price) || 0;
  const vendorHasPromo =
    item.vendor?.member_discount_enabled ??
    item.vendor_member_discount_enabled ??
    false;
  if (isMember && vendorHasPromo) {
    return Math.round(base * (1 - MEMBER_DISCOUNT));
  }
  return base;
};

const CartSidebar = ({ isOpen, cart, removeFromCart, updateQuantity, toggleCart, clearCart }) => {
  const { user, isMember } = useAuth();

  const [step, setStep] = useState('cart');
  const [info, setInfo] = useState({ name: '', phone: '', address: '' });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ─── CALCUL DES TOTAUX ────────────────────────────────────────────────────────
  // Total brut sans aucune remise
  const rawTotal = cart.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0
  );

  // Total après remise membre (item par item, selon flag vendeur)
  const subtotalAfterMember = cart.reduce(
    (sum, item) => sum + getUnitPrice(item, isMember) * (Number(item.quantity) || 1), 0
  );

  const memberSavingsAmount = rawTotal - subtotalAfterMember;
  const hasMemberSavings    = memberSavingsAmount > 0;

  // Bundle −15% si 2+ articles, appliqué après la remise membre
  const hasBundle      = cart.length >= 2;
  const bundleAmount   = hasBundle ? Math.round(subtotalAfterMember * BUNDLE_DISCOUNT) : 0;
  const finalTotal     = subtotalAfterMember - bundleAmount;

  // Économies potentielles pour les visiteurs (sur les articles dont le vendeur a la promo)
  const potentialMemberSavings = cart.reduce((sum, item) => {
    const vendorHasPromo =
      item.vendor?.member_discount_enabled ??
      item.vendor_member_discount_enabled ??
      false;
    if (vendorHasPromo) {
      return sum + Math.round((Number(item.price) || 0) * item.quantity * MEMBER_DISCOUNT);
    }
    return sum;
  }, 0);

  // ─── HANDLERS ────────────────────────────────────────────────────────────────
  const handleProcess = async () => {
    setError('');
    if (step === 'cart') {
      setStep('checkout');
    } else if (step === 'checkout') {
      if (!info.name || !info.phone || !info.address) {
        setError('Veuillez remplir tous les champs');
        return;
      }
      setStep('payment');
    } else if (step === 'payment') {
      if (!paymentMethod) {
        setError('Veuillez choisir un mode de paiement');
        return;
      }
      if (paymentMethod === 'orange_money' && !paymentReference) {
        setError('Veuillez saisir la référence de transaction Orange Money');
        return;
      }
      await createOrder();
    }
  };

  const createOrder = async () => {
    setLoading(true);
    setError('');

    try {
      // Regrouper par vendor_id
      const ordersByVendor = cart.reduce((acc, item) => {
        const vId = item.vendor_id || 'no_vendor';
        if (!acc[vId]) acc[vId] = [];
        acc[vId].push(item);
        return acc;
      }, {});

      for (const vId of Object.keys(ordersByVendor)) {
        const vendorItems = ordersByVendor[vId];

        // Total de ce vendeur après remise membre
        const vendorSubtotal = vendorItems.reduce(
          (sum, item) => sum + getUnitPrice(item, isMember) * (Number(item.quantity) || 1), 0
        );
        // Bundle proportionnel si panier global >= 2 articles
        const vendorFinal = hasBundle
          ? Math.round(vendorSubtotal * (1 - BUNDLE_DISCOUNT))
          : vendorSubtotal;

        // Création de la commande
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert({
            client_name: info.name,
            client_phone: info.phone,
            client_address: info.address,
            total_amount: vendorFinal,
            payment_method: paymentMethod,
            payment_reference: paymentReference || null,
            status: 'pending',
            vendor_id: vId === 'no_vendor' ? null : vId,
            member_discount_applied: isMember && hasMemberSavings,
          })
          .select()
          .single();

        if (orderError) throw orderError;

        // Insertion des articles avec prix effectifs
        const itemsToInsert = vendorItems.map((item) => ({
          order_id: orderData.id,
          product_id: item.id,
          product_name: item.name,
          product_img: item.img,
          quantity: item.quantity,
          unit_price: getUnitPrice(item, isMember), // ✅ prix effectif par item
          selected_size: item.selectedSize || null,
          selected_color: item.selectedColor || null,
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        // Notification FCM vendeur
        if (vId !== 'no_vendor') {
          try {
            const { data: tokenData } = await supabase
              .from('fcm_tokens')
              .select('token')
              .eq('vendor_id', vId)
              .maybeSingle();

            if (tokenData?.token) {
              await sendDirectNotification(
                tokenData.token,
                `🛒 Nouvelle Commande #${orderData.order_number}`,
                `${info.name} — ${vendorFinal.toLocaleString()} FCFA`
              );
            }
          } catch (notifErr) {
            console.warn('[NOTIF] Échec (non-bloquant):', notifErr);
          }
        }
      }

      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        setStep('cart');
        setInfo({ name: '', phone: '', address: '' });
        setPaymentMethod('');
        setPaymentReference('');
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

  return (
    <>
      {/* TOAST SUCCÈS */}
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
        <div className="flex justify-between items-center mb-10 border-b dark:border-zinc-800 pb-6">
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">
              {step === 'cart' ? 'Arsenal' : step === 'checkout' ? 'Elite Info' : 'Paiement'}
            </h2>
            {isMember && step === 'cart' && hasMemberSavings && (
              <span className="inline-flex items-center gap-1 text-[7px] font-black uppercase tracking-widest text-primary mt-0.5">
                <span className="w-1 h-1 rounded-full bg-primary inline-block"></span>
                Prix membre actifs
              </span>
            )}
          </div>
          <button
            onClick={() => { setStep('cart'); setError(''); toggleCart(); }}
            className="text-xs font-black uppercase border px-4 py-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            X
          </button>
        </div>

        {/* TEASER VISITEUR — uniquement si des articles ont la promo vendeur */}
        {!user && cart.length > 0 && step === 'cart' && potentialMemberSavings > 0 && (
          <div className="mb-4 border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase text-primary">🏷 Prix membre disponible</p>
              <p className="text-[8px] text-zinc-400 font-bold uppercase mt-0.5">
                Économisez {potentialMemberSavings.toLocaleString()} FCFA avec un compte
              </p>
            </div>
            <Link
              to="/register"
              onClick={() => { setStep('cart'); toggleCart(); }}
              className="shrink-0 bg-primary text-black px-3 py-1.5 text-[7px] font-black uppercase tracking-widest hover:bg-white transition whitespace-nowrap"
            >
              S'inscrire →
            </Link>
          </div>
        )}

        {/* BANNIÈRE ÉCONOMIES MEMBRE */}
        {isMember && cart.length > 0 && step === 'cart' && hasMemberSavings && (
          <div className="mb-4 border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
            <span className="text-primary text-lg">✦</span>
            <div>
              <p className="text-[9px] font-black uppercase text-primary">
                Vous économisez {Math.round(memberSavingsAmount + bundleAmount).toLocaleString()} FCFA
              </p>
              <p className="text-[8px] text-zinc-400 font-bold uppercase mt-0.5">
                Remise membre −25%{hasBundle && ' + bundle −15%'}
              </p>
            </div>
          </div>
        )}

        {/* ERREUR */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
            <p className="text-red-500 text-[9px] font-bold uppercase text-center">{error}</p>
          </div>
        )}

        {/* CONTENU PRINCIPAL */}
        <div className="flex-grow overflow-y-auto space-y-6 hide-scrollbar">

          {/* ── ÉTAPE PANIER ── */}
          {step === 'cart' && (
            cart.length === 0 ? (
              <p className="text-center pt-20 italic opacity-50 uppercase text-[10px] tracking-widest">Votre arsenal est vide</p>
            ) : (
              cart.map((item, idx) => {
                const base         = Number(item.price) || 0;
                const unitEff      = getUnitPrice(item, isMember);
                const lineTotal    = unitEff * (Number(item.quantity) || 1);
                const isDiscounted = unitEff < base;

                return (
                  <div key={`${item.id}-${idx}`} className="flex items-center space-x-4 py-4 border-b dark:border-zinc-900">
                    <img
                      src={item.img || 'https://via.placeholder.com/100'}
                      className="w-16 h-16 object-cover rounded-xl bg-zinc-800"
                      alt={item.name}
                    />
                    <div className="flex-grow">
                      <p className="font-black uppercase text-[10px] italic leading-tight mb-1">{item.name || 'Produit Inconnu'}</p>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase">
                        {item.selectedSize || 'Standard'} / {item.selectedColor || 'Original'}
                      </p>
                      <div className="flex items-center space-x-3 mt-2">
                        <button onClick={() => updateQuantity(idx, -1)} className="text-zinc-500 hover:text-primary transition">-</button>
                        <span className="font-black text-[10px] w-4 text-center">{item.quantity || 1}</span>
                        <button onClick={() => updateQuantity(idx, 1)} className="text-zinc-500 hover:text-primary transition">+</button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-[10px] font-black whitespace-nowrap ${isDiscounted ? 'text-primary' : 'text-zinc-900 dark:text-white'}`}>
                        {lineTotal.toLocaleString()} FCFA
                      </p>
                      {isDiscounted && (
                        <p className="text-[8px] line-through text-zinc-500 whitespace-nowrap">
                          {(base * (Number(item.quantity) || 1)).toLocaleString()} F
                        </p>
                      )}
                      <button onClick={() => removeFromCart(idx)} className="text-[8px] font-bold uppercase text-red-500 mt-2 hover:underline transition">
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })
            )
          )}

          {/* ── ÉTAPE INFOS ── */}
          {step === 'checkout' && (
            <div className="space-y-6">
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 mb-2 block">Nom Complet *</label>
                <input type="text" required value={info.name}
                  onChange={(e) => setInfo({ ...info, name: e.target.value })}
                  className="w-full bg-white/5 border border-zinc-800 p-4 text-xs font-bold focus:border-primary outline-none dark:text-white"
                  placeholder="Ex: David Nsoga" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 mb-2 block">Numéro Mobile (OM/MTN) *</label>
                <input type="tel" required value={info.phone}
                  onChange={(e) => setInfo({ ...info, phone: e.target.value })}
                  className="w-full bg-white/5 border border-zinc-800 p-4 text-xs font-bold focus:border-primary outline-none dark:text-white"
                  placeholder="+237 6..." />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 mb-2 block">Adresse de Livraison (Douala) *</label>
                <textarea required value={info.address}
                  onChange={(e) => setInfo({ ...info, address: e.target.value })}
                  className="w-full bg-white/5 border border-zinc-800 p-4 text-xs font-bold focus:border-primary outline-none h-24 dark:text-white"
                  placeholder="Quartier, Rue, Porte..." />
              </div>
            </div>
          )}

          {/* ── ÉTAPE PAIEMENT ── */}
          {step === 'payment' && (
            <div className="space-y-4">
              <button onClick={() => setPaymentMethod('orange_money')}
                className={`w-full border p-6 flex items-center justify-between transition group text-left rounded-xl ${paymentMethod === 'orange_money' ? 'border-primary bg-primary/5' : 'border-zinc-800 hover:border-primary'}`}>
                <span className={`font-black text-xs uppercase italic ${paymentMethod === 'orange_money' ? 'text-primary' : 'group-hover:text-primary'}`}>
                  Orange Money
                </span>
                <i className="fa-solid fa-mobile-screen-button text-2xl text-orange-500"></i>
              </button>

              {paymentMethod === 'orange_money' && (
                <div className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 space-y-4">
                  <p className="text-[9px] font-bold text-zinc-400 uppercase">
                    1. Composez #150*50# <br />
                    2. Montant : <span className="text-primary font-black">{Math.round(finalTotal).toLocaleString()} FCFA</span><br />
                    3. Envoyez au : <span className="text-primary font-black">+237 6XX XXX XXX</span><br />
                    4. Copiez la référence ci-dessous
                  </p>
                  <input type="text" placeholder="Ex: OM-123456789" value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full bg-black border border-zinc-700 p-4 text-xs font-bold focus:border-primary outline-none rounded-lg dark:text-white" />
                </div>
              )}

              <button onClick={() => setPaymentMethod('cash_on_delivery')}
                className={`w-full border p-6 flex items-center justify-between transition group text-left rounded-xl ${paymentMethod === 'cash_on_delivery' ? 'border-primary bg-primary/5' : 'border-zinc-800 hover:border-primary'}`}>
                <span className={`font-black text-xs uppercase italic ${paymentMethod === 'cash_on_delivery' ? 'text-primary' : 'group-hover:text-primary'}`}>
                  Payer à la livraison
                </span>
                <i className="fa-solid fa-truck-fast text-2xl text-primary"></i>
              </button>
            </div>
          )}
        </div>

        {/* FOOTER TOTAUX + BOUTON */}
        <div className="pt-8 border-t dark:border-zinc-800 mt-6">
          {cart.length > 0 && (
            <>
              <div className="space-y-1.5 mb-4">
                {/* Sous-total barré si remise membre */}
                {hasMemberSavings && (
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">Sous-total</span>
                    <span className="text-[9px] font-black line-through text-zinc-500">{rawTotal.toLocaleString()} FCFA</span>
                  </div>
                )}
                {/* Ligne remise membre */}
                {hasMemberSavings && (
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black uppercase text-primary tracking-widest">Remise membre −25%</span>
                    <span className="text-[9px] font-black text-primary">−{memberSavingsAmount.toLocaleString()} FCFA</span>
                  </div>
                )}
                {/* Ligne bundle */}
                {hasBundle && (
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black uppercase text-primary tracking-widest">Bundle −15%</span>
                    <span className="text-[9px] font-black text-primary">−{bundleAmount.toLocaleString()} FCFA</span>
                  </div>
                )}
              </div>

              {/* TOTAL FINAL */}
              <div className="flex justify-between items-end mb-6">
                <span className="font-black text-[10px] uppercase text-zinc-500 tracking-widest">
                  Elite Total
                </span>
                <span className="text-3xl font-black italic tracking-tighter">
                  {Math.round(finalTotal).toLocaleString()} FCFA
                </span>
              </div>

              <button
                onClick={handleProcess}
                disabled={loading}
                className="w-full bg-primary text-black font-black py-6 uppercase tracking-[0.2em] text-[10px] shadow-[0_10px_30px_rgba(0,255,136,0.2)] hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? 'Traitement...'
                  : step === 'cart'
                  ? 'Proceed to Checkout'
                  : step === 'checkout'
                  ? 'Choisir le paiement'
                  : 'Confirmer la commande'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default CartSidebar;