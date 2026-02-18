import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CartSidebar from './components/CartSidebar';
import VisualSearchModal from './components/VisualSearchModal';

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

function AppContent() {
  const { vendor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Configuration du thème et panier
  const [isDark, setIsDark] = useState(false);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isVisualSearchOpen, setIsVisualSearchOpen] = useState(false);

  // Détection des pages d'authentification pour isoler le layout
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

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
      <main className={`flex-grow ${isAuthPage ? 'h-screen overflow-hidden' : ''}`}>
        <Routes>
          <Route path="/" element={<Home openModal={openModal} addToCart={addToCart} />} />
          <Route path="/store" element={<Store openModal={openModal} addToCart={addToCart} />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/shop/:shopName" element={<ShopPage openModal={openModal} addToCart={addToCart} />} />
          <Route
            path="/product/:productId"
            element={<ProductDetail addToCart={addToCart} openModal={openModal} />}
          />
          <Route element={<PrivateRoute />}>
            <Route path="/admin" element={<Dashboard />} />
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
            vendor={vendor}
          />
          <VisualSearchModal
            isOpen={isVisualSearchOpen}
            onClose={() => setIsVisualSearchOpen(false)}
            addToCart={addToCart}
          />
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;