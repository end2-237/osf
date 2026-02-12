import React from "react";
import { Link } from "react-router-dom";

const ProductCard = ({ product, openModal, addToCart }) => {
  const handleQuickBuy = (e) => {
    e.stopPropagation(); // Empêche l'ouverture du modal lors du clic sur le bouton
    addToCart({
      ...product,
      selectedSize: product.type === "Shoes" ? "42" : "M",
      selectedColor: "Black",
      quantity: 1,
    });
  };

  const handleOpenDetails = (e) => {
    e.stopPropagation(); // Évite les conflits de clics
    openModal(product.id);
  };

  return (
    <div className="product-card group relative cursor-pointer">
      <div className="aspect-[3/4] overflow-hidden bg-zinc-100 dark:bg-zinc-900 rounded-[1.5rem] md:rounded-[2rem] mb-3 relative shadow-xl">
        {/* Statut du produit */}
        <span className="absolute top-3 left-3 z-10 bg-black text-white dark:bg-primary dark:text-black px-2 py-0.5 text-[7px] md:text-[8px] font-black uppercase tracking-widest">
          {product.status}
        </span>
        
        <img 
          src={product.img} 
          className="w-full h-full object-cover transition duration-1000 group-hover:scale-110" 
          loading="lazy" 
          alt={product.name} 
        />
        
        {/* Overlay : Visible uniquement au toucher ou survol (group-hover) */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-3 md:p-6 space-y-2">
          <Link 
            to="/studio" 
            state={{ productId: product.id }} 
            onClick={(e) => e.stopPropagation()} 
            className="bg-white text-black w-full py-2.5 md:py-3 font-black uppercase text-[8px] md:text-[9px] text-center hover:bg-primary transition shadow-lg"
          >
            Personalize
          </Link>
          <button 
            onClick={handleQuickBuy} 
            className="bg-primary text-black w-full py-2.5 md:py-3 font-black uppercase text-[8px] md:text-[9px] shadow-lg active:scale-95 transition"
          >
            Quick Buy
          </button>
        </div>
      </div>
      
      {/* Infos produit */}
      <div className="px-1 flex justify-between items-start">
        <div className="max-w-[65%]">
          {/* Titre cliquable pour voir les détails */}
          <h3 
            onClick={handleOpenDetails}
            className="font-black text-[10px] md:text-sm uppercase italic tracking-tighter leading-tight truncate hover:text-primary transition-colors cursor-help"
          >
            {product.name}
          </h3>
          <p className="text-[7px] md:text-[9px] text-zinc-500 font-bold uppercase mt-0.5 underline decoration-primary underline-offset-2">
            {product.type}
          </p>
        </div>
        <p className="font-black text-[10px] md:text-base italic text-primary">
          {product.price?.toLocaleString()} <span className="text-[7px] md:text-[10px]">F</span>
        </p>
      </div>
    </div>
  );
};

export default ProductCard;