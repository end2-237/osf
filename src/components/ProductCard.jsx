import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const MEMBER_DISCOUNT = 0.20;

const ProductCard = ({ product, openModal, addToCart }) => {
  const { user, isMember } = useAuth();

  const originalPrice = Number(product.price) || 0;

  const vendorHasPromo =
    product.vendor?.member_discount_enabled ??
    product.vendor_member_discount_enabled ??
    false;

  const discountActive = isMember && vendorHasPromo;
  const memberPrice = discountActive
    ? Math.round(originalPrice * (1 - MEMBER_DISCOUNT))
    : originalPrice;

  const handleQuickBuy = (e) => {
    e.stopPropagation();
    addToCart({
      ...product,
      price: memberPrice,
      vendor_member_discount_enabled: vendorHasPromo,
      selectedSize: product.type === "Shoes" ? "42" : "M",
      selectedColor: "Black",
      quantity: 1,
    });
  };

  return (
    <div className="product-card group relative cursor-pointer hover:z-10">

      {/* IMAGE */}
      <div
        className="aspect-[3/4] overflow-hidden bg-zinc-100 dark:bg-zinc-900 rounded-[1.5rem] md:rounded-[2rem] mb-3 relative shadow-xl"
        onClick={() => openModal(product)}
      >
        {/* STATUT */}
        <span className="absolute top-3 left-3 z-10 bg-black text-white dark:bg-primary dark:text-black px-2 py-0.5 text-[7px] md:text-[8px] font-black uppercase tracking-widest">
          {product.status}
        </span>

        {/* BADGE PROMO */}
        {vendorHasPromo && (
          <span className={`absolute top-3 right-3 z-10 px-2 py-0.5 text-[7px] md:text-[8px] font-black uppercase tracking-widest ${
            isMember
              ? "bg-primary text-black"
              : "bg-black/70 text-primary border border-primary/40"
          }`}>
            {isMember ? "−20% toi" : "−20% membres"}
          </span>
        )}

        <img
          src={product.img}
          className="w-full h-full object-cover transition duration-1000 group-hover:scale-110"
          loading="lazy"
          alt={product.name}
        />

        {/* OVERLAY HOVER */}
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
            {discountActive
              ? `Quick Buy — ${memberPrice.toLocaleString()} F`
              : "Quick Buy"}
          </button>

          {/* Teaser visiteurs */}
          {vendorHasPromo && !user && (
            <Link
              to="/register"
              onClick={(e) => e.stopPropagation()}
              className=" border-[1px] rounded-none border-primary/40 px-2 py-0.5 text-center text-[6px] font-black uppercase text-primary/80 hover:text-primary transition"
            >
              Prix membre : {Math.round(originalPrice * (1 - MEMBER_DISCOUNT)).toLocaleString()} F
            </Link>
          )}
        </div>
      </div>

      {/* INFOS */}
      <div onClick={() => openModal(product)}>
        <p className="text-[6px] md:text-[8px] font-black underline-offset-2 underline decoration-primary uppercase text-zinc-600 dark:text-zinc-700 tracking-widest truncate mb-0.5">
          {product.type}
        </p>
        <h3 className="font-black italic uppercase text-[10px] md:text-[11px] tracking-tighter text-zinc-900 dark:text-white leading-tight truncate">
          {product.name}
        </h3>

        {/* PRIX */}
        <div className="flex items-baseline gap-2 mt-1.5">
          {discountActive ? (
            <>
              <span className="font-black italic text-sm md:text-base text-primary">
                {memberPrice.toLocaleString()} F
              </span>
              <span className="text-[9px] font-bold text-zinc-400 line-through">
                {originalPrice.toLocaleString()} F
              </span>
            </>
          ) : (
            <>
              <span className="font-black text-sm md:text-base/12 text-zinc-900 dark:text-white">
                {originalPrice.toLocaleString()} F
              </span>
              {vendorHasPromo && !user && (
                <Link
                  to="/register"
                  onClick={(e) => e.stopPropagation()}
                  className="border-[1px] rounded-none border-primary/40 px-2 py-0.5 text-center text-[10px] font-black uppercase text-primary/80 hover:text-primary transition"
                  title="Créer un compte pour bénéficier du prix membre"
                >
                  {Math.round(originalPrice * (1 - MEMBER_DISCOUNT)).toLocaleString()} F membre
                </Link>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
};

export default ProductCard;