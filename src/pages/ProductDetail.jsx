import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ProductCard from '../components/ProductCard';

/* ── BREADCRUMB ── */
const Breadcrumb = ({ product }) => (
  <nav className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-6">
    <Link to="/" className="hover:text-primary transition-colors">Accueil</Link>
    <i className="fa-solid fa-chevron-right text-[8px]"></i>
    <Link to="/store" className="hover:text-primary transition-colors">Store</Link>
    <i className="fa-solid fa-chevron-right text-[8px]"></i>
    <span className="text-primary">{product?.type}</span>
    <i className="fa-solid fa-chevron-right text-[8px]"></i>
    <span className="text-zinc-500 truncate max-w-[140px]">{product?.name}</span>
  </nav>
);

/* ── IMAGE GALLERY ── */
const ImageGallery = ({ product }) => {
  const [activeImg, setActiveImg] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  const images = [
    product?.img,
    `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=800`,
    `https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=80&w=800`,
    `https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=800`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      {/* MAIN IMAGE */}
      <div
        className="relative overflow-hidden rounded-3xl bg-zinc-100 aspect-square cursor-zoom-in group border border-zinc-200"
        onClick={() => setZoomed(!zoomed)}
      >
        <img
          src={images[activeImg]}
          alt={product?.name}
          className={`w-full h-full object-cover transition-all duration-700 ${zoomed ? 'scale-150' : 'group-hover:scale-105'}`}
        />
        {/* OVERLAY BADGES */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
          <span className="bg-primary text-black text-[9px] font-black px-3 py-1 rounded-full uppercase shadow-sm">
            {product?.status}
          </span>
          {product?.type && (
            <span className="bg-white/90 backdrop-blur-md text-zinc-600 text-[8px] font-black px-3 py-1 rounded-full uppercase border border-zinc-200 shadow-sm">
              {product.type}
            </span>
          )}
        </div>
        {/* ZOOM HINT */}
        <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-md text-zinc-600 text-[8px] font-black px-3 py-1.5 rounded-full border border-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
          <i className="fa-solid fa-magnifying-glass-plus mr-1"></i>ZOOM
        </div>
        {/* AUTHENTICITY BADGE */}
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md border border-primary/30 rounded-xl px-3 py-2 z-10 shadow-sm">
          <p className="text-primary text-[7px] font-black uppercase tracking-widest">OneFreestyle</p>
          <p className="text-zinc-700 text-[7px] font-black uppercase">Authentic ✓</p>
        </div>
      </div>

      {/* THUMBNAILS */}
      <div className="grid grid-cols-4 gap-2">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setActiveImg(i)}
            className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
              activeImg === i ? 'border-primary shadow-[0_0_12px_rgba(0,255,136,0.25)]' : 'border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <img src={img} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
};

/* ── SKELETON LOADER ── */
const DetailSkeleton = () => (
  <div className="animate-pulse grid grid-cols-1 lg:grid-cols-2 gap-10">
    <div className="aspect-square bg-zinc-100 rounded-3xl"></div>
    <div className="space-y-6">
      <div className="h-4 bg-zinc-100 rounded w-1/3"></div>
      <div className="h-10 bg-zinc-100 rounded w-full"></div>
      <div className="h-10 bg-zinc-100 rounded w-2/3"></div>
      <div className="h-8 bg-zinc-100 rounded w-1/4"></div>
      <div className="grid grid-cols-5 gap-2">
        {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-zinc-100 rounded-xl"></div>)}
      </div>
      <div className="h-14 bg-zinc-100 rounded-2xl"></div>
    </div>
  </div>
);

/* ── RELATED PRODUCTS ── */
const RelatedProducts = ({ currentProduct, openModal, addToCart }) => {
  const [related, setRelated] = useState([]);

  useEffect(() => {
    if (!currentProduct?.type) return;
    supabase
      .from('products')
      .select('*')
      .eq('type', currentProduct.type)
      .neq('id', currentProduct.id)
      .limit(6)
      .then(({ data }) => setRelated(data || []));
  }, [currentProduct]);

  if (!related.length) return null;

  return (
    <section className="mt-16 pt-10 border-t border-zinc-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-primary rounded-full"></div>
          <h3 className="text-xl font-black uppercase tracking-tighter text-zinc-900">
            Tu pourrais <span className="text-primary italic">aimer</span>
          </h3>
        </div>
        <Link to="/store" className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 hover:underline decoration-primary underline-offset-4">
          <span>Voir tout</span>
          <i className="fa-solid fa-arrow-right text-xs"></i>
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {related.map(p => (
          <ProductCard key={p.id} product={p} openModal={openModal} addToCart={addToCart} />
        ))}
      </div>
    </section>
  );
};

/* ── MAIN PRODUCT DETAIL ── */
const ProductDetail = ({ addToCart, openModal }) => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [product, setProduct] = useState(location.state?.product || null);
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(!location.state?.product);
  const [size, setSize] = useState('M');
  const [color, setColor] = useState('Black');
  const [qty, setQty] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState('specs');
  const [wishlist, setWishlist] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  useEffect(() => {
    if (!product) {
      supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()
        .then(({ data, error }) => {
          if (!error && data) setProduct(data);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (product?.vendor_id) {
      supabase
        .from('vendors')
        .select('*')
        .eq('id', product.vendor_id)
        .single()
        .then(({ data }) => setVendor(data));
    }
  }, [product]);

  useEffect(() => {
    if (product) { setSize('M'); setColor('Black'); setQty(1); }
  }, [product]);

  const handleAddToCart = () => {
    const isShoes = product?.type === 'Shoes';
    const isApparel = product?.type === 'Clothing';
    addToCart({
      ...product,
      selectedSize: (isShoes || isApparel) ? size : 'Unique',
      selectedColor: color,
      quantity: qty,
    });
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: product?.name, url });
    } else {
      navigator.clipboard.writeText(url);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    }
  };

  const isApparel = product?.type === 'Clothing';
  const isShoes = product?.type === 'Shoes';

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 pt-[120px] pb-20">

      {/* SHARE TOAST */}
      {shareToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[400] bg-zinc-900 text-primary px-6 py-3 rounded-full font-black text-[10px] uppercase tracking-widest animate-bounce shadow-xl">
          <i className="fa-solid fa-check mr-2"></i>Lien copié !
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 md:px-8">

        {/* BREADCRUMB */}
        {!loading && product && <Breadcrumb product={product} />}

        {loading ? (
          <DetailSkeleton />
        ) : !product ? (
          <div className="text-center py-32">
            <p className="text-3xl font-black italic uppercase text-zinc-300">Produit introuvable</p>
            <button onClick={() => navigate('/store')} className="mt-6 bg-zinc-900 text-primary px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:text-black transition-all">
              Retour au Store
            </button>
          </div>
        ) : (
          <>
            {/* ── MAIN GRID ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-16">

              {/* LEFT: IMAGE GALLERY */}
              <ImageGallery product={product} />

              {/* RIGHT: PRODUCT INFO */}
              <div className="flex flex-col gap-6">

                {/* TAG + NAME */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[9px] font-black uppercase tracking-[0.4em] text-primary border border-primary/30 bg-primary/10 px-3 py-1 rounded-full">
                      {product.type}
                    </span>
                    {vendor?.shop_name && (
                      <Link
                        to={`/shop/${vendor.shop_name}`}
                        className="text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 flex items-center gap-1.5 transition-colors"
                      >
                        <div className="w-4 h-4 bg-zinc-200 rounded-full flex items-center justify-center">
                          <i className="fa-solid fa-store text-zinc-500 text-[6px]"></i>
                        </div>
                        <span>{vendor.shop_name}</span>
                        <i className="fa-solid fa-arrow-up-right-from-square text-[8px]"></i>
                      </Link>
                    )}
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter leading-none uppercase text-zinc-900 mb-2">
                    {product.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <i key={i} className={`fa-solid fa-star text-xs ${i < 4 ? 'text-yellow-400' : 'text-zinc-300'}`}></i>
                      ))}
                    </div>
                    <span className="text-[9px] font-bold text-zinc-400">(4.2 · 128 avis)</span>
                    <span className="text-[9px] font-black text-primary">· 47 vendus ce mois</span>
                  </div>
                </div>

                {/* PRICE BLOCK */}
                <div className="flex items-end gap-4 py-4 border-y border-zinc-200">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Prix</p>
                    <p className="text-4xl font-black italic tracking-tighter text-primary">
                      {Number(product.price).toLocaleString()}
                      <span className="text-xl ml-1 text-zinc-400">FCFA</span>
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 pb-1">
                    <span className="text-[9px] font-black uppercase text-zinc-400 line-through">
                      {Math.round(Number(product.price) * 1.15).toLocaleString()} FCFA
                    </span>
                    <span className="text-[9px] font-black text-emerald-600 uppercase">-15% appliqué</span>
                  </div>
                </div>

                {/* COLOR SELECTOR */}
                <div>
                  <p className="text-[10px] font-black uppercase mb-3 tracking-widest text-zinc-500">
                    Couleur — <span className="text-zinc-900">{color}</span>
                  </p>
                  <div className="flex gap-3">
                    {[
                      { name: 'Black', hex: '#111' },
                      { name: 'White', hex: '#f5f5f5' },
                      { name: 'Neon', hex: '#00ff88' },
                      { name: 'Slate', hex: '#64748b' },
                    ].map(c => (
                      <button
                        key={c.name}
                        onClick={() => setColor(c.name)}
                        title={c.name}
                        className={`w-9 h-9 rounded-full border-4 transition-all duration-300 hover:scale-110 ${
                          color === c.name
                            ? 'border-primary scale-110 shadow-[0_0_12px_rgba(0,255,136,0.4)]'
                            : 'border-zinc-200 hover:border-zinc-400'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                </div>

                {/* SIZE SELECTOR */}
                {(isApparel || isShoes) && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Taille — <span className="text-zinc-900">{size}</span>
                      </p>
                      <button className="text-[9px] font-black uppercase text-primary hover:underline decoration-primary underline-offset-4">
                        Guide des tailles →
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(isShoes ? ['40','41','42','43','44','45'] : ['XS','S','M','L','XL','XXL']).map(s => (
                        <button
                          key={s}
                          onClick={() => setSize(s)}
                          className={`min-w-[52px] h-12 px-3 text-[11px] font-black rounded-xl transition-all border-2 ${
                            size === s
                              ? 'bg-primary text-black border-primary shadow-[0_4px_16px_rgba(0,255,136,0.25)]'
                              : 'border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 bg-white'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* QUANTITY + ACTIONS */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Quantité</p>
                    <div className="flex items-center bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                      <button
                        onClick={() => setQty(Math.max(1, qty - 1))}
                        className="w-11 h-11 text-zinc-400 hover:text-primary hover:bg-zinc-50 transition font-black text-lg"
                      >
                        −
                      </button>
                      <span className="font-black text-sm px-4 min-w-[40px] text-center text-zinc-900">{qty}</span>
                      <button
                        onClick={() => setQty(qty + 1)}
                        className="w-11 h-11 text-zinc-400 hover:text-primary hover:bg-zinc-50 transition font-black text-lg"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-[9px] text-zinc-400 font-bold">En stock</span>
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                  </div>

                  {/* CTA BUTTONS */}
                  <button
                    onClick={handleAddToCart}
                    className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] transition-all duration-300 flex items-center justify-center gap-3 ${
                      addedFeedback
                        ? 'bg-emerald-500 text-white shadow-[0_0_30px_rgba(34,197,94,0.2)]'
                        : 'bg-primary text-black hover:bg-zinc-900 hover:text-primary shadow-[0_8px_30px_rgba(0,255,136,0.2)] hover:scale-[1.02] active:scale-95'
                    }`}
                  >
                    <i className={`fa-solid ${addedFeedback ? 'fa-check' : 'fa-bag-shopping'} text-sm`}></i>
                    <span>{addedFeedback ? "Ajouté à l'arsenal !" : `Ajouter au panier — ${(Number(product.price) * qty).toLocaleString()} FCFA`}</span>
                  </button>

                  <div className="grid grid-cols-3 gap-2">
                    <Link
                      to="/studio"
                      state={{ productId: product.id }}
                      className="col-span-2 py-4 bg-white border border-zinc-200 hover:border-primary/40 rounded-2xl font-black uppercase text-[10px] tracking-wider text-zinc-500 hover:text-primary transition-all text-center flex items-center justify-center gap-2 shadow-sm"
                    >
                      <i className="fa-solid fa-wand-magic-sparkles text-primary text-xs"></i>
                      Personnaliser
                    </Link>
                    <button
                      onClick={() => setWishlist(!wishlist)}
                      className={`py-4 rounded-2xl border font-black text-[10px] tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm ${
                        wishlist
                          ? 'bg-red-50 border-red-200 text-red-400'
                          : 'bg-white border-zinc-200 hover:border-red-200 text-zinc-400 hover:text-red-400'
                      }`}
                    >
                      <i className={`fa-${wishlist ? 'solid' : 'regular'} fa-heart text-sm`}></i>
                    </button>
                  </div>
                </div>

                {/* SHIPPING INFO */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: 'fa-truck-fast', title: 'Livraison 2h', sub: 'Douala', color: 'text-primary', bg: 'bg-primary/8 border-primary/15' },
                    { icon: 'fa-shield-check', title: 'Paiement sûr', sub: 'OM / Cash', color: 'text-blue-500', bg: 'bg-blue-50 border-blue-100' },
                    { icon: 'fa-rotate-left', title: 'Retour 7j', sub: 'Sans frais', color: 'text-purple-500', bg: 'bg-purple-50 border-purple-100' },
                  ].map(item => (
                    <div key={item.title} className={`${item.bg} border rounded-xl p-3 text-center hover:shadow-sm transition-all`}>
                      <i className={`fa-solid ${item.icon} ${item.color} text-sm mb-1 block`}></i>
                      <p className="text-[9px] font-black uppercase text-zinc-700 leading-tight">{item.title}</p>
                      <p className="text-[8px] font-bold text-zinc-400">{item.sub}</p>
                    </div>
                  ))}
                </div>

                {/* SHARE */}
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-primary transition-colors self-start"
                >
                  <i className="fa-solid fa-share-nodes"></i>
                  <span>Partager ce produit</span>
                </button>
              </div>
            </div>

            {/* ── TABS: SPECS / DESCRIPTION / REVIEWS ── */}
            <div className="mt-14 border-t border-zinc-200 pt-10">
              <div className="flex gap-1 mb-8 bg-white p-1.5 rounded-2xl w-fit border border-zinc-200 shadow-sm">
                {[
                  { key: 'specs', label: 'Caractéristiques', icon: 'fa-list-check' },
                  { key: 'description', label: 'Description', icon: 'fa-align-left' },
                  { key: 'reviews', label: 'Avis (128)', icon: 'fa-star' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                      activeTab === tab.key
                        ? 'bg-primary text-black shadow-md'
                        : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <i className={`fa-solid ${tab.icon} text-xs`}></i>
                    <span className="hidden md:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {activeTab === 'specs' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                  {(product.features?.length > 0
                    ? product.features
                    : ['Qualité Elite Certifiée', 'Design OneFreestyle Exclusif', 'Livraison Express Douala', 'Retour sous 7 jours']
                  ).map((feat, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 bg-white border border-zinc-200 rounded-2xl p-5 group hover:border-primary/40 hover:shadow-sm transition-all"
                    >
                      <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-bolt text-primary text-xs"></i>
                      </div>
                      <span className="text-[11px] font-bold text-zinc-500 group-hover:text-zinc-900 transition-colors uppercase">{feat}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'description' && (
                <div className="max-w-2xl space-y-4">
                  <p className="text-zinc-600 leading-relaxed font-bold text-sm">
                    <span className="text-primary font-black italic">{product.name}</span> est une pièce sélectionnée par les experts OneFreestyle Elite — conçue pour ceux qui refusent la médiocrité et ne jurent que par l'excellence.
                  </p>
                  <p className="text-zinc-500 leading-relaxed text-sm font-bold">
                    Chaque produit de notre catalogue est soigneusement vérifié et certifié avant d'intégrer la marketplace. Livraison express à Douala, paiement sécurisé via Orange Money ou cash à la livraison.
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-4">
                    {[
                      { label: 'Type', value: product.type },
                      { label: 'Statut', value: product.status },
                      { label: 'Livraison', value: 'Douala — 2h' },
                      { label: 'Paiement', value: 'OM / Cash' },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between items-center py-3 border-b border-zinc-100 text-[11px]">
                        <span className="font-black uppercase text-zinc-400 tracking-wider">{item.label}</span>
                        <span className="font-black text-zinc-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="max-w-2xl space-y-4">
                  {/* AVERAGE RATING */}
                  <div className="flex items-center gap-6 bg-white border border-zinc-200 rounded-2xl p-6 mb-6 shadow-sm">
                    <div className="text-center">
                      <p className="text-5xl font-black italic text-primary">4.2</p>
                      <div className="flex justify-center gap-0.5 my-1">
                        {[...Array(5)].map((_, i) => (
                          <i key={i} className={`fa-solid fa-star text-xs ${i < 4 ? 'text-yellow-400' : 'text-zinc-300'}`}></i>
                        ))}
                      </div>
                      <p className="text-[9px] font-black uppercase text-zinc-400">128 avis</p>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      {[5,4,3,2,1].map(star => (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-zinc-400 w-2">{star}</span>
                          <i className="fa-solid fa-star text-yellow-400 text-[8px]"></i>
                          <div className="flex-1 bg-zinc-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-primary transition-all"
                              style={{ width: `${[72, 18, 6, 2, 2][5-star]}%` }}
                            ></div>
                          </div>
                          <span className="text-[9px] font-black text-zinc-400 w-6">{[72, 18, 6, 2, 2][5-star]}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SAMPLE REVIEWS */}
                  {[
                    { name: 'Aristide M.', rating: 5, text: 'Qualité top, livraison ultra rapide. Je recommande !', date: 'Il y a 3 jours' },
                    { name: 'Sandra N.', rating: 4, text: 'Très bon produit, correspond exactement aux photos. Packaging soigné.', date: 'Il y a 1 semaine' },
                    { name: 'Kevin F.', rating: 5, text: "OneFreestyle c'est sérieux. Produit authentique, rien à redire !", date: 'Il y a 2 semaines' },
                  ].map((rev, i) => (
                    <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 hover:border-zinc-300 hover:shadow-sm transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                            <span className="font-black text-primary text-xs">{rev.name[0]}</span>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-zinc-900">{rev.name}</p>
                            <p className="text-[8px] font-bold text-zinc-400">{rev.date}</p>
                          </div>
                        </div>
                        <div className="flex">
                          {[...Array(rev.rating)].map((_, j) => (
                            <i key={j} className="fa-solid fa-star text-yellow-400 text-[10px]"></i>
                          ))}
                        </div>
                      </div>
                      <p className="text-zinc-500 text-xs font-bold leading-relaxed">{rev.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── VENDOR CARD ── */}
            {vendor && (
              <div className="mt-12 border-t border-zinc-200 pt-10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-1 h-8 bg-primary rounded-full"></div>
                  <h3 className="text-lg font-black uppercase tracking-tighter text-zinc-900">
                    La <span className="text-primary italic">Boutique</span>
                  </h3>
                </div>
                <div className="bg-white border border-zinc-200 rounded-3xl p-6 hover:border-primary/30 hover:shadow-md transition-all group">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary/15 to-primary/5 rounded-2xl flex items-center justify-center border border-primary/20 flex-shrink-0">
                      <i className="fa-solid fa-store text-primary text-xl"></i>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-black text-xl uppercase italic tracking-tighter text-zinc-900">{vendor.shop_name}</h4>
                        <span className="bg-primary/10 text-primary border border-primary/20 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Certifié</span>
                      </div>
                      <p className="text-zinc-400 text-[11px] font-bold mb-2">{vendor.full_name} · Douala, Cameroun 🇨🇲</p>
                      <div className="flex items-center gap-4 text-[9px] font-black uppercase text-zinc-400">
                        <span><i className="fa-solid fa-box text-primary mr-1"></i>Catalogue disponible</span>
                        <span><i className="fa-solid fa-star text-yellow-400 mr-1"></i>Elite Vendor</span>
                        <span><i className="fa-solid fa-truck-fast text-blue-400 mr-1"></i>Livraison express</span>
                      </div>
                    </div>
                    <Link
                      to={`/shop/${vendor.shop_name}`}
                      className="flex items-center gap-2 bg-primary text-black px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-900 hover:text-primary transition-all hover:scale-105 flex-shrink-0"
                    >
                      <i className="fa-solid fa-store text-sm"></i>
                      <span>Voir la boutique</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* RELATED PRODUCTS */}
            <RelatedProducts currentProduct={product} openModal={openModal} addToCart={addToCart} />
          </>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;