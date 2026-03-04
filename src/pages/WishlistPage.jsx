import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../hooks/useWishlist';

/* ─── CONSTANTS ─── */
const SORT_OPTIONS = [
  { value: 'recent',     label: 'Ajoutés récemment',  icon: 'fa-clock' },
  { value: 'price-asc',  label: 'Prix croissant',      icon: 'fa-arrow-up' },
  { value: 'price-desc', label: 'Prix décroissant',    icon: 'fa-arrow-down' },
  { value: 'name',       label: 'Alphabétique',        icon: 'fa-font' },
];

const MEMBER_DISCOUNT = 0.20;

/* ─── SKELETON ─── */
const SkeletonCard = () => (
  <div className="animate-pulse bg-white border border-zinc-100 rounded-3xl overflow-hidden">
    <div className="aspect-[3/4] bg-zinc-100 relative">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
    </div>
    <div className="p-4 space-y-2">
      <div className="h-2 bg-zinc-100 rounded w-1/3" />
      <div className="h-3 bg-zinc-100 rounded w-4/5" />
      <div className="h-4 bg-zinc-100 rounded w-1/2" />
    </div>
  </div>
);

/* ─── WISHLIST PRODUCT CARD ─── */
const WishlistCard = ({ product, selected, onSelect, onRemove, onAddToCart, onView, isMember, viewMode }) => {
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [removing, setRemoving] = useState(false);

  const vendorHasPromo = product.vendor?.member_discount_enabled ?? false;
  const discountActive = isMember && vendorHasPromo;
  const memberPrice = discountActive
    ? Math.round(Number(product.price) * (1 - MEMBER_DISCOUNT))
    : Number(product.price);

  const handleAdd = (e) => {
    e.stopPropagation();
    onAddToCart(product);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
  };

  const handleRemove = async (e) => {
    e.stopPropagation();
    setRemoving(true);
    await onRemove(product);
  };

  if (viewMode === 'list') {
    return (
      <div className={`group relative bg-white border rounded-2xl p-4 flex items-center gap-4 transition-all duration-300 hover:shadow-md ${
        selected ? 'border-primary bg-primary/3' : 'border-zinc-100 hover:border-zinc-200'
      } ${removing ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'}`}
        style={{ transition: removing ? 'all 0.3s ease' : undefined }}
      >
        {/* CHECKBOX */}
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(product.id); }}
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            selected ? 'bg-primary border-primary' : 'border-zinc-300 hover:border-primary'
          }`}
        >
          {selected && <i className="fa-solid fa-check text-black text-[8px]"></i>}
        </button>

        {/* IMAGE */}
        <div
          className="w-20 h-20 rounded-xl overflow-hidden bg-zinc-50 flex-shrink-0 cursor-pointer"
          onClick={() => onView(product)}
        >
          <img src={product.img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>

        {/* INFO */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onView(product)}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[8px] font-black uppercase text-primary border border-primary/30 bg-primary/8 px-2 py-0.5 rounded-full">{product.status}</span>
            <span className="text-[8px] font-black uppercase text-zinc-400">{product.type}</span>
          </div>
          <h3 className="font-black uppercase italic tracking-tighter text-zinc-900 truncate text-sm group-hover:text-primary transition-colors">{product.name}</h3>
          {product.features?.length > 0 && (
            <p className="text-[9px] text-zinc-400 font-bold truncate mt-0.5">{product.features.slice(0, 2).join(' · ')}</p>
          )}
        </div>

        {/* PRICE */}
        <div className="text-right flex-shrink-0">
          {discountActive ? (
            <>
              <p className="font-black italic text-primary text-lg leading-none">{memberPrice.toLocaleString()} F</p>
              <p className="text-[9px] line-through text-zinc-400">{Number(product.price).toLocaleString()} F</p>
            </>
          ) : (
            <p className="font-black italic text-zinc-900 text-lg leading-none">{Number(product.price).toLocaleString()} F</p>
          )}
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleAdd}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all ${
              addedFeedback
                ? 'bg-emerald-500 text-white'
                : 'bg-primary text-black hover:scale-105'
            }`}
          >
            <i className={`fa-solid ${addedFeedback ? 'fa-check' : 'fa-bag-shopping'} text-xs`}></i>
            <span className="hidden md:inline">{addedFeedback ? 'Ajouté' : 'Au panier'}</span>
          </button>
          <button
            onClick={handleRemove}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-zinc-200 text-zinc-400 hover:text-red-500 hover:border-red-200 transition-all"
          >
            <i className="fa-solid fa-heart-crack text-xs"></i>
          </button>
        </div>
      </div>
    );
  }

  // GRID VIEW
  return (
    <div className={`group relative bg-white border rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
      selected ? 'border-primary ring-2 ring-primary/20' : 'border-zinc-100 hover:border-zinc-200'
    } ${removing ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100'}`}
      style={{ transition: removing ? 'all 0.3s ease' : undefined }}
    >
      {/* CHECKBOX */}
      <button
        onClick={(e) => { e.stopPropagation(); onSelect(product.id); }}
        className={`absolute top-3 left-3 z-20 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all backdrop-blur-sm shadow-sm ${
          selected
            ? 'bg-primary border-primary opacity-100'
            : 'bg-white/80 border-white opacity-0 group-hover:opacity-100'
        }`}
      >
        {selected && <i className="fa-solid fa-check text-black text-[8px]"></i>}
      </button>

      {/* REMOVE */}
      <button
        onClick={handleRemove}
        className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm border border-white flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
      >
        <i className="fa-solid fa-xmark text-xs"></i>
      </button>

      {/* IMAGE */}
      <div
        className="aspect-[3/4] overflow-hidden bg-zinc-50 relative cursor-pointer"
        onClick={() => onView(product)}
      >
        {/* STATUS */}
        <span className="absolute bottom-3 left-3 z-10 bg-black/70 backdrop-blur-sm text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full">
          {product.status}
        </span>

        {/* DISCOUNT BADGE */}
        {vendorHasPromo && (
          <span className={`absolute top-3 left-3 z-10 text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${
            isMember ? 'bg-primary text-black' : 'bg-black/60 text-primary border border-primary/40'
          }`}>
            −20%
          </span>
        )}

        <img
          src={product.img}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />

        {/* HOVER OVERLAY */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 gap-2">
          <button
            onClick={handleAdd}
            className={`w-full py-3 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all ${
              addedFeedback
                ? 'bg-emerald-500 text-white'
                : 'bg-primary text-black hover:bg-white'
            }`}
          >
            <i className={`fa-solid ${addedFeedback ? 'fa-check' : 'fa-bag-shopping'} mr-1.5`}></i>
            {addedFeedback ? 'Ajouté !' : 'Ajouter au panier'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onView(product); }}
            className="w-full py-2.5 rounded-xl bg-white/20 backdrop-blur-sm text-white border border-white/30 font-black text-[9px] uppercase tracking-wider hover:bg-white/30 transition-all"
          >
            <i className="fa-solid fa-eye mr-1.5"></i>Aperçu
          </button>
        </div>
      </div>

      {/* INFO */}
      <div className="p-4">
        <p className="text-[8px] font-black uppercase text-zinc-400 tracking-widest mb-0.5">{product.type}</p>
        <h3 className="font-black italic uppercase tracking-tighter text-zinc-900 text-[11px] leading-tight truncate mb-2">{product.name}</h3>
        <div className="flex items-center justify-between">
          <div>
            {discountActive ? (
              <div className="flex items-baseline gap-1.5">
                <span className="font-black italic text-primary text-base">{memberPrice.toLocaleString()} F</span>
                <span className="text-[9px] line-through text-zinc-400">{Number(product.price).toLocaleString()}</span>
              </div>
            ) : (
              <span className="font-black italic text-zinc-900 text-base">{Number(product.price).toLocaleString()} F</span>
            )}
          </div>
          <button
            onClick={handleAdd}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              addedFeedback ? 'bg-emerald-500' : 'bg-zinc-100 hover:bg-primary group-hover:bg-primary'
            }`}
          >
            <i className={`fa-solid ${addedFeedback ? 'fa-check text-white' : 'fa-plus text-zinc-600 group-hover:text-black'} text-xs`}></i>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── SHARE MODAL ─── */
const ShareModal = ({ onClose, count }) => {
  const [copied, setCopied] = useState(false);
  const url = window.location.href;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl z-10">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <i className="fa-solid fa-share-nodes text-primary text-xl"></i>
          </div>
          <h3 className="font-black uppercase italic text-lg text-zinc-900">Partager ma wishlist</h3>
          <p className="text-[10px] text-zinc-400 font-bold mt-1">{count} produit{count !== 1 ? 's' : ''} sélectionnés</p>
        </div>

        <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl p-3 mb-4">
          <span className="flex-1 text-[10px] font-bold text-zinc-500 truncate">{url}</span>
          <button onClick={copy} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-zinc-900 text-white hover:bg-primary hover:text-black'}`}>
            <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'} text-[8px]`}></i>
            {copied ? 'Copié !' : 'Copier'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: 'fa-whatsapp', label: 'WhatsApp', color: 'bg-green-50 text-green-600 border-green-200', brand: true },
            { icon: 'fa-instagram', label: 'Instagram', color: 'bg-pink-50 text-pink-600 border-pink-200', brand: true },
            { icon: 'fa-envelope', label: 'Email', color: 'bg-blue-50 text-blue-600 border-blue-200', brand: false },
          ].map(s => (
            <button key={s.label} className={`flex flex-col items-center gap-2 py-3 rounded-xl border text-[9px] font-black uppercase ${s.color} transition-all hover:scale-105`}>
              <i className={`fa-${s.brand ? 'brands' : 'solid'} ${s.icon} text-base`}></i>
              {s.label}
            </button>
          ))}
        </div>

        <button onClick={onClose} className="mt-4 w-full py-3 border border-zinc-200 rounded-2xl text-[10px] font-black uppercase text-zinc-400 hover:bg-zinc-50 transition-colors">
          Fermer
        </button>
      </div>
    </div>
  );
};

/* ─── EMPTY STATE ─── */
const EmptyState = () => (
  <div className="py-24 flex flex-col items-center justify-center">
    {/* ANIMATED HEART */}
    <div className="relative mb-8">
      <div className="w-28 h-28 bg-zinc-100 rounded-full flex items-center justify-center">
        <i className="fa-regular fa-heart text-5xl text-zinc-300"></i>
      </div>
      <div className="absolute -top-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center animate-bounce shadow-[0_0_12px_rgba(0,255,136,0.5)]">
        <i className="fa-solid fa-plus text-black text-xs"></i>
      </div>
    </div>

    <h2 className="text-3xl font-black italic uppercase tracking-tighter text-zinc-900 mb-2">
      Wishlist vide
    </h2>
    <p className="text-zinc-400 font-bold text-sm text-center max-w-xs mb-8">
      Vous n'avez pas encore sauvegardé de produits. Explorez le store et cliquez sur ♥ pour ajouter.
    </p>

    <div className="flex items-center gap-3">
      <Link
        to="/store"
        className="flex items-center gap-2 bg-primary text-black px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_8px_20px_rgba(0,255,136,0.25)]"
      >
        <i className="fa-solid fa-bag-shopping text-sm"></i>
        Explorer le store
      </Link>
      <Link
        to="/"
        className="flex items-center gap-2 border border-zinc-200 text-zinc-600 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-zinc-400 transition-all"
      >
        <i className="fa-solid fa-house text-sm"></i>
        Accueil
      </Link>
    </div>

    {/* SUGGESTIONS LABEL */}
    <div className="mt-16 w-full max-w-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-zinc-200"></div>
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Découvrez aussi</span>
        <div className="flex-1 h-px bg-zinc-200"></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: 'fa-headphones', label: 'Audio Lab', color: 'text-primary bg-primary/8 border-primary/20' },
          { icon: 'fa-shirt', label: 'Streetwear', color: 'text-purple-500 bg-purple-50 border-purple-200' },
          { icon: 'fa-shoe-prints', label: 'Sneakers', color: 'text-orange-500 bg-orange-50 border-orange-200' },
        ].map(cat => (
          <Link key={cat.label} to="/store" className={`flex flex-col items-center gap-2 p-4 rounded-2xl border font-black text-[10px] uppercase ${cat.color} hover:scale-105 transition-all`}>
            <i className={`fa-solid ${cat.icon} text-xl`}></i>
            {cat.label}
          </Link>
        ))}
      </div>
    </div>
  </div>
);

/* ════════════════════════════════
   MAIN PAGE
════════════════════════════════ */
const WishlistPage = ({ openModal, addToCart }) => {
  const { user, isMember } = useAuth();
  const navigate = useNavigate();
  const { toggle } = useWishlist();

  const [items, setItems] = useState([]);      // { product_id, products, added_at }
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [sortBy, setSortBy] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [viewMode, setViewMode] = useState('grid');
  const [showShare, setShowShare] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchWishlist();
  }, [user]);

  const fetchWishlist = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('wishlists')
      .select('product_id, created_at, products(*, vendor:vendors!vendor_id(member_discount_enabled))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setItems(data?.filter(d => d.products) || []);
    setLoading(false);
  };

  const handleRemove = async (product) => {
    await toggle(product);
    setItems(prev => prev.filter(i => i.product_id !== product.id));
    setSelected(prev => { const n = new Set(prev); n.delete(product.id); return n; });
    showToast(`"${product.name}" retiré de la wishlist`);
  };

  const handleAddToCart = (product) => {
    addToCart({ ...product, selectedSize: product.type === 'Shoes' ? '42' : 'M', selectedColor: 'Black', quantity: 1 });
    showToast(`"${product.name}" ajouté au panier`);
  };

  // BULK: add all selected to cart
  const handleBulkAddToCart = () => {
    setBulkLoading(true);
    const targets = selected.size > 0
      ? items.filter(i => selected.has(i.product_id)).map(i => i.products)
      : items.map(i => i.products);
    targets.forEach(p => addToCart({ ...p, selectedSize: p.type === 'Shoes' ? '42' : 'M', selectedColor: 'Black', quantity: 1 }));
    showToast(`${targets.length} produit${targets.length > 1 ? 's' : ''} ajouté${targets.length > 1 ? 's' : ''} au panier 🛒`);
    setBulkLoading(false);
  };

  // BULK: remove selected
  const handleBulkRemove = async () => {
    setBulkLoading(true);
    const targets = selected.size > 0
      ? items.filter(i => selected.has(i.product_id))
      : items;
    for (const item of targets) await toggle(item.products);
    setItems(prev => prev.filter(i => !targets.some(t => t.product_id === i.product_id)));
    setSelected(new Set());
    showToast(`${targets.length} produit${targets.length > 1 ? 's' : ''} retiré${targets.length > 1 ? 's' : ''}`);
    setBulkLoading(false);
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(i => i.product_id)));
  };

  // DERIVED DATA
  const products = items.map(i => i.products);
  const categories = ['All', ...new Set(products.map(p => p.type))];

  const filtered = useMemo(() => {
    return items
      .filter(i => filterCategory === 'All' || i.products.type === filterCategory)
      .filter(i => !searchQuery || i.products.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'price-asc') return Number(a.products.price) - Number(b.products.price);
        if (sortBy === 'price-desc') return Number(b.products.price) - Number(a.products.price);
        if (sortBy === 'name') return a.products.name.localeCompare(b.products.name);
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [items, filterCategory, searchQuery, sortBy]);

  const totalValue = filtered.reduce((s, i) => s + Number(i.products.price), 0);
  const selectedCount = selected.size;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 pt-[120px] pb-24">

      {/* ── TOAST ── */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[600] animate-bounce">
          <div className={`flex items-center gap-3 px-6 py-3.5 rounded-full shadow-2xl border backdrop-blur-xl ${
            toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-white border-primary/30 text-zinc-900 shadow-[0_0_20px_rgba(0,255,136,0.15)]'
          }`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${toast.type === 'error' ? 'bg-red-500' : 'bg-primary'}`}>
              <i className={`fa-solid fa-check text-${toast.type === 'error' ? 'white' : 'black'} text-[7px]`}></i>
            </div>
            <p className="text-[10px] font-black uppercase tracking-wider">{toast.msg}</p>
          </div>
        </div>
      )}

      {/* ── SHARE MODAL ── */}
      {showShare && <ShareModal onClose={() => setShowShare(false)} count={items.length} />}

      <div className="max-w-[1400px] mx-auto px-4 md:px-8">

        {/* ══ HERO HEADER ══ */}
        <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-3xl p-8 md:p-12 mb-8">
          {/* GRID PATTERN */}
          <div className="absolute inset-0 opacity-[0.05]" style={{
            backgroundImage: 'linear-gradient(rgba(0,255,136,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/10 rounded-full blur-[80px]" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-primary/15 border border-primary/30 rounded-xl flex items-center justify-center">
                  <i className="fa-solid fa-heart text-primary text-base"></i>
                </div>
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-primary">Collection personnelle</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white leading-none mb-2">
                Ma <span className="text-primary">Wishlist</span>
              </h1>
              <p className="text-zinc-400 font-bold text-sm">
                {loading ? '...' : `${items.length} produit${items.length !== 1 ? 's' : ''} sauvegardé${items.length !== 1 ? 's' : ''}`}
              </p>
            </div>

            {/* STATS */}
            {!loading && items.length > 0 && (
              <div className="flex gap-3 flex-wrap">
                <div className="bg-white/8 border border-white/10 rounded-2xl px-5 py-3 text-center">
                  <p className="text-primary font-black text-2xl italic leading-none">{items.length}</p>
                  <p className="text-[9px] font-black uppercase text-zinc-500 mt-0.5">Articles</p>
                </div>
                <div className="bg-white/8 border border-white/10 rounded-2xl px-5 py-3 text-center">
                  <p className="text-primary font-black text-2xl italic leading-none">{totalValue.toLocaleString()}</p>
                  <p className="text-[9px] font-black uppercase text-zinc-500 mt-0.5">FCFA total</p>
                </div>
                {isMember && (
                  <div className="bg-primary/10 border border-primary/20 rounded-2xl px-5 py-3 text-center">
                    <p className="text-primary font-black text-2xl italic leading-none">
                      -{Math.round(totalValue * MEMBER_DISCOUNT).toLocaleString()}
                    </p>
                    <p className="text-[9px] font-black uppercase text-zinc-500 mt-0.5">Économies</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className={`grid gap-4 ${viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* ══ TOOLBAR ══ */}
            <div className="bg-white border border-zinc-100 rounded-2xl p-4 mb-5 flex flex-col md:flex-row gap-3 items-stretch md:items-center shadow-sm">

              {/* LEFT: SEARCH */}
              <div className="flex-1 relative">
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-sm"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher dans ma wishlist..."
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-zinc-900 placeholder-zinc-400 outline-none focus:border-primary transition-colors"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                    <i className="fa-solid fa-xmark text-sm"></i>
                  </button>
                )}
              </div>

              {/* RIGHT: CONTROLS */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* SORT */}
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="appearance-none bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 pr-8 text-[10px] font-black uppercase text-zinc-600 outline-none focus:border-primary cursor-pointer"
                  >
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[9px] pointer-events-none"></i>
                </div>

                {/* VIEW MODE */}
                <div className="flex bg-zinc-50 border border-zinc-200 rounded-xl overflow-hidden">
                  {['grid', 'list'].map(v => (
                    <button key={v} onClick={() => setViewMode(v)} className={`px-3 py-2.5 transition-all ${viewMode === v ? 'bg-zinc-900 text-primary' : 'text-zinc-400 hover:text-zinc-700'}`}>
                      <i className={`fa-solid fa-${v === 'grid' ? 'grid-2' : 'list'} text-xs`}></i>
                    </button>
                  ))}
                </div>

                {/* SHARE */}
                <button
                  onClick={() => setShowShare(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-[10px] font-black uppercase text-zinc-500 hover:border-primary/50 hover:text-primary transition-all"
                >
                  <i className="fa-solid fa-share-nodes text-xs"></i>
                  <span className="hidden md:inline">Partager</span>
                </button>

                {/* ADD ALL */}
                <button
                  onClick={handleBulkAddToCart}
                  disabled={bulkLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-black text-[10px] font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-[0_4px_12px_rgba(0,255,136,0.2)] disabled:opacity-50"
                >
                  <i className="fa-solid fa-bag-shopping text-xs"></i>
                  <span>{selectedCount > 0 ? `Ajouter (${selectedCount})` : 'Tout au panier'}</span>
                </button>
              </div>
            </div>

            {/* ══ CATEGORY PILLS ══ */}
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar mb-5 pb-1">
              {categories.map(cat => {
                const count = cat === 'All' ? items.length : items.filter(i => i.products.type === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all border flex-shrink-0 ${
                      filterCategory === cat
                        ? 'bg-zinc-900 text-primary border-zinc-900 shadow-md'
                        : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400 hover:text-zinc-900'
                    }`}
                  >
                    <span>{cat === 'All' ? 'Tous' : cat}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ${filterCategory === cat ? 'bg-primary/20 text-primary' : 'bg-zinc-100 text-zinc-400'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ══ SELECT BAR ══ */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSelectAll}
                  className={`flex items-center gap-2 text-[10px] font-black uppercase transition-all border rounded-xl px-3 py-2 ${
                    selectedCount === filtered.length && filtered.length > 0
                      ? 'bg-primary text-black border-primary'
                      : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400'
                  }`}
                >
                  <i className={`fa-solid ${selectedCount === filtered.length && filtered.length > 0 ? 'fa-check-double' : 'fa-check'} text-xs`}></i>
                  <span>{selectedCount === filtered.length && filtered.length > 0 ? 'Tout désélectionner' : 'Tout sélectionner'}</span>
                </button>

                {selectedCount > 0 && (
                  <div className="flex items-center gap-2 animate-in slide-in-from-left duration-200">
                    <span className="text-[10px] font-black uppercase text-primary">{selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}</span>
                    <button
                      onClick={handleBulkRemove}
                      className="flex items-center gap-1.5 text-[10px] font-black uppercase text-red-500 border border-red-200 hover:bg-red-50 px-3 py-2 rounded-xl transition-all"
                    >
                      <i className="fa-solid fa-trash text-xs"></i>
                      Supprimer
                    </button>
                  </div>
                )}
              </div>

              <span className="text-[10px] font-bold text-zinc-400">
                <span className="text-zinc-700 font-black">{filtered.length}</span> produit{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* ══ PRODUCTS ══ */}
            {filtered.length === 0 ? (
              <div className="py-20 text-center border-2 border-dashed border-zinc-200 rounded-3xl bg-white">
                <i className="fa-solid fa-magnifying-glass text-3xl text-zinc-300 block mb-3"></i>
                <p className="font-black uppercase italic text-zinc-400">Aucun résultat</p>
                <button onClick={() => { setSearchQuery(''); setFilterCategory('All'); }} className="mt-4 text-[10px] font-black uppercase text-primary hover:underline">
                  Effacer les filtres
                </button>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-3">
                {filtered.map(item => (
                  <WishlistCard
                    key={item.product_id}
                    product={item.products}
                    selected={selected.has(item.product_id)}
                    onSelect={toggleSelect}
                    onRemove={handleRemove}
                    onAddToCart={handleAddToCart}
                    onView={openModal}
                    isMember={isMember}
                    viewMode="list"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filtered.map(item => (
                  <WishlistCard
                    key={item.product_id}
                    product={item.products}
                    selected={selected.has(item.product_id)}
                    onSelect={toggleSelect}
                    onRemove={handleRemove}
                    onAddToCart={handleAddToCart}
                    onView={openModal}
                    isMember={isMember}
                    viewMode="grid"
                  />
                ))}
              </div>
            )}

            {/* ══ BOTTOM SUMMARY BAR ══ */}
            {filtered.length > 0 && (
              <div className="mt-10 bg-white border border-zinc-100 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Total wishlist</p>
                    <p className="text-2xl font-black italic text-zinc-900 tracking-tighter">{totalValue.toLocaleString()} <span className="text-zinc-400 text-sm not-italic font-bold">FCFA</span></p>
                  </div>
                  {isMember && (
                    <div className="border-l border-zinc-200 pl-6">
                      <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Avec remise membre</p>
                      <p className="text-2xl font-black italic text-primary tracking-tighter">
                        {Math.round(totalValue * (1 - MEMBER_DISCOUNT)).toLocaleString()} <span className="text-zinc-400 text-sm not-italic font-bold">FCFA</span>
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleBulkAddToCart}
                  className="flex items-center gap-3 bg-primary text-black px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_8px_20px_rgba(0,255,136,0.25)] whitespace-nowrap"
                >
                  <i className="fa-solid fa-bag-shopping text-sm"></i>
                  {selectedCount > 0 ? `Ajouter ${selectedCount} article${selectedCount > 1 ? 's' : ''} au panier` : 'Tout ajouter au panier'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default WishlistPage;