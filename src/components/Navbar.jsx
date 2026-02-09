import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Navbar = ({ isDark, toggleTheme, cartCount, toggleCart }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-[100] bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b dark:border-zinc-800 px-4 md:px-8 py-5">
      <div className="max-w-[1600px] mx-auto flex justify-between items-center">
        <div className="logo-font font-bold text-xl md:text-2xl uppercase tracking-tighter">
          OneFree<span className="text-primary italic">Style</span>
        </div>
        <ul className="hidden lg:flex space-x-10 text-[11px] font-black uppercase tracking-[0.3em]">
          <li><Link to="/" className="hover:text-primary transition">Home</Link></li>
          <li><Link to="/studio" className="text-primary font-bold transition">Studio Lab</Link></li>
          <li><Link to="/trends" className="hover:text-primary transition">Trends</Link></li>
          <li><Link to="/store" className="hover:text-primary transition">Store</Link></li>
        </ul>
        <div className="flex items-center space-x-4 md:space-x-6">
          <button onClick={toggleTheme}>
            <i className={`fa-solid ${isDark ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          <div className="relative cursor-pointer" onClick={toggleCart}>
            <i className="fa-solid fa-cart-shopping text-xl"></i>
            <span className="absolute -top-3 -right-3 bg-primary text-black text-[10px] font-black px-2 py-0.5 rounded-full">
              {cartCount}
            </span>
          </div>
          <button className="lg:hidden text-xl" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <i className="fa-solid fa-bars-staggered"></i>
          </button>
        </div>
      </div>
      <div className={`${mobileMenuOpen ? 'block' : 'hidden'} lg:hidden absolute top-full left-0 w-full bg-white dark:bg-black border-b dark:border-zinc-800 p-6 space-y-4 text-center font-bold uppercase text-xs tracking-widest`}>
        <Link to="/" className="block">Home</Link>
        <Link to="/store" className="block text-primary">Store</Link>
        <Link to="/trends" className="block">Trends</Link>
        <Link to="/studio" className="block">Studio Lab</Link>
      </div>
    </nav>
  );
};

export default Navbar;
