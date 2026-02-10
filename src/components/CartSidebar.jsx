import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const CartSidebar = ({ isOpen, cart, removeFromCart, updateQuantity, toggleCart, clearCart, vendor }) => {
  const [step, setStep] = useState('cart');
  const [info, setInfo] = useState({ name: '', phone: '', address: '' });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const total = cart.reduce((sum, item) => {
    const price = Number(item.price) || 0;
    const qty = Number(item.quantity) || 1;
    return sum + price * qty;
  }, 0);

  const discountedTotal = cart.length >= 2 ? total * 0.85 : total;

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
      // ✅ vendor_id ajouté — sans lui les commandes sont invisibles dans le Dashboard
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          client_name: info.name,
          client_phone: info.phone,
          client_address: info.address,
          total_amount: Math.round(discountedTotal),
          payment_method: paymentMethod,
          payment_reference: paymentReference || null,
          status: 'pending',
          vendor_id: vendor?.id || null, // ✅ AJOUTÉ
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cart.map((item) => ({
        order_id: orderData.id,
        product_id: item.id,
        product_name: item.name,
        product_img: item.img,
        quantity: item.quantity,
        unit_price: item.price,
        selected_size: item.selectedSize || null,
        selected_color: item.selectedColor || null,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      setShowToast(true);

      setTimeout(() => {
        setShowToast(false);
        setStep('cart');
        setInfo({ name: '', phone: '', address: '' });
        setPaymentMethod('');
        setPaymentReference('');
        clearCart(); // ✅ APPELÉ maintenant
        toggleCart();
      }, 3000);
    } catch (err) {
      console.error('Error creating order:', err);
      setError('Erreur lors de la création de la commande. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Toast de Confirmation */}
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
        <div className="flex justify-between items-center mb-10 border-b dark:border-zinc-800 pb-6">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter">
            {step === 'cart' ? 'Arsenal' : step === 'checkout' ? 'Elite Info' : 'Paiement'}
          </h2>
          <button
            onClick={() => { setStep('cart'); setError(''); toggleCart(); }}
            className="text-xs font-black uppercase border px-4 py-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            X
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
            <p className="text-red-500 text-[9px] font-bold uppercase text-center">{error}</p>
          </div>
        )}

        <div className="flex-grow overflow-y-auto space-y-6 hide-scrollbar">
          {step === 'cart' && (
            cart.length === 0 ? (
              <p className="text-center pt-20 italic opacity-50 uppercase text-[10px] tracking-widest">Votre arsenal est vide</p>
            ) : (
              cart.map((item, idx) => (
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
                    <p className="text-primary text-[10px] font-black whitespace-nowrap">
                      {((Number(item.price) || 0) * (Number(item.quantity) || 1)).toLocaleString()} FCFA
                    </p>
                    <button onClick={() => removeFromCart(idx)} className="text-[8px] font-bold uppercase text-red-500 mt-2 hover:underline transition">
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )
          )}

          {step === 'checkout' && (
            <div className="space-y-6">
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 mb-2 block">Nom Complet *</label>
                <input
                  type="text"
                  required
                  value={info.name}
                  onChange={(e) => setInfo({ ...info, name: e.target.value })}
                  className="w-full bg-white/5 border border-zinc-800 p-4 text-xs font-bold focus:border-primary outline-none dark:text-white"
                  placeholder="Ex: David Nsoga"
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 mb-2 block">Numéro Mobile (OM/MTN) *</label>
                <input
                  type="tel"
                  required
                  value={info.phone}
                  onChange={(e) => setInfo({ ...info, phone: e.target.value })}
                  className="w-full bg-white/5 border border-zinc-800 p-4 text-xs font-bold focus:border-primary outline-none dark:text-white"
                  placeholder="+237 6..."
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 mb-2 block">Adresse de Livraison (Douala) *</label>
                <textarea
                  required
                  value={info.address}
                  onChange={(e) => setInfo({ ...info, address: e.target.value })}
                  className="w-full bg-white/5 border border-zinc-800 p-4 text-xs font-bold focus:border-primary outline-none h-24 dark:text-white"
                  placeholder="Quartier, Rue, Porte..."
                ></textarea>
              </div>
            </div>
          )}

          {step === 'payment' && (
            <div className="space-y-4">
              <button
                onClick={() => setPaymentMethod('orange_money')}
                className={`w-full border p-6 flex items-center justify-between transition group text-left rounded-xl ${paymentMethod === 'orange_money' ? 'border-primary bg-primary/5' : 'border-zinc-800 hover:border-primary'}`}
              >
                <span className={`font-black text-xs uppercase italic ${paymentMethod === 'orange_money' ? 'text-primary' : 'group-hover:text-primary'}`}>
                  Orange Money
                </span>
                <i className="fa-solid fa-mobile-screen-button text-2xl text-orange-500"></i>
              </button>

              {paymentMethod === 'orange_money' && (
                <div className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 space-y-4">
                  <p className="text-[9px] font-bold text-zinc-400 uppercase">
                    1. Composez #150*50# <br />
                    2. Entrez le montant: <span className="text-primary font-black">{Math.round(discountedTotal)} FCFA</span><br />
                    3. Envoyez au: <span className="text-primary font-black">+237 6XX XXX XXX</span><br />
                    4. Copiez la référence de transaction ci-dessous
                  </p>
                  <input
                    type="text"
                    placeholder="Ex: OM-123456789"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full bg-black border border-zinc-700 p-4 text-xs font-bold focus:border-primary outline-none rounded-lg dark:text-white"
                  />
                </div>
              )}

              <button
                onClick={() => setPaymentMethod('cash_on_delivery')}
                className={`w-full border p-6 flex items-center justify-between transition group text-left rounded-xl ${paymentMethod === 'cash_on_delivery' ? 'border-primary bg-primary/5' : 'border-zinc-800 hover:border-primary'}`}
              >
                <span className={`font-black text-xs uppercase italic ${paymentMethod === 'cash_on_delivery' ? 'text-primary' : 'group-hover:text-primary'}`}>
                  Payer à la livraison
                </span>
                <i className="fa-solid fa-truck-fast text-2xl text-primary"></i>
              </button>
            </div>
          )}
        </div>

        <div className="pt-8 border-t dark:border-zinc-800 mt-6">
          {cart.length > 0 && (
            <>
              <div className="flex justify-between items-end mb-6">
                <span className="font-black text-[10px] uppercase text-zinc-500 tracking-widest">
                  Elite Total {cart.length >= 2 && '(-15%)'}
                </span>
                <span className="text-3xl font-black italic tracking-tighter">
                  {Math.round(discountedTotal).toLocaleString()} FCFA
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