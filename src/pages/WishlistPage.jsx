import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../hooks/useWishlist';

const MEMBER_DISCOUNT = 0.20;

const SORT_OPTIONS = [
  { value: 'recent',     label: 'Ajoutés récemment',  icon: 'fa-clock' },
  { value: 'price-asc',  label: 'Prix croissant',      icon: 'fa-arrow-up' },
  { value: 'price-desc', label: 'Prix décroissant',    icon: 'fa-arrow-down' },
  { value: 'name',       label: 'Alphabétique',        icon: 'fa-font' },
];

// ─── SKELETON ─────────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="animate-pulse bg-white border border-[#D5D9D9] rounded overflow-hidden">
    <div className="aspect-[3/4] bg-[#EAEDED]" />
    <div className="p-4 space-y-2">
      <div className="h-2 bg-[#EAEDED] rounded w-1/3" />
      <div className="h-3 bg-[#EAEDED] rounded w-4/5" />
      <div className="h-4 bg-[#EAEDED] rounded w-1/2" />
    </div>
  </div>
);

// ─── WISHLIST CARD ─────────────────────────────────────────────────────────────
const WishlistCard = ({ product, selected, onSelect, onRemove, onAddToCart, onView, isMember, viewMode }) => {
  const [addedFeedback, setAdded]   = useState(false);
  const [removing,      setRemoving] = useState(false);

  const vendorHasPromo = product.vendor?.member_discount_enabled ?? false;
  const discountActive = isMember && vendorHasPromo;
  const memberPrice    = discountActive
    ? Math.round(Number(product.price) * (1 - MEMBER_DISCOUNT))
    : Number(product.price);

  const handleAdd = (e) => {
    e.stopPropagation();
    onAddToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleRemove = async (e) => {
    e.stopPropagation();
    setRemoving(true);
    await onRemove(product);
  };

  if (viewMode === 'list') {
    return (
      <div
        className={`group bg-white border rounded flex items-center gap-4 p-4 transition-all duration-300 hover:shadow-sm
          ${selected ? 'border-[#FF9900] bg-[#FFF8D3]' : 'border-[#D5D9D9] hover:border-[#FF9900]/50'}
          ${removing ? 'opacity-0 scale-95 pointer-events-none' : ''}`}
        style={{ transition: removing ? 'all 0.3s ease' : undefined }}
      >
        {/* CHECKBOX */}
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(product.id); }}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
            ${selected ? 'bg-[#FF9900] border-[#FF9900]' : 'border-[#D5D9D9] hover:border-[#FF9900]'}`}
        >
          {selected && <i className="fa-solid fa-check text-[#0F1111] text-[8px]"></i>}
        </button>

        {/* IMAGE */}
        <div
          className="w-20 h-20 rounded overflow-hidden bg-[#EAEDED] flex-shrink-0 cursor-pointer border border-[#D5D9D9]"
          onClick={() => onView(product)}
        >
          <img src={product.img} alt={product.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
        </div>

        {/* INFO */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onView(product)}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[8px] font-black uppercase bg-[#232F3E] text-[#FF9900] border border-[#232F3E] px-2 py-0.5 rounded-full">{product.type}</span>
            <span className="text-[8px] font-bold text-[#007185]">{product.status}</span>
          </div>
          <h3 className="font-bold text-[#0F1111] truncate text-sm group-hover:text-[#C45500] transition-colors">{product.name}</h3>
          {product.features?.length > 0 && (
            <p className="text-[9px] text-[#565959] truncate mt-0.5">{product.features.slice(0, 2).join(' · ')}</p>
          )}
          <p className="text-[9px] text-[#007185] mt-0.5">
            <i className="fa-solid fa-truck-fast mr-1"></i>Livraison 2h · Douala 🇨🇲
          </p>
        </div>

        {/* PRICE */}
        <div className="text-right flex-shrink-0">
          {discountActive ? (
            <>
              <p className="font-black text-[#B12704] text-lg leading-none">{memberPrice.toLocaleString()} F</p>
              <p className="text-[9px] line-through text-[#565959]">{Number(product.price).toLocaleString()} F</p>
              <span className="text-[8px] font-black text-[#007600] bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">−20% membre</span>
            </>
          ) : (
            <p className="font-black text-[#0F1111] text-lg leading-none">{Number(product.price).toLocaleString()} F</p>
          )}
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleAdd}
            className={`flex items-center gap-2 px-4 py-2.5 rounded font-black text-[9px] uppercase tracking-wider transition-all border ${
              addedFeedback
                ? 'bg-[#007600] text-white border-[#007600]'
                : 'bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border-[#FCD200]'
            }`}
          >
            <i className={`fa-solid ${addedFeedback ? 'fa-check' : 'fa-cart-plus'} text-xs`}></i>
            <span className="hidden md:inline">{addedFeedback ? 'Ajouté' : 'Au panier'}</span>
          </button>
          <button
            onClick={handleRemove}
            className="w-9 h-9 flex items-center justify-center rounded border border-[#D5D9D9] text-[#565959] hover:text-[#B12704] hover:border-red-200 transition-all"
          >
            <i className="fa-solid fa-trash text-xs"></i>
          </button>
        </div>
      </div>
    );
  }

  // GRID VIEW
  return (
    <div
      className={`group bg-white border rounded overflow-hidden transition-all duration-300 hover:shadow-md
        ${selected ? 'border-[#FF9900] ring-1 ring-[#FF9900]/30' : 'border-[#D5D9D9] hover:border-[#FF9900]/50'}
        ${removing ? 'opacity-0 scale-90 pointer-events-none' : ''}`}
      style={{ transition: removing ? 'all 0.3s ease' : undefined }}
    >
      {/* CHECKBOX */}
      <button
        onClick={(e) => { e.stopPropagation(); onSelect(product.id); }}
        className={`absolute top-2 left-2 z-20 w-5 h-5 rounded border-2 flex items-center justify-center transition-all
          ${selected ? 'bg-[#FF9900] border-[#FF9900] opacity-100' : 'bg-white/90 border-[#D5D9D9] opacity-0 group-hover:opacity-100'}`}
        style={{ position: 'absolute' }}
      >
        {selected && <i className="fa-solid fa-check text-[#0F1111] text-[7px]"></i>}
      </button>

      {/* REMOVE */}
      <button
        onClick={handleRemove}
        className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-white/90 border border-[#D5D9D9] flex items-center justify-center text-[#565959] hover:text-[#B12704] hover:border-red-200 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
        style={{ position: 'absolute' }}
      >
        <i className="fa-solid fa-xmark text-xs"></i>
      </button>

      {/* IMAGE */}
      <div
        className="aspect-[3/4] overflow-hidden bg-[#EAEDED] relative cursor-pointer"
        onClick={() => onView(product)}
      >
        {vendorHasPromo && (
          <span className={`absolute top-2 left-2 z-10 text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${
            isMember ? 'bg-[#FF9900] text-[#0F1111]' : 'bg-[#232F3E] text-[#FF9900] border border-[#FF9900]/30'
          }`}>
            −20%
          </span>
        )}
        <span className="absolute bottom-2 left-2 z-10 bg-[#0F1111]/75 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full">
          {product.status}
        </span>

        <img
          src={product.img}
          alt={product.name}
          className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
        />

        {/* HOVER OVERLAY */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F1111]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 gap-2">
          <button
            onClick={handleAdd}
            className={`w-full py-2.5 rounded font-black text-[9px] uppercase tracking-wider transition-all border ${
              addedFeedback
                ? 'bg-[#007600] text-white border-[#007600]'
                : 'bg-[#FFD814] text-[#0F1111] border-[#FCD200] hover:bg-[#F7CA00]'
            }`}
          >
            <i className={`fa-solid ${addedFeedback ? 'fa-check' : 'fa-cart-plus'} mr-1.5`}></i>
            {addedFeedback ? 'Ajouté !' : 'Ajouter au panier'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onView(product); }}
            className="w-full py-2 rounded bg-white/15 backdrop-blur-sm text-white border border-white/25 font-black text-[9px] uppercase tracking-wider hover:bg-white/25 transition-all"
          >
            <i className="fa-solid fa-eye mr-1.5"></i>Aperçu
          </button>
        </div>
      </div>

      {/* INFO */}
      <div className="p-3 relative">
        <p className="text-[8px] font-black uppercase text-[#565959] tracking-widest mb-0.5">{product.type}</p>
        <h3 className="font-bold text-[#0F1111] text-[11px] leading-tight truncate mb-1.5">{product.name}</h3>
        <p className="text-[9px] text-[#007185] mb-2">
          <i className="fa-solid fa-truck-fast mr-1 text-[8px]"></i>Livraison 2h · Douala
        </p>
        <div className="flex items-center justify-between">
          <div>
            {discountActive ? (
              <div className="flex items-baseline gap-1">
                <span className="font-black text-[#B12704] text-base">{memberPrice.toLocaleString()} F</span>
                <span className="text-[9px] line-through text-[#565959]">{Number(product.price).toLocaleString()}</span>
              </div>
            ) : (
              <span className="font-black text-[#0F1111] text-base">{Number(product.price).toLocaleString()} F</span>
            )}
          </div>
          <button
            onClick={handleAdd}
            className={`w-8 h-8 rounded flex items-center justify-center transition-all border ${
              addedFeedback
                ? 'bg-[#007600] border-[#007600]'
                : 'bg-[#FFD814] border-[#FCD200] hover:bg-[#F7CA00] group-hover:bg-[#FFD814]'
            }`}
          >
            <i className={`fa-solid ${addedFeedback ? 'fa-check text-white' : 'fa-plus text-[#0F1111]'} text-xs`}></i>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── SHARE MODAL ──────────────────────────────────────────────────────────────
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
      <div className="relative bg-white border border-[#D5D9D9] rounded p-6 w-full max-w-sm shadow-2xl z-10">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-[#131921] rounded flex items-center justify-center mx-auto mb-3">
            <i className="fa-solid fa-share-nodes text-[#FF9900] text-lg"></i>
          </div>
          <h3 className="font-black text-lg text-[#0F1111]">Partager ma wishlist</h3>
          <p className="text-[10px] text-[#565959] font-bold mt-1">{count} produit{count !== 1 ? 's' : ''}</p>
        </div>

        <div className="flex items-center gap-2 bg-[#EAEDED] border border-[#D5D9D9] rounded px-3 py-2.5 mb-4">
          <span className="flex-1 text-[10px] font-bold text-[#565959] truncate">{url}</span>
          <button onClick={copy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[9px] font-black uppercase transition-all border ${
              copied ? 'bg-[#007600] text-white border-[#007600]' : 'bg-[#FFD814] text-[#0F1111] border-[#FCD200] hover:bg-[#F7CA00]'
            }`}
          >
            <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'} text-[8px]`}></i>
            {copied ? 'Copié !' : 'Copier'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: 'fa-whatsapp',  label: 'WhatsApp',  cls: 'bg-green-50  text-green-600  border-green-200',  brand: true  },
            { icon: 'fa-instagram', label: 'Instagram', cls: 'bg-pink-50   text-pink-600   border-pink-200',   brand: true  },
            { icon: 'fa-envelope',  label: 'Email',     cls: 'bg-[#EAEDED] text-[#565959] border-[#D5D9D9]', brand: false },
          ].map(s => (
            <button key={s.label} className={`flex flex-col items-center gap-2 py-3 rounded border text-[9px] font-black uppercase ${s.cls} hover:scale-105 transition-all`}>
              <i className={`fa-${s.brand ? 'brands' : 'solid'} ${s.icon} text-base`}></i>
              {s.label}
            </button>
          ))}
        </div>

        <button onClick={onClose}
          className="mt-4 w-full py-3 border border-[#D5D9D9] rounded text-[10px] font-black uppercase text-[#565959] hover:bg-[#EAEDED] transition-colors"
        >
          Fermer
        </button>
      </div>
    </div>
  );
};

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
const EmptyState = () => (
  <div className="py-20 flex flex-col items-center justify-center">
    <div className="relative mb-8">
      <div className="w-24 h-24 bg-[#EAEDED] border border-[#D5D9D9] rounded flex items-center justify-center">
        <i className="fa-regular fa-heart text-4xl text-[#D5D9D9]"></i>
      </div>
      <div className="absolute -top-1.5 -right-1.5 w-8 h-8 bg-[#FF9900] rounded-full flex items-center justify-center shadow-lg">
        <i className="fa-solid fa-plus text-[#0F1111] text-xs"></i>
      </div>
    </div>

    <h2 className="text-2xl font-black text-[#0F1111] mb-2">Wishlist vide</h2>
    <p className="text-[#565959] text-sm text-center max-w-xs mb-8">
      Vous n'avez pas encore sauvegardé de produits. Explorez le store et cliquez sur ♥ pour ajouter.
    </p>

    <div className="flex items-center gap-3 flex-wrap justify-center">
      <Link to="/store"
        className="flex items-center gap-2 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-7 py-3.5 rounded border border-[#FCD200] font-black text-[10px] uppercase tracking-widest transition-colors shadow-sm active:scale-[0.98]"
      >
        <i className="fa-solid fa-bag-shopping text-sm"></i>
        Explorer le store
      </Link>
      <Link to="/"
        className="flex items-center gap-2 border border-[#D5D9D9] text-[#565959] hover:border-[#FF9900] hover:text-[#FF9900] px-6 py-3.5 rounded font-black text-[10px] uppercase tracking-widest transition-all"
      >
        <i className="fa-solid fa-house text-sm"></i>
        Accueil
      </Link>
    </div>

    <div className="mt-14 w-full max-w-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-[#D5D9D9]"></div>
        <span className="text-[9px] font-black uppercase tracking-widest text-[#565959]">Découvrez aussi</span>
        <div className="flex-1 h-px bg-[#D5D9D9]"></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: 'fa-headphones', label: 'Audio Lab',  cls: 'bg-[#131921] text-[#FF9900] border-[#232F3E]' },
          { icon: 'fa-shirt',      label: 'Streetwear', cls: 'bg-white text-[#565959] border-[#D5D9D9] hover:border-[#FF9900] hover:text-[#FF9900]' },
          { icon: 'fa-shoe-prints',label: 'Sneakers',   cls: 'bg-white text-[#565959] border-[#D5D9D9] hover:border-[#FF9900] hover:text-[#FF9900]' },
        ].map(cat => (
          <Link key={cat.label} to="/store" className={`flex flex-col items-center gap-2 p-4 rounded border font-black text-[10px] uppercase ${cat.cls} hover:scale-105 transition-all`}>
            <i className={`fa-solid ${cat.icon} text-xl`}></i>
            {cat.label}
          </Link>
        ))}
      </div>
    </div>
  </div>
);

// ════════════════════════════════
//   MAIN PAGE
// ════════════════════════════════
const WishlistPage = ({ openModal, addToCart }) => {
  const { user, isMember } = useAuth();
  const navigate = useNavigate();
  const { toggle } = useWishlist();

  const [items,          setItems]         = useState([]);
  const [loading,        setLoading]       = useState(true);
  const [selected,       setSelected]      = useState(new Set());
  const [sortBy,         setSortBy]        = useState('recent');
  const [searchQuery,    setSearchQuery]   = useState('');
  const [filterCategory, setFilterCat]    = useState('All');
  const [viewMode,       setViewMode]      = useState('grid');
  const [showShare,      setShowShare]     = useState(false);
  const [bulkLoading,    setBulkLoading]   = useState(false);
  const [toast,          setToast]         = useState(null);

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
    showToast(`"${product.name}" retiré des favoris`);
  };

  const handleAddToCart = (product) => {
    addToCart({ ...product, selectedSize: product.type === 'Shoes' ? '42' : 'M', selectedColor: 'Black', quantity: 1 });
    showToast(`"${product.name}" ajouté au panier`);
  };

  const handleBulkAddToCart = () => {
    setBulkLoading(true);
    const targets = selected.size > 0
      ? items.filter(i => selected.has(i.product_id)).map(i => i.products)
      : items.map(i => i.products);
    targets.forEach(p => addToCart({ ...p, selectedSize: p.type === 'Shoes' ? '42' : 'M', selectedColor: 'Black', quantity: 1 }));
    showToast(`${targets.length} produit${targets.length > 1 ? 's' : ''} ajouté${targets.length > 1 ? 's' : ''} au panier`);
    setBulkLoading(false);
  };

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
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(i => i.product_id)));
  };

  const products    = items.map(i => i.products);
  const categories  = ['All', ...new Set(products.map(p => p.type))];
  const totalValue  = items.reduce((s, i) => s + Number(i.products.price), 0);
  const selectedCount = selected.size;

  const filtered = useMemo(() => {
    return items
      .filter(i => filterCategory === 'All' || i.products.type === filterCategory)
      .filter(i => !searchQuery || i.products.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'price-asc')  return Number(a.products.price) - Number(b.products.price);
        if (sortBy === 'price-desc') return Number(b.products.price) - Number(a.products.price);
        if (sortBy === 'name')       return a.products.name.localeCompare(b.products.name);
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [items, filterCategory, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-[#EAEDED] text-[#0F1111]">

      {/* ── TOAST ── */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[600]">
          <div className={`flex items-center gap-3 px-5 py-3 rounded shadow-xl border ${
            toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-[#0F1111] border-[#232F3E] text-white'
          }`}>
            <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${toast.type === 'error' ? 'bg-red-500' : 'bg-[#FF9900]'}`}>
              <i className="fa-solid fa-check text-[#0F1111] text-[7px]"></i>
            </div>
            <p className="text-[11px] font-bold">{toast.msg}</p>
          </div>
        </div>
      )}

      {/* ── SHARE MODAL ── */}
      {showShare && <ShareModal onClose={() => setShowShare(false)} count={items.length} />}

      {/* ═══ HERO HEADER ═══ */}
      <div className="bg-[#131921] border-b border-[#232F3E]">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-[#FF9900]/15 border border-[#FF9900]/30 rounded flex items-center justify-center">
                <i className="fa-solid fa-heart text-[#FF9900] text-base"></i>
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.4em] text-[#FF9900]">Collection personnelle</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-none mb-1">
              Mes <span className="text-[#FF9900]">Favoris</span>
            </h1>
            <p className="text-[#ADBAC7] text-sm">
              {loading ? '...' : `${items.length} produit${items.length !== 1 ? 's' : ''} sauvegardé${items.length !== 1 ? 's' : ''}`}
            </p>
          </div>

          {!loading && items.length > 0 && (
            <div className="flex gap-3 flex-wrap">
              <div className="bg-[#232F3E] border border-[#37475A] rounded px-5 py-3 text-center">
                <p className="text-[#FF9900] font-black text-2xl leading-none">{items.length}</p>
                <p className="text-[9px] font-bold uppercase text-[#ADBAC7] mt-0.5">Articles</p>
              </div>
              <div className="bg-[#232F3E] border border-[#37475A] rounded px-5 py-3 text-center">
                <p className="text-[#FF9900] font-black text-2xl leading-none">{totalValue.toLocaleString()}</p>
                <p className="text-[9px] font-bold uppercase text-[#ADBAC7] mt-0.5">FCFA total</p>
              </div>
              {isMember && (
                <div className="bg-[#FF9900]/10 border border-[#FF9900]/30 rounded px-5 py-3 text-center">
                  <p className="text-[#FF9900] font-black text-2xl leading-none">
                    -{Math.round(totalValue * MEMBER_DISCOUNT).toLocaleString()}
                  </p>
                  <p className="text-[9px] font-bold uppercase text-[#ADBAC7] mt-0.5">Économies</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6">

        {loading ? (
          <div className={`grid gap-4 ${`grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`}`}>
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* ══ TOOLBAR ══ */}
            <div className="bg-white border border-[#D5D9D9] rounded p-4 mb-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center shadow-sm">
              {/* SEARCH */}
              <div className="flex-1 relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-[#adb5bd] text-sm"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Rechercher dans mes favoris..."
                  className="w-full bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded pl-10 pr-4 py-2.5 text-sm text-[#0F1111] placeholder-[#adb5bd] transition-colors"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#adb5bd] hover:text-[#565959]">
                    <i className="fa-solid fa-xmark text-sm"></i>
                  </button>
                )}
              </div>

              {/* CONTROLS */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* SORT */}
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="appearance-none bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded px-4 py-2.5 pr-8 text-[10px] font-bold text-[#565959] cursor-pointer"
                  >
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[#adb5bd] text-[9px] pointer-events-none"></i>
                </div>

                {/* VIEW MODE */}
                <div className="flex bg-[#EAEDED] border border-[#D5D9D9] rounded overflow-hidden">
                  {['grid', 'list'].map(v => (
                    <button key={v} onClick={() => setViewMode(v)}
                      className={`px-3 py-2.5 transition-all ${viewMode === v ? 'bg-[#232F3E] text-[#FF9900]' : 'text-[#565959] hover:text-[#0F1111]'}`}
                    >
                      <i className={`fa-solid fa-${v === 'grid' ? 'grid-2' : 'list'} text-xs`}></i>
                    </button>
                  ))}
                </div>

                {/* SHARE */}
                <button
                  onClick={() => setShowShare(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded bg-white border border-[#D5D9D9] text-[10px] font-bold text-[#565959] hover:border-[#FF9900] hover:text-[#FF9900] transition-all"
                >
                  <i className="fa-solid fa-share-nodes text-xs"></i>
                  <span className="hidden md:inline">Partager</span>
                </button>

                {/* ADD ALL */}
                <button
                  onClick={handleBulkAddToCart}
                  disabled={bulkLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] text-[10px] font-black uppercase tracking-wider border border-[#FCD200] transition-colors disabled:opacity-50 active:scale-[0.98]"
                >
                  <i className="fa-solid fa-cart-plus text-xs"></i>
                  <span>{selectedCount > 0 ? `Ajouter (${selectedCount})` : 'Tout au panier'}</span>
                </button>
              </div>
            </div>

            {/* ══ CATEGORY PILLS ══ */}
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar mb-4 pb-1">
              {categories.map(cat => {
                const count = cat === 'All' ? items.length : items.filter(i => i.products.type === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setFilterCat(cat)}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-[10px] font-black uppercase whitespace-nowrap transition-all border flex-shrink-0 ${
                      filterCategory === cat
                        ? 'bg-[#232F3E] text-[#FF9900] border-[#232F3E]'
                        : 'bg-white text-[#565959] border-[#D5D9D9] hover:border-[#FF9900]/50 hover:text-[#0F1111]'
                    }`}
                  >
                    <span>{cat === 'All' ? 'Tous' : cat}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ${
                      filterCategory === cat ? 'bg-[#FF9900]/20 text-[#FF9900]' : 'bg-[#EAEDED] text-[#565959]'
                    }`}>
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
                  className={`flex items-center gap-2 text-[10px] font-black uppercase transition-all border rounded px-3 py-2 ${
                    selectedCount === filtered.length && filtered.length > 0
                      ? 'bg-[#FF9900] text-[#0F1111] border-[#FF9900]'
                      : 'bg-white border-[#D5D9D9] text-[#565959] hover:border-[#FF9900]'
                  }`}
                >
                  <i className={`fa-solid ${selectedCount === filtered.length && filtered.length > 0 ? 'fa-check-double' : 'fa-check'} text-xs`}></i>
                  <span>{selectedCount === filtered.length && filtered.length > 0 ? 'Tout désélectionner' : 'Tout sélectionner'}</span>
                </button>

                {selectedCount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-[#FF9900]">{selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}</span>
                    <button
                      onClick={handleBulkRemove}
                      className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#B12704] border border-red-200 hover:bg-red-50 px-3 py-2 rounded transition-all"
                    >
                      <i className="fa-solid fa-trash text-xs"></i>
                      Supprimer
                    </button>
                  </div>
                )}
              </div>

              <span className="text-[10px] font-bold text-[#565959]">
                <span className="text-[#0F1111] font-black">{filtered.length}</span> produit{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* ══ PRODUCTS ══ */}
            {filtered.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-[#D5D9D9] rounded bg-white">
                <i className="fa-solid fa-magnifying-glass text-3xl text-[#D5D9D9] block mb-3"></i>
                <p className="font-black uppercase text-[#565959]">Aucun résultat</p>
                <button onClick={() => { setSearchQuery(''); setFilterCat('All'); }} className="mt-4 text-[10px] font-black uppercase text-[#007185] hover:underline">
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

            {/* ══ BOTTOM SUMMARY ══ */}
            {filtered.length > 0 && (
              <div className="mt-8 bg-white border border-[#D5D9D9] rounded p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-6 flex-wrap">
                  <div>
                    <p className="text-[9px] font-black uppercase text-[#565959] tracking-widest mb-0.5">Sous-total</p>
                    <p className="text-2xl font-black text-[#0F1111]">
                      {totalValue.toLocaleString()} <span className="text-[#565959] text-sm font-bold">FCFA</span>
                    </p>
                  </div>
                  {isMember && (
                    <div className="border-l border-[#D5D9D9] pl-6">
                      <p className="text-[9px] font-black uppercase text-[#565959] tracking-widest mb-0.5">Avec remise membre −20%</p>
                      <p className="text-2xl font-black text-[#B12704]">
                        {Math.round(totalValue * (1 - MEMBER_DISCOUNT)).toLocaleString()} <span className="text-[#565959] text-sm font-bold">FCFA</span>
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleBulkAddToCart}
                  className="flex items-center gap-3 bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] px-7 py-3.5 rounded border border-[#FCD200] font-black text-[10px] uppercase tracking-widest transition-colors shadow-sm active:scale-[0.98] whitespace-nowrap"
                >
                  <i className="fa-solid fa-cart-plus text-sm"></i>
                  {selectedCount > 0 ? `Ajouter ${selectedCount} article${selectedCount > 1 ? 's' : ''} au panier` : 'Tout ajouter au panier'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default WishlistPage;
