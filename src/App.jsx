import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LangProvider } from './context/LangContext';
import { useAuth } from './context/AuthContext';

// Components always needed — not lazy
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CartSidebar from './components/CartSidebar';
import WhatsAppButton from './components/WhatsAppButton';
import OFSAssistant from './components/OFSAssistant';
import PrivateRoute from './routes/PrivateRoute';
import SuperAdminRoute from './routes/SuperAdminRoute';

// Heavy modal — lazy
const VisualSearchModal = lazy(() => import('./components/VisualSearchModal'));

// Critical path pages — eager
import Home from './pages/Home';
import Login from './pages/Login.jsx';
import Register from './pages/Register';

// All other pages — lazy (separate JS chunk per page)
const Store          = lazy(() => import('./pages/Store'));
const Studio         = lazy(() => import('./pages/Studio'));
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const ShopPage       = lazy(() => import('./pages/ShopPage.jsx'));
const ProductDetail  = lazy(() => import('./pages/ProductDetail.jsx'));
const WishlistPage   = lazy(() => import('./pages/WishlistPage.jsx'));
const BoutiquesPage  = lazy(() => import('./pages/BoutiquesPage.jsx'));
const ProfilePage    = lazy(() => import('./pages/ProfilePage.jsx'));
const OFSRewardsPage = lazy(() => import('./pages/OFSRewardsPage.jsx'));
const SearchPage     = lazy(() => import('./pages/SearchPage.jsx'));
const TrackingPage   = lazy(() => import('./pages/TrackingPage.jsx'));
const SuperAdmin     = lazy(() => import('./pages/SuperAdmin.jsx'));
const AffiliateRedirect = lazy(() => import('./pages/AffiliateRedirect.jsx'));
const CartPage       = lazy(() => import('./pages/CartPage.jsx'));
const NotFound       = lazy(() => import('./pages/NotFound.jsx'));
const CGVPage        = lazy(() => import('./pages/CGVPage.jsx'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 border-4 border-[#FF9900] border-t-transparent rounded-full animate-spin" />
  </div>
);

function AppContent() {
  const { vendor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Configuration du thème et panier
  const [isDark, setIsDark] = useState(false);
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ofs_cart') || '[]'); } catch { return []; }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isVisualSearchOpen, setIsVisualSearchOpen] = useState(false);
  const sharedCartLoaded = useRef(false);

  // Pages sans Navbar / Footer / Cart (auth + dashboards admin)
  const isAuthPage = location.pathname === '/login'
    || location.pathname === '/register'
    || location.pathname === '/admin'
    || location.pathname.startsWith('/super-admin')
    || location.pathname === '/track';

  // Listen for CartPage "checkout" event and open cart sidebar
  useEffect(() => {
    const handler = () => setIsCartOpen(true);
    window.addEventListener('ofs:openCart', handler);
    return () => window.removeEventListener('ofs:openCart', handler);
  }, []);

  // Sync App cart state when CartPage modifies localStorage
  useEffect(() => {
    const handler = () => {
      try { setCart(JSON.parse(localStorage.getItem('ofs_cart') || '[]')); } catch {}
    };
    window.addEventListener('ofs:cartUpdated', handler);
    return () => window.removeEventListener('ofs:cartUpdated', handler);
  }, []);

  // Close cart drawer when navigating to /cart full page
  useEffect(() => {
    if (location.pathname === '/cart') setIsCartOpen(false);
  }, [location.pathname]);

  // Persist cart to localStorage + track last-modified time for abandoned-cart detection
  useEffect(() => {
    try {
      localStorage.setItem('ofs_cart', JSON.stringify(cart));
      if (cart.length > 0) localStorage.setItem('ofs_cart_ts', Date.now().toString());
      else localStorage.removeItem('ofs_cart_ts');
    } catch {}
  }, [cart]);

  // Load shared cart from URL ?cart=BASE64 (once per session)
  useEffect(() => {
    if (sharedCartLoaded.current) return;
    sharedCartLoaded.current = true;
    const params = new URLSearchParams(location.search);
    const encoded = params.get('cart');
    if (!encoded) return;
    try {
      const items = JSON.parse(atob(encoded));
      if (Array.isArray(items) && items.length > 0) {
        setCart(items);
        setIsCartOpen(true);
        const url = new URL(window.location.href);
        url.searchParams.delete('cart');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
  }, [location.search]);

  useEffect(() => {
    isDark
      ? document.documentElement.classList.add('dark')
      : document.documentElement.classList.remove('dark');
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);
  const toggleCart = () => setIsCartOpen(!isCartOpen);
  const toggleVisualSearch = () => setIsVisualSearchOpen(!isVisualSearchOpen);

  const addToCart = (productData) => {
    const existingIndex = cart.findIndex(
      (item) =>
        item.id === productData.id &&
        item.selectedSize === productData.selectedSize &&
        item.selectedColor === productData.selectedColor
    );
    if (existingIndex > -1) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += productData.quantity;
      setCart(newCart);
    } else {
      setCart([...cart, productData]);
    }
    setIsCartOpen(true);
  };

  const updateQuantity = (index, delta) => {
    const newCart = [...cart];
    newCart[index].quantity = Math.max(1, newCart[index].quantity + delta);
    setCart(newCart);
  };

  const removeFromCart = (index) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const clearCart = () => setCart([]);

  const shareCart = () => {
    const FIELDS = ['id','name','price','img','quantity','selectedSize','selectedColor',
      'vendor_id','vendor_member_discount_enabled','cj_product_id','weight_g','ship_weight_g'];
    const minimal = cart.map(item =>
      Object.fromEntries(FIELDS.filter(k => item[k] != null).map(k => [k, item[k]]))
    );
    return `${window.location.origin}/store?cart=${btoa(JSON.stringify(minimal))}`;
  };

  const openModal = (productOrId) => {
    if (typeof productOrId === 'object' && productOrId !== null) {
      navigate(`/product/${productOrId.id}`, { state: { product: productOrId } });
    } else if (productOrId) {
      navigate(`/product/${productOrId}`);
    }
  };

  return (
    <div className="bg-white text-zinc-900 dark:bg-black dark:text-white transition-colors duration-500 min-h-screen flex flex-col">
      
      {/* HEADER : Masqué sur Login/Register */}
      {!isAuthPage && (
        <Navbar
          isDark={isDark}
          toggleTheme={toggleTheme}
          cartCount={cart.reduce((total, item) => total + item.quantity, 0)}
          toggleCart={toggleCart}
          toggleVisualSearch={toggleVisualSearch}
        />
      )}

      {/* ZONE DE CONTENU PRINCIPALE */}
      <main className="flex-grow">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home openModal={openModal} addToCart={addToCart} />} />
            <Route path="/store" element={<Store openModal={openModal} addToCart={addToCart} />} />
            <Route path="/studio" element={<Studio />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/shop/:shopName" element={<ShopPage openModal={openModal} addToCart={addToCart} />} />
            <Route path="/wishlist" element={<WishlistPage openModal={openModal} addToCart={addToCart} />} />
            <Route path="/search" element={<SearchPage openModal={openModal} addToCart={addToCart} />} />
            <Route path="/boutiques" element={<BoutiquesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/rewards" element={<OFSRewardsPage />} />
            <Route path="/track" element={<TrackingPage />} />
            <Route path="/ref/:code" element={<AffiliateRedirect />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/cgv" element={<CGVPage />} />
            <Route path="/terms" element={<CGVPage />} />

            <Route
              path="/product/:productId"
              element={<ProductDetail addToCart={addToCart} openModal={openModal} />}
            />
            <Route element={<PrivateRoute />}>
              <Route path="/admin" element={<Dashboard />} />
            </Route>
            <Route element={<SuperAdminRoute />}>
              <Route path="/super-admin" element={<SuperAdmin />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>

      {/* FOOTER : Masqué sur Login/Register */}
      {!isAuthPage && <Footer />}

      {/* OVERLAYS & MODALS : Masqués sur Login/Register pour éviter les conflits de design */}
      {!isAuthPage && (
        <>
          <CartSidebar
            isOpen={isCartOpen}
            cart={cart}
            removeFromCart={removeFromCart}
            updateQuantity={updateQuantity}
            toggleCart={toggleCart}
            clearCart={clearCart}
            shareCart={shareCart}
            vendor={vendor}
          />
          <Suspense fallback={null}>
            <VisualSearchModal
              isOpen={isVisualSearchOpen}
              onClose={() => setIsVisualSearchOpen(false)}
              addToCart={addToCart}
            />
          </Suspense>
          <WhatsAppButton />
          <OFSAssistant addToCart={addToCart} />
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </LangProvider>
  );
}

export default App;