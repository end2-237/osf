import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProductModal from './components/ProductModal';
import CartSidebar from './components/CartSidebar';
import Home from './pages/Home';
import Store from './pages/Store';
import Studio from './pages/Studio';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login.jsx';
import Register from './pages/Register';
import ShopPage from './pages/ShopPage.jsx';
import PrivateRoute from './routes/PrivateRoute';
import { products as staticProducts } from './data/products';

function AppContent() {
  const { vendor } = useAuth();
  const [isDark, setIsDark] = useState(false);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  // ✅ Stocke l'objet produit COMPLET (plus juste l'ID)
  const [modalProduct, setModalProduct] = useState(null);

  useEffect(() => {
    isDark
      ? document.documentElement.classList.add('dark')
      : document.documentElement.classList.remove('dark');
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);
  const toggleCart = () => setIsCartOpen(!isCartOpen);

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

  /**
   * ✅ openModal accepte :
   * - Un objet produit complet (depuis ShopPage, ProductCard vendeur)
   * - Un ID numérique (depuis AudioAds, TechProducts qui utilisent les produits statiques)
   */
  const openModal = (productOrId) => {
    if (typeof productOrId === 'object' && productOrId !== null) {
      setModalProduct(productOrId);
    } else {
      const found = staticProducts.find(p => p.id === productOrId);
      setModalProduct(found || null);
    }
  };

  const closeModal = () => setModalProduct(null);

  return (
    <div className="bg-white text-zinc-900 dark:bg-black dark:text-white transition-colors duration-500 min-h-screen flex flex-col">
      <Navbar
        isDark={isDark}
        toggleTheme={toggleTheme}
        cartCount={cart.reduce((total, item) => total + item.quantity, 0)}
        toggleCart={toggleCart}
      />

      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home openModal={openModal} addToCart={addToCart} />} />
          <Route path="/store" element={<Store openModal={openModal} addToCart={addToCart} />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/shop/:shopName" element={<ShopPage openModal={openModal} addToCart={addToCart} />} />
          <Route element={<PrivateRoute />}>
            <Route path="/admin" element={<Dashboard />} />
          </Route>
        </Routes>
      </main>

      <Footer />

      {/* ✅ ProductModal reçoit l'objet produit complet */}
      <ProductModal
        isOpen={modalProduct !== null}
        product={modalProduct}
        closeModal={closeModal}
        addToCart={addToCart}
      />

      <CartSidebar
        isOpen={isCartOpen}
        cart={cart}
        removeFromCart={removeFromCart}
        updateQuantity={updateQuantity}
        toggleCart={toggleCart}
        clearCart={clearCart}
        vendor={vendor}
      />
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