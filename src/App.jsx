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
import PrivateRoute from './routes/PrivateRoute';

// ✅ Composant interne qui peut utiliser useAuth (il est DANS AuthProvider)
function AppContent() {
  const { vendor } = useAuth(); // ← useAuth ici, pas dans App

  const [isDark, setIsDark] = useState(false);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [modalProductId, setModalProductId] = useState(null);

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

  const clearCart = () => {
    setCart([]);
  };

  const openModal = (productId) => setModalProductId(productId);
  const closeModal = () => setModalProductId(null);

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
          {/* ROUTES PUBLIQUES */}
          <Route path="/" element={<Home openModal={openModal} addToCart={addToCart} />} />
          <Route path="/store" element={<Store openModal={openModal} addToCart={addToCart} />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* ROUTES PRIVÉES */}
          <Route element={<PrivateRoute />}>
            <Route path="/admin" element={<Dashboard />} />
          </Route>
        </Routes>
      </main>

      <Footer />

      <ProductModal
        isOpen={modalProductId !== null}
        productId={modalProductId}
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
        vendor={vendor} // ✅ passé correctement
      />
    </div>
  );
}

// ✅ App enveloppe AuthProvider + Router, AppContent est à l'intérieur
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