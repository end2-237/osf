import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ProductCard from '../components/ProductCard';
import { getVendorDiscountPercent } from '../utils/discountUtils';

/* ──────────────────────────────────────────────────────────────────────────
   Jetons de style — alignés sur la page Panier (panneaux blancs sur fond
   gris, liens teal, prix rouge, boutons pilule jaunes) et déclinés pour le
   thème sombre : chaque couleur a sa variante `dark:` pour que la page
   bascule avec le reste du site.
   ────────────────────────────────────────────────────────────────────────── */
const PAGE_BG  = 'bg-[#E3E6E6] dark:bg-black';
const PANEL    = 'bg-white dark:bg-zinc-900 dark:border dark:border-white/10';
const TXT      = 'text-[#0F1111] dark:text-white';
const MUTED    = 'text-[#565959] dark:text-zinc-400';
const FAINT    = 'text-[#767676] dark:text-zinc-500';
const LINK     = 'text-[#007185] hover:text-[#C7511F] dark:text-sky-400 dark:hover:text-primary transition-colors';
const PRICE    = 'text-[#B12704] dark:text-primary';
const OK       = 'text-[#007600] dark:text-emerald-400';
const DIV      = 'border-[#E7E7E7] dark:border-white/10';
const FIELD    = 'bg-white dark:bg-zinc-950 border border-[#888C8C] dark:border-white/15 focus:border-[#E77600] dark:focus:border-primary focus:outline-none focus:shadow-[0_0_0_3px_rgba(228,121,17,.25)] rounded-md text-[#0F1111] dark:text-white placeholder-[#767676] dark:placeholder-zinc-500 transition';
const BTN_YEL  = 'bg-[#FFD814] hover:bg-[#F7CA00] border border-[#FCD200] text-[#0F1111] dark:bg-primary dark:hover:bg-[#e58a00] dark:border-primary dark:text-black rounded-full transition shadow-[0_2px_5px_rgba(213,217,217,.5)] dark:shadow-none';
const BTN_GREY = 'bg-white hover:bg-[#F7FAFA] border border-[#D5D9D9] text-[#0F1111] dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:border-white/15 dark:text-white rounded-full transition shadow-[0_2px_5px_rgba(213,217,217,.5)] dark:shadow-none';
const SKELETON = 'bg-[#F0F2F2] dark:bg-zinc-800';

const fcfa = (n) => Number(n || 0).toLocaleString('fr-FR');

const SORT_OPTIONS = [
  { value: 'recent',     label: 'Plus récents' },
  { value: 'price-asc',  label: 'Prix croissant' },
  { value: 'price-desc', label: 'Prix décroissant' },
  { value: 'name',       label: 'Nom (A → Z)' },
];

const TYPE_ICONS = {
  'Audio Lab': 'fa-headphones',
  'Tech Lab': 'fa-microchip',
  'Clothing': 'fa-shirt',
  'Shoes': 'fa-shoe-prints',
  'Fragrance': 'fa-spray-can-sparkles',
  'Beauté': 'fa-spray-can-sparkles',
  'Accessories': 'fa-gem',
  'Femme': 'fa-person-dress',
  'Maison': 'fa-house',
  'Sport': 'fa-dumbbell',
  'Bébé & Enfants': 'fa-baby',
  'Auto': 'fa-car',
  'Bien-être': 'fa-spa',
  'Santé': 'fa-heart-pulse',
  'Nutrition': 'fa-apple-whole',
  'Alimentation': 'fa-basket-shopping',
  'Restauration': 'fa-burger',
};

/* ── SQUELETTES ─────────────────────────────────────────────────────────── */
const ProductSkeleton = () => (
  <div className="animate-pulse flex flex-col">
    <div className={`aspect-square w-full rounded-lg mb-2 ${SKELETON}`} />
    <div className={`h-3 rounded w-3/4 mb-1.5 ${SKELETON}`} />
    <div className={`h-3 rounded w-1/2 mb-2 ${SKELETON}`} />
    <div className={`h-7 rounded-full w-full ${SKELETON}`} />
  </div>
);

/* ── EN-TÊTE BOUTIQUE ───────────────────────────────────────────────────── */
const ShopHeader = ({ vendor, products, loading }) => {
  const categories = [...new Set(products.map(p => p.type))].filter(Boolean);
  const cheapest   = products.length
    ? Math.min(...products.map(p => Number(p.price) || 0))
    : 0;

  if (loading && !vendor) return (
    <div className={`${PANEL} p-4 md:p-6 animate-pulse`}>
      <div className={`h-[120px] md:h-[160px] rounded-lg mb-4 ${SKELETON}`} />
      <div className="flex items-end gap-4">
        <div className={`w-20 h-20 rounded-lg ${SKELETON}`} />
        <div className="flex-1 space-y-2">
          <div className={`h-5 rounded w-1/3 ${SKELETON}`} />
          <div className={`h-3 rounded w-1/4 ${SKELETON}`} />
        </div>
      </div>
    </div>
  );

  return (
    <div className={`${PANEL} overflow-hidden`}>
      {/* Bandeau de couverture */}
      <div className="relative h-[120px] md:h-[190px] bg-[#F0F2F2] dark:bg-zinc-950">
        {vendor?.cover_url ? (
          <img src={vendor.cover_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-[#232F3E] to-[#131921] flex items-center justify-center">
            <i className="fa-solid fa-store text-[#FF9900]/25 text-5xl" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
      </div>

      {/* Identité */}
      <div className="px-4 md:px-6 pb-4">
        <div className="flex items-end gap-4 -mt-10 relative">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden bg-white dark:bg-zinc-800 border-4 border-white dark:border-zinc-900 flex items-center justify-center flex-shrink-0 shadow-sm">
            {vendor?.logo_url
              ? <img src={vendor.logo_url} alt={vendor.shop_name} className="w-full h-full object-cover" />
              : <i className="fa-solid fa-store text-[#FF9900] text-2xl" />}
          </div>
          <div className="min-w-0 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className={`text-[22px] md:text-[28px] font-medium leading-tight truncate ${TXT}`}>
                {vendor?.shop_name || '…'}
              </h1>
              <span className={`inline-flex items-center gap-1 text-[11px] ${OK}`}>
                <i className="fa-solid fa-circle-check text-[10px]" />Boutique vérifiée
              </span>
            </div>
            <p className={`text-[13px] ${MUTED}`}>
              {vendor?.full_name}
              {vendor?.city && <> · {vendor.city}</>}
            </p>
          </div>
        </div>

        {/* Bandeau chiffres + remise */}
        <div className={`mt-4 pt-3 border-t ${DIV} flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]`}>
          <span className={MUTED}>
            <i className={`fa-solid fa-box mr-1.5 ${FAINT}`} />
            <b className={TXT}>{products.length}</b> produit{products.length > 1 ? 's' : ''}
          </span>
          {categories.length > 0 && (
            <span className={MUTED}>
              <i className={`fa-solid fa-tag mr-1.5 ${FAINT}`} />
              {categories.slice(0, 3).join(' · ')}
            </span>
          )}
          {cheapest > 0 && (
            <span className={MUTED}>
              À partir de <b className={PRICE}>{fcfa(cheapest)} FCFA</b>
            </span>
          )}
          <span className={MUTED}>
            <i className="fa-solid fa-truck-fast text-[#FF9900] mr-1.5" />
            Livraison à Douala
          </span>
          {vendor?.member_discount_enabled && (
            <span className={`inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-md bg-[#E8F5E8] dark:bg-emerald-500/10 border border-[#007600]/20 dark:border-emerald-400/25 ${OK}`}>
              <i className="fa-solid fa-tag text-[10px]" />
              Membres : −{getVendorDiscountPercent(vendor)} % sur toute la boutique
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── PAGE ───────────────────────────────────────────────────────────────── */
const ShopPage = ({ openModal, addToCart }) => {
  const { shopName } = useParams();
  const [searchParams] = useSearchParams();
  const autoModalDone = useRef(false);

  const [vendor,   setVendor]   = useState(null);
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const [searchQuery,    setSearchQuery]    = useState('');
  const [activeCategory, setActiveCategory] = useState('Tous');
  const [sortBy,         setSortBy]         = useState('recent');
  const [viewMode,       setViewMode]       = useState('grid');
  const [maxBudget,      setMaxBudget]      = useState(null);
  const [addedId,        setAddedId]        = useState(null);

  useEffect(() => {
    const fetchShopData = async () => {
      setLoading(true);
      try {
        const decoded = decodeURIComponent(shopName).trim();

        const { data: allVendors, error: vError } = await supabase
          .from('vendors')
          .select('*');
        if (vError) throw vError;

        const vendorData = allVendors?.find(
          v => v.shop_name.trim().toLowerCase() === decoded.toLowerCase()
        );
        if (!vendorData) throw new Error('Boutique introuvable');
        setVendor(vendorData);

        const { data: pData, error: pError } = await supabase
          .from('products')
          .select('*')
          .eq('vendor_id', vendorData.id)
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

  // Le produit courant porte les infos de remise de sa boutique.
  const withVendor = (p) => ({ ...p, vendor });

  // ─── Catégories dynamiques ───
  const categoryMap = products.reduce((acc, p) => {
    if (p.type) acc[p.type] = (acc[p.type] || 0) + 1;
    return acc;
  }, {});
  const categoryList = Object.entries(categoryMap)
    .map(([name, count]) => ({ name, count, icon: TYPE_ICONS[name] || 'fa-tag' }))
    .sort((a, b) => b.count - a.count);

  const maxPrice = products.length
    ? Math.max(...products.map(p => Number(p.price) || 0))
    : 0;
  const budget = maxBudget ?? maxPrice;

  const filteredProducts = products
    .filter(p => activeCategory === 'Tous' || p.type === activeCategory)
    .filter(p => !searchQuery || p.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(p => Number(p.price || 0) <= budget)
    .sort((a, b) => {
      if (sortBy === 'price-asc')  return Number(a.price) - Number(b.price);
      if (sortBy === 'price-desc') return Number(b.price) - Number(a.price);
      if (sortBy === 'name')       return (a.name || '').localeCompare(b.name || '');
      return 0;
    });

  const hasFilters = !!searchQuery || activeCategory !== 'Tous' || (maxBudget != null && maxBudget < maxPrice);
  const resetFilters = () => { setSearchQuery(''); setActiveCategory('Tous'); setMaxBudget(null); };

  const quickAdd = (p) => {
    addToCart({ ...withVendor(p), selectedSize: 'M', selectedColor: 'Black', quantity: 1 });
    setAddedId(p.id);
    setTimeout(() => setAddedId(null), 1500);
  };

  /* ── Boutique introuvable ── */
  if (!loading && !vendor) return (
    <div className={`min-h-screen ${PAGE_BG} p-3`}>
      <div className={`max-w-[1500px] mx-auto ${PANEL} p-10 flex flex-col sm:flex-row items-center gap-10`}>
        <div className={`w-40 h-40 rounded-full flex items-center justify-center flex-shrink-0 ${SKELETON}`}>
          <i className="fa-solid fa-store-slash text-[#D5D9D9] dark:text-zinc-600 text-6xl" />
        </div>
        <div>
          <h1 className={`text-[28px] font-bold leading-tight ${TXT}`}>Cette boutique est introuvable</h1>
          <p className={`text-sm mt-2 ${MUTED}`}>
            Le lien est peut-être erroné, ou la boutique n'est plus active.
          </p>
          <Link to="/store" className={`inline-block mt-4 text-sm font-medium px-8 py-2 ${BTN_YEL}`}>
            Explorer le store
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${PAGE_BG} p-2 md:p-3`}>
      <div className="max-w-[1500px] mx-auto space-y-2 md:space-y-3">

        {/* ═══ EN-TÊTE BOUTIQUE ═══ */}
        <ShopHeader vendor={vendor} products={products} loading={loading} />

        <div className="flex flex-col lg:flex-row gap-2 md:gap-3 items-start">

          {/* ═══ RAIL GAUCHE — filtres ═══ */}
          <aside className={`w-full lg:w-[260px] flex-shrink-0 lg:sticky lg:top-[136px] ${PANEL}`}>

            {/* Recherche */}
            <div className={`px-4 pt-4 pb-3 border-b ${DIV}`}>
              <p className={`text-[13px] font-bold mb-2 ${TXT}`}>Rechercher</p>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Dans cette boutique…"
                  className={`w-full pl-8 pr-7 py-1.5 text-[12px] ${FIELD}`}
                />
                <i className={`fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] ${FAINT}`} />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] ${FAINT} hover:text-[#0F1111] dark:hover:text-white`}>
                    <i className="fa-solid fa-xmark" />
                  </button>
                )}
              </div>
            </div>

            {/* Catégories */}
            {categoryList.length > 0 && (
              <div className={`px-4 py-3 border-b ${DIV}`}>
                <p className={`text-[13px] font-bold mb-2 ${TXT}`}>Catégories</p>
                <ul className="space-y-1">
                  <li>
                    <button onClick={() => setActiveCategory('Tous')}
                      className={`w-full flex items-center justify-between text-left text-[13px] py-0.5 ${
                        activeCategory === 'Tous' ? `font-bold ${TXT}` : LINK
                      }`}>
                      <span>Tous les produits</span>
                      <span className={`text-[11px] ${FAINT}`}>{products.length}</span>
                    </button>
                  </li>
                  {categoryList.map(cat => (
                    <li key={cat.name}>
                      <button onClick={() => setActiveCategory(cat.name)}
                        className={`w-full flex items-center justify-between gap-2 text-left text-[13px] py-0.5 ${
                          activeCategory === cat.name ? `font-bold ${TXT}` : LINK
                        }`}>
                        <span className="truncate">
                          <i className={`fa-solid ${cat.icon} mr-1.5 text-[10px] opacity-60`} />
                          {cat.name}
                        </span>
                        <span className={`text-[11px] flex-shrink-0 ${FAINT}`}>{cat.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Budget */}
            {maxPrice > 0 && (
              <div className={`px-4 py-3 border-b ${DIV}`}>
                <p className={`text-[13px] font-bold mb-2 ${TXT}`}>Budget maximum</p>
                <input
                  type="range"
                  min={0}
                  max={maxPrice}
                  step={Math.max(500, Math.round(maxPrice / 100))}
                  value={budget}
                  onChange={e => setMaxBudget(Number(e.target.value))}
                  className="w-full accent-[#FF9900] cursor-pointer"
                />
                <div className={`flex justify-between text-[11px] mt-1 ${FAINT}`}>
                  <span>0 F</span>
                  <span className={`font-bold ${PRICE}`}>{fcfa(budget)} F</span>
                </div>
              </div>
            )}

            {/* Réinitialiser */}
            {hasFilters && (
              <div className={`px-4 py-3 border-b ${DIV}`}>
                <button onClick={resetFilters} className={`w-full text-[12px] py-1.5 ${BTN_GREY}`}>
                  <i className="fa-solid fa-rotate-left mr-1.5 text-[10px]" />
                  Réinitialiser les filtres
                </button>
              </div>
            )}

            {/* Réassurance */}
            <div className={`px-4 py-3 space-y-1.5 text-[12px] ${MUTED}`}>
              <p><i className={`fa-solid fa-shield-halved w-4 mr-1 ${OK}`} />Paiement sécurisé</p>
              <p><i className="fa-solid fa-truck-fast w-4 mr-1 text-[#FF9900]" />Livraison express Douala</p>
              <p><i className={`fa-solid fa-rotate-left w-4 mr-1 ${LINK}`} />Retour sous 7 jours</p>
            </div>
          </aside>

          {/* ═══ COLONNE PRINCIPALE ═══ */}
          <div className="flex-1 min-w-0 w-full space-y-2 md:space-y-3">

            {/* Barre d'outils + résultats */}
            <div className={`${PANEL} px-4 md:px-6 pt-4 pb-3`}>
              <div className={`flex flex-wrap items-end justify-between gap-3 border-b ${DIV} pb-2`}>
                <div className="min-w-0">
                  <h2 className={`text-[22px] md:text-[26px] font-medium leading-none ${TXT}`}>
                    {activeCategory === 'Tous' ? 'Tous les produits' : activeCategory}
                  </h2>
                  <p className={`text-[13px] mt-1 ${MUTED}`}>
                    {loading
                      ? 'Chargement…'
                      : <><b className={TXT}>{filteredProducts.length}</b> résultat{filteredProducts.length > 1 ? 's' : ''}
                          {searchQuery && <> pour « {searchQuery} »</>}</>}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className={`text-[12px] hidden sm:inline ${MUTED}`}>Trier par</label>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className={`text-[12px] px-2.5 py-1.5 cursor-pointer ${FIELD}`}
                  >
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>

                  <div className={`inline-flex rounded-md overflow-hidden border border-[#D5D9D9] dark:border-white/15`}>
                    <button onClick={() => setViewMode('grid')} title="Grille"
                      className={`w-8 h-[30px] text-[11px] transition ${
                        viewMode === 'grid'
                          ? 'bg-[#FFD814] dark:bg-primary text-[#0F1111] dark:text-black'
                          : `bg-white dark:bg-zinc-950 ${MUTED} hover:bg-[#F7FAFA] dark:hover:bg-zinc-800`
                      }`}>
                      <i className="fa-solid fa-table-cells" />
                    </button>
                    <button onClick={() => setViewMode('list')} title="Liste"
                      className={`w-8 h-[30px] text-[11px] border-l border-[#D5D9D9] dark:border-white/15 transition ${
                        viewMode === 'list'
                          ? 'bg-[#FFD814] dark:bg-primary text-[#0F1111] dark:text-black'
                          : `bg-white dark:bg-zinc-950 ${MUTED} hover:bg-[#F7FAFA] dark:hover:bg-zinc-800`
                      }`}>
                      <i className="fa-solid fa-list" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Filtres actifs */}
              {hasFilters && !loading && (
                <div className={`flex flex-wrap items-center gap-2 py-2.5 border-b ${DIV} text-[12px]`}>
                  <span className={MUTED}>Filtres :</span>
                  {activeCategory !== 'Tous' && (
                    <button onClick={() => setActiveCategory('Tous')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#D5D9D9] dark:border-white/15 ${TXT}`}>
                      {activeCategory}<i className="fa-solid fa-xmark text-[10px] opacity-60" />
                    </button>
                  )}
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#D5D9D9] dark:border-white/15 ${TXT}`}>
                      « {searchQuery} »<i className="fa-solid fa-xmark text-[10px] opacity-60" />
                    </button>
                  )}
                  {maxBudget != null && maxBudget < maxPrice && (
                    <button onClick={() => setMaxBudget(null)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#D5D9D9] dark:border-white/15 ${TXT}`}>
                      ≤ {fcfa(maxBudget)} F<i className="fa-solid fa-xmark text-[10px] opacity-60" />
                    </button>
                  )}
                  <button onClick={resetFilters} className={`text-[12px] ${LINK}`}>Tout effacer</button>
                </div>
              )}

              {/* Résultats */}
              <div className="pt-4">
                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
                    {Array.from({ length: 10 }).map((_, i) => <ProductSkeleton key={i} />)}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="py-16 text-center">
                    <i className="fa-solid fa-box-open text-5xl mb-4 block text-[#D5D9D9] dark:text-zinc-700" />
                    <p className={`text-[17px] font-bold mb-1 ${TXT}`}>Aucun produit ne correspond</p>
                    <p className={`text-[13px] mb-5 ${MUTED}`}>
                      {products.length === 0
                        ? "Cette boutique n'a pas encore publié de produit."
                        : 'Essayez une autre catégorie, un autre mot-clé ou un budget plus large.'}
                    </p>
                    {products.length > 0 && (
                      <button onClick={resetFilters} className={`text-[13px] font-medium px-6 py-1.5 ${BTN_YEL}`}>
                        Voir tous les produits
                      </button>
                    )}
                  </div>
                ) : viewMode === 'list' ? (
                  /* ── VUE LISTE ── */
                  <div className={`divide-y ${DIV}`}>
                    {filteredProducts.map(product => (
                      <div key={product.id} className="flex gap-3 sm:gap-4 py-4">
                        <button onClick={() => openModal(withVendor(product))}
                          className="w-[96px] h-[96px] sm:w-[140px] sm:h-[140px] flex-shrink-0 flex items-center justify-center bg-white dark:bg-zinc-950 rounded-md overflow-hidden">
                          <img src={product.img} alt={product.name}
                            className="max-w-full max-h-full object-contain mix-blend-multiply dark:mix-blend-normal" />
                        </button>

                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex items-start justify-between gap-3">
                            <button onClick={() => openModal(withVendor(product))}
                              className={`text-left text-[14px] sm:text-[16px] leading-snug line-clamp-2 ${LINK}`}>
                              {product.name}
                            </button>
                            <p className={`text-[15px] sm:text-[17px] font-bold leading-none flex-shrink-0 ${PRICE}`}>
                              {fcfa(product.price)}<span className="text-[10px] align-top ml-0.5">FCFA</span>
                            </p>
                          </div>

                          <p className={`text-[12px] mt-1 ${MUTED}`}>{product.type}</p>
                          {product.features?.length > 0 && (
                            <p className={`text-[12px] truncate mt-0.5 ${FAINT}`}>
                              {product.features.slice(0, 3).join(' · ')}
                            </p>
                          )}

                          <div className="flex items-center gap-2.5 flex-wrap mt-1 text-[12px]">
                            <span className={`inline-flex items-center gap-1 ${product.status === 'Épuisé' ? PRICE : OK}`}>
                              <i className={`fa-solid ${product.status === 'Épuisé' ? 'fa-circle-xmark' : 'fa-circle-check'} text-[10px]`} />
                              {product.status === 'Épuisé' ? 'Épuisé' : 'En stock'}
                            </span>
                            <span className="text-[#D5D9D9] dark:text-white/15">|</span>
                            <span className={`inline-flex items-center gap-1 ${MUTED}`}>
                              <i className="fa-solid fa-truck-fast text-[#FF9900] text-[10px]" />
                              Livraison à Douala
                            </span>
                          </div>

                          <div className="mt-2.5">
                            <button onClick={() => quickAdd(product)}
                              disabled={product.status === 'Épuisé'}
                              className={`text-[12px] font-medium px-5 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                                addedId === product.id
                                  ? 'bg-[#E8F5E8] dark:bg-emerald-500/15 border border-[#007600]/30 dark:border-emerald-400/30 text-[#007600] dark:text-emerald-400 rounded-full transition'
                                  : BTN_YEL
                              }`}>
                              {addedId === product.id
                                ? <><i className="fa-solid fa-circle-check mr-1.5 text-[11px]" />Ajouté !</>
                                : 'Ajouter au panier'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* ── VUE GRILLE ── */
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
                    {filteredProducts.map(product => (
                      <ProductCard
                        key={product.id}
                        product={withVendor(product)}
                        openModal={openModal}
                        addToCart={addToCart}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Retour marketplace */}
            <div className={`${PANEL} px-4 md:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3`}>
              <div className="text-center sm:text-left">
                <p className={`text-[15px] font-bold ${TXT}`}>Envie de découvrir d'autres boutiques ?</p>
                <p className={`text-[13px] ${MUTED}`}>Des centaines de vendeurs vérifiés vous attendent sur Buyticle.</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link to="/boutiques" className={`text-[13px] font-medium px-5 py-1.5 ${BTN_GREY}`}>
                  Toutes les boutiques
                </Link>
                <Link to="/store" className={`text-[13px] font-medium px-5 py-1.5 ${BTN_YEL}`}>
                  Explorer le store
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopPage;
