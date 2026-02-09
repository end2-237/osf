import React from "react";
import { Link } from "react-router-dom";

const ProductCard = ({ product, openModal, addToCart }) => {
  const handleQuickBuy = (e) => {
    e.stopPropagation();
    addToCart({
      ...product,
      selectedSize: product.type === "Shoes" ? "42" : "M",
      selectedColor: "Black",
      quantity: 1,
    });
  };

  return (
    <div
      className="product-card group relative cursor-pointer"
      onClick={() => openModal(product.id)}
    >
      <div className="aspect-[3/4] overflow-hidden bg-zinc-100 dark:bg-zinc-900 rounded-[2rem] mb-4 relative shadow-2xl">
        <span className="absolute top-5 left-5 z-10 bg-black text-white dark:bg-primary dark:text-black px-4 py-1 text-[8px] font-black uppercase tracking-widest">
          {product.status}
        </span>
        <img
          src={product.img}
          className="w-full h-full object-cover transition duration-1000 group-hover:scale-110"
          loading="lazy"
          alt={product.name}
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-8 space-y-3">
          {/* Nouveau Bouton Personnalize */}

          <Link
            to="/studio"
            state={{ productId: product.id }} // On envoie l'ID pour charger la vraie image
            onClick={(e) => e.stopPropagation()}
            className="bg-white text-black w-full py-4 font-black uppercase text-[10px] tracking-widest text-center transform translate-y-8 group-hover:translate-y-0 transition duration-500 hover:bg-primary"
          >
            Personalize Lab
          </Link>

          <button
            onClick={handleQuickBuy}
            className="bg-primary text-black w-full py-4 font-black uppercase text-[10px] tracking-widest transform translate-y-8 group-hover:translate-y-0 transition duration-500"
          >
            Quick Buy
          </button>
        </div>
      </div>
      <div className="px-2 flex justify-between items-start">
        <div>
          <h3 className="font-black text-sm uppercase italic tracking-tighter leading-tight">
            {product.name}
          </h3>
          <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1 underline decoration-primary underline-offset-2">
            {product.type}
          </p>
        </div>
        <p className="font-black text-base italic text-primary">
          {product.price.toLocaleString()} FCFA
        </p>
      </div>
    </div>
  );
};

export default ProductCard;
