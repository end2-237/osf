import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ProductCard from '../components/ProductCard';
import ofsLogo from '../assets/ofs.png';

/* ── SKELETON ── */
const ProductSkeleton = () => (
  <div className="animate-pulse">
    <div className="aspect-[3/4] overflow-hidden bg-zinc-900 rounded-2xl mb-3 relative flex items-center justify-center">
      <img src={ofsLogo} alt="" className="w-10 opacity-10 grayscale" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
    </div>
    <div className="space-y-1.5">
      <div className="h-2.5 bg-zinc-800 rounded w-3/4"></div>
      <div className="flex justify-between">
        <div className="h-2 bg-zinc-800 rounded w-1/3"></div>
        <div className="h-2.5 bg-zinc-800 rounded w-1/4"></div>
      </div>
    </div>
  </div>
);

/* ── VENDOR PROFILE HEADER ── */
const VendorHeader = ({ vendor, products, loading }) => {
  const totalRevenue = products.reduce((acc, p) => acc + Number(p.price || 0), 0);
  const categories = [...new Set(products.map(p => p.type))];

  if (loading && !vendor) return (
    <div className="relative h-[350px] bg-zinc-900 animate-pulse rounded-b-3xl overflow-hidden">
      <div className="absolute bottom-0 left-0 right-0 p-8 flex items-end gap-6">
        <div className="w-24 h-24 bg-zinc-800 rounded-2xl"></div>
        <div className="space-y-2 flex-1">
          <div className="h-8 bg-zinc-800 rounded w-1/3"></div>
          <div className="h-3 bg-zinc-800 rounded w-1/4"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {/* COVER IMAGE */}
      <div className="relative h-[280px] md:h-[360px] overflow-hidden rounded-b-3xl">
        <img
          src={`https://picsum.photos/1600/600?random=${vendor?.id || 1}`}
          className="w-full h-full object-cover opacity-40 grayscale"
          alt=""
        />
        {/* GRADIENT OVERLAYS */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent"></div>

        {/* DECORATIVE GRID PATTERN */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(0,255,136,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* GLOW */}
        <div className="absolute bottom-0 left-0 w-[400px] h-[200px] bg-primary/10 blur-[100px] rounded-full"></div>

        {/* VENDOR INFO */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-start md:items-end gap-5 md:gap-8">

            {/* AVATAR */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/40 flex items-center justify-center shadow-[0_0_30px_rgba(0,255,136,0.2)]">
                <i className="fa-solid fa-store text-primary text-3xl"></i>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-primary rounded-full w-5 h-5 flex items-center justify-center shadow-lg">
                <i className="fa-solid fa-check text-black text-[8px]"></i>
              </div>
            </div>

            {/* NAME + META */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-white leading-none">
                  {vendor?.shop_name || '...'}
                </h1>
                <span className="bg-primary text-black text-[8px] font-black px-3 py-1 rounded-full uppercase">Certifié Elite</span>
              </div>
              <div className="flex items-center gap-4 flex-wrap text-[10px] font-black uppercase text-zinc-400">
                <span><i className="fa-solid fa-user mr-1.5 text-primary"></i>{vendor?.full_name}</span>
                <span><i className="fa-solid fa-location-dot mr-1.5 text-primary"></i>Douala, CM 🇨🇲</span>
                <span><i className="fa-solid fa-box mr-1.5 text-primary"></i>{products.length} produits</span>
                {categories.length > 0 && (
                  <span><i className="fa-solid fa-tag mr-1.5 text-primary"></i>{categories.slice(0,2).join(' · ')}</span>
                )}
              </div>
            </div>

            {/* STATS PILLS */}
            <div className="flex gap-2 flex-wrap">
              <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 text-center min-w-[70px]">
                <p className="text-primary font-black text-xl leading-none">{products.length}</p>
                <p className="text-[8px] font-black uppercase text-zinc-400 mt-0.5">Items</p>
              </div>
              <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 text-center min-w-[70px]">
                <p className="text-yellow-400 font-black text-xl leading-none">4.8</p>
                <p className="text-[8px] font-black uppercase text-zinc-400 mt-0.5">Rating</p>
              </div>
              <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 text-center min-w-[80px]">
                <p className="text-primary font-black text-xl leading-none">Fast</p>
                <p className="text-[8px] font-black uppercase text-zinc-400 mt-0.5">Livraison</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── CATEGORY FILTER TABS ── */
const CategoryTabs = ({ categories, active, onChange }) => (
  <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar py-1">
    <button
      onClick={() => onChange('Tous')}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border flex-shrink-0 ${
        active === 'Tous'
          ? 'bg-primary text-black border-primary shadow-[0_0_12px_rgba(0,255,136,0.3)]'
          : 'bg-zinc-950 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white'
      }`}
    >
      <i className="fa-solid fa-grid-2 text-xs"></i>
      <span>Tous ({categories.total})</span>
    </button>
    {categories.items.map(cat => (
      <button
        key={cat.name}
        onClick={() => onChange(cat.name)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all border flex-shrink-0 ${
          active === cat.name
            ? 'bg-primary text-black border-primary shadow-[0_0_12px_rgba(0,255,136,0.3)]'
            : 'bg-zinc-950 border-white/10 text-zinc-400 hover:border-white/20 hover:text-white'
        }`}
      >
        <i className={`fa-solid ${cat.icon} text-xs`}></i>
        <span>{cat.name} ({cat.count})</span>
      </button>
    ))}
  </div>
);

/* ── SORT DROPDOWN ── */
const SORT_OPTIONS = [
  { value: 'recent', label: 'Plus récents' },
  { value: 'price-asc', label: 'Prix ↑' },
  { value: 'price-desc', label: 'Prix ↓' },
  { value: 'popular', label: 'Populaires' },
];

const TYPE_ICONS = {
  'Audio Lab': 'fa-headphones',
  'Tech Lab': 'fa-microchip',
  'Clothing': 'fa-shirt',
  'Shoes': 'fa-shoe-prints',
  'Fragrance': 'fa-spray-can-sparkles',
  'Accessories': 'fa-gem',
};

/* ── MAIN SHOPPAGE ── */
const ShopPage = ({ openModal, addToCart }) => {
  const { shopName } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoModalDone = useRef(false);

  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tous');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');
  const [priceRange, setPriceRange] = useState([0, 500000]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchShopData = async () => {
      setLoading(true);
      try {
        const { data: vendorData, error: vError } = await supabase
          .from('vendors').select('*').eq('shop_name', shopName).single();
        if (vError) throw vError;
        setVendor(vendorData);

        const { data: pData, error: pError } = await supabase
          .from('products').select('*').eq('vendor_id', vendorData.id)
          .order('created_at', { ascending: false });
        if (pError) throw pError;
        setProducts(pData || []);
      } catch (err) {
        console.error('Erreur boutique:', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchShopData();
    autoModalDone.current = false;
  }, [shopName]);

  useEffect(() => {
    if (!loading && products.length > 0 && !autoModalDone.current) {
      const productId = searchParams.get('product');
      if (productId) {
        const found = products.find(p => p.id === productId);
        if (found) {
          autoModalDone.current = true;
          setTimeout(() => openModal(found), 300);
        }
      }
    }
  }, [loading, products, searchParams, openModal]);

  // Catégories dynamiques
  const categoryMap = products.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {});
  const categories = {
    total: products.length,
    items: Object.entries(categoryMap).map(([name, count]) => ({
      name,
      count,
      icon: TYPE_ICONS[name] || 'fa-tag',
    })),
  };

  // Filtered + sorted products
  const filteredProducts = products
    .filter(p => activeCategory === 'Tous' || p.type === activeCategory)
    .filter(p => searchQuery === '' || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(p => Number(p.price) >= priceRange[0] && Number(p.price) <= priceRange[1])
    .sort((a, b) => {
      if (sortBy === 'price-asc') return Number(a.price) - Number(b.price);
      if (sortBy === 'price-desc') return Number(b.price) - Number(a.price);
      return 0;
    });

  const maxPrice = Math.max(...products.map(p => Number(p.price || 0)), 500000);

  if (!loading && !vendor) return (
    <div className="pt-36 text-center min-h-screen bg-black">
      <div className="text-center">
        <i className="fa-solid fa-store-slash text-4xl text-zinc-700 mb-4"></i>
        <p className="font-black uppercase text-zinc-500 text-lg italic">Boutique introuvable</p>
        <Link to="/store" className="mt-4 inline-block bg-primary text-black px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest">
          Explorer le Store
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">

      {/* VENDOR PROFILE HEADER */}
      <div className="pt-[116px]">
        <VendorHeader vendor={vendor} products={products} loading={loading} />
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 pb-20 mt-6">

        {/* SEARCH + FILTER BAR */}
        <div className="bg-zinc-950 border border-white/5 rounded-2xl p-4 mb-5 flex flex-col md:flex-row items-stretch md:items-center gap-3">

          {/* SEARCH */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={`Rechercher dans ${vendor?.shop_name || 'la boutique'}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 pl-10 text-sm font-bold text-white placeholder-zinc-500 outline-none focus:border-primary transition-colors"
            />
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm"></i>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* SORT */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="appearance-none bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 pr-8 text-[10px] font-black uppercase text-zinc-300 outline-none focus:border-primary cursor-pointer transition-colors"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-[10px] pointer-events-none"></i>
            </div>

            {/* FILTERS TOGGLE */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                showFilters ? 'bg-primary text-black border-primary' : 'bg-zinc-900 border-white/10 text-zinc-300 hover:border-primary/50'
              }`}
            >
              <i className="fa-solid fa-sliders text-xs"></i>
              <span className="hidden md:inline">Filtres</span>
            </button>

            {/* VIEW MODE */}
            <div className="flex bg-zinc-900 border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-3 transition-all ${viewMode === 'grid' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white'}`}
              >
                <i className="fa-solid fa-grid-2 text-xs"></i>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-3 transition-all ${viewMode === 'list' ? 'bg-primary text-black' : 'text-zinc-400 hover:text-white'}`}
              >
                <i className="fa-solid fa-list text-xs"></i>
              </button>
            </div>
          </div>
        </div>

        {/* PRICE FILTER (collapsible) */}
        {showFilters && (
          <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5 mb-5 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Budget Maximum</h4>
              <span className="text-[10px] font-black text-primary">{priceRange[1].toLocaleString()} FCFA</span>
            </div>
            <input
              type="range"
              min="0"
              max={maxPrice}
              step="5000"
              value={priceRange[1]}
              onChange={e => setPriceRange([0, Number(e.target.value)])}
              className="w-full accent-primary bg-zinc-800 h-1.5 rounded-full cursor-pointer"
            />
            <div className="flex justify-between mt-2 text-[9px] font-bold text-zinc-500">
              <span>0 FCFA</span>
              <span>{maxPrice.toLocaleString()} FCFA</span>
            </div>
          </div>
        )}

        {/* CATEGORY TABS */}
        {categories.items.length > 0 && (
          <div className="mb-5">
            <CategoryTabs
              categories={categories}
              active={activeCategory}
              onChange={setActiveCategory}
            />
          </div>
        )}

        {/* RESULTS COUNT + ACTIVE FILTERS */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              <span className="text-primary">{filteredProducts.length}</span> produits
              {activeCategory !== 'Tous' && <span className="ml-1">dans <span className="text-white">{activeCategory}</span></span>}
            </span>
            {(searchQuery || activeCategory !== 'Tous') && (
              <button
                onClick={() => { setSearchQuery(''); setActiveCategory('Tous'); }}
                className="text-[9px] font-black uppercase text-red-400 hover:text-red-300 transition-colors border border-red-500/20 px-2 py-1 rounded-lg"
              >
                <i className="fa-solid fa-xmark mr-1"></i>Reset
              </button>
            )}
          </div>
        </div>

        {/* PRODUCTS GRID / LIST */}
        {loading ? (
          <div className={`grid gap-4 ${viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
            {Array.from({ length: 10 }).map((_, i) => <ProductSkeleton key={i} />)}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-32 text-center border-2 border-dashed border-zinc-900 rounded-3xl">
            <i className="fa-solid fa-box-open text-4xl text-zinc-700 mb-4 block"></i>
            <p className="font-black italic uppercase text-zinc-500 text-lg mb-2">Aucun produit trouvé</p>
            <p className="text-zinc-600 text-sm font-bold mb-6">Essayez de changer vos filtres ou votre recherche</p>
            <button
              onClick={() => { setSearchQuery(''); setActiveCategory('Tous'); }}
              className="bg-primary text-black px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white transition-colors"
            >
              Voir tous les produits
            </button>
          </div>
        ) : viewMode === 'list' ? (
          /* LIST VIEW */
          <div className="space-y-3">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                className="bg-zinc-950 border border-white/5 rounded-2xl p-4 flex items-center gap-4 group hover:border-primary/30 transition-all cursor-pointer"
                onClick={() => openModal(product)}
              >
                <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-900">
                  <img src={product.img} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[8px] font-black uppercase text-primary border border-primary/30 bg-primary/10 px-2 py-0.5 rounded-full">{product.status}</span>
                    <span className="text-[8px] font-black uppercase text-zinc-500">{product.type}</span>
                  </div>
                  <h3 className="font-black uppercase italic tracking-tighter text-white truncate text-sm">{product.name}</h3>
                  {product.features?.length > 0 && (
                    <p className="text-[9px] text-zinc-500 font-bold truncate mt-0.5">{product.features.slice(0,2).join(' · ')}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <p className="font-black italic text-primary text-lg">{Number(product.price).toLocaleString()} <span className="text-xs">F</span></p>
                  <button
                    onClick={e => { e.stopPropagation(); addToCart({ ...product, selectedSize: 'M', selectedColor: 'Black', quantity: 1 }); }}
                    className="w-10 h-10 bg-primary text-black rounded-xl flex items-center justify-center font-black hover:scale-110 transition-transform"
                  >
                    <i className="fa-solid fa-plus text-sm"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* GRID VIEW */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                openModal={openModal}
                addToCart={addToCart}
              />
            ))}
          </div>
        )}

        {/* ── BACK TO MARKETPLACE ── */}
        <div className="mt-16 text-center">
          <Link
            to="/store"
            className="inline-flex items-center gap-3 bg-zinc-950 border border-white/10 hover:border-primary/40 text-zinc-300 hover:text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all group"
          >
            <i className="fa-solid fa-store text-primary text-sm group-hover:scale-110 transition-transform"></i>
            <span>Explorer la Marketplace</span>
            <i className="fa-solid fa-arrow-right text-xs group-hover:translate-x-1 transition-transform"></i>
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      `}</style>
    </div>
  );
};

export default ShopPage;