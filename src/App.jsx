import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LangProvider } from './context/LangContext';
import { useAuth } from './context/AuthContext';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CartSidebar from './components/CartSidebar';
import VisualSearchModal from './components/VisualSearchModal';
import WhatsAppButton from './components/WhatsAppButton';

// Pages
import Home from './pages/Home';
import Store from './pages/Store';
import Studio from './pages/Studio';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login.jsx';
import Register from './pages/Register';
import ShopPage from './pages/ShopPage.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import PrivateRoute from './routes/PrivateRoute';
import WishlistPage from './pages/WishlistPage.jsx';
import BoutiquesPage from './pages/BoutiquesPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import OFSRewardsPage from './pages/OFSRewardsPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import TrackingPage from './pages/TrackingPage.jsx';
import SuperAdmin from './pages/SuperAdmin.jsx';

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

  // Persist cart to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem('ofs_cart', JSON.stringify(cart)); } catch {}
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

          <Route
            path="/product/:productId"
            element={<ProductDetail addToCart={addToCart} openModal={openModal} />}
          />
          <Route element={<PrivateRoute />}>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/super-admin" element={<SuperAdmin />} />
          </Route>
        </Routes>
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
          <VisualSearchModal
            isOpen={isVisualSearchOpen}
            onClose={() => setIsVisualSearchOpen(false)}
            addToCart={addToCart}
          />
          <WhatsAppButton />
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