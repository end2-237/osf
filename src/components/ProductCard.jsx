import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../hooks/useWishlist";
import { useNavigate } from "react-router-dom";

const MEMBER_DISCOUNT = 0.2;

const StarRating = ({ rating = 4.2, count = null }) => {
  const fullStars  = Math.floor(rating);
  const halfStar   = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
  return (
    <div className="flex items-center gap-1">
      <div className="flex text-[#FF9900] text-[11px]">
        {Array(fullStars).fill(0).map((_, i) => <i key={`f${i}`} className="fa-solid fa-star"></i>)}
        {halfStar && <i className="fa-solid fa-star-half-stroke"></i>}
        {Array(emptyStars).fill(0).map((_, i) => <i key={`e${i}`} className="fa-regular fa-star"></i>)}
      </div>
      {count !== null && (
        <span className="text-[11px] text-[#007185] hover:text-[#C45500] cursor-pointer">{count}</span>
      )}
    </div>
  );
};

const ProductCard = React.memo(({ product, openModal, addToCart }) => {
  const navigate    = useNavigate();
  const { isInWishlist, toggle: toggleWishlist } = useWishlist();
  const inWishlist  = isInWishlist(product.id);
  const { user, isMember } = useAuth();

  const originalPrice  = (() => { const n = parseFloat(product.price); return isNaN(n) || n <= 0 ? 0 : n; })();
  const vendorHasPromo = product.vendor?.member_discount_enabled ?? product.vendor_member_discount_enabled ?? false;
  const discountActive = isMember && vendorHasPromo;
  const memberPrice    = discountActive ? Math.round(originalPrice * (1 - MEMBER_DISCOUNT)) : originalPrice;

  const ratingVal   = 3.8 + ((product.id?.charCodeAt(0) || 65) % 12) * 0.1;
  const reviewCount = 10 + ((product.id?.charCodeAt(0) || 65) % 200);

  const handleAddToCart = (e) => {
    e.stopPropagation();
    addToCart({
      ...product,
      price: originalPrice,
      vendor_member_discount_enabled: vendorHasPromo,
      selectedSize:  product.type === "Shoes" ? "42" : "M",
      selectedColor: "Black",
      quantity: 1,
    });
  };

  return (
    <div className="product-card bg-white border border-[#D5D9D9] hover:shadow-md transition-all rounded group cursor-pointer flex flex-col">

      {/* IMAGE */}
      <div
        className="relative overflow-hidden bg-white rounded-t p-3 aspect-square"
        onClick={() => openModal(product)}
      >
        {/* BADGES */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          {product.status && (
            <span className="bg-[#CC0C39] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm leading-tight">
              {product.status}
            </span>
          )}
          {discountActive && (
            <span className="bg-[#FF9900] text-[#0F1111] text-[9px] font-bold px-1.5 py-0.5 rounded-sm leading-tight">
              −20%
            </span>
          )}
          {vendorHasPromo && !isMember && (
            <span className="bg-[#FEBD69] text-[#0F1111] text-[9px] font-bold px-1.5 py-0.5 rounded-sm leading-tight">
              Promo membre
            </span>
          )}
        </div>

        {/* WISHLIST */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            if (!user) { navigate("/login"); return; }
            await toggleWishlist(product);
          }}
          className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all border ${
            inWishlist
              ? "bg-[#FF9900] border-[#FF9900] text-white"
              : "bg-white border-[#D5D9D9] text-gray-400 hover:border-[#FF9900] hover:text-[#FF9900]"
          }`}
        >
          <i className={`fa-${inWishlist ? "solid" : "regular"} fa-heart text-xs`}></i>
        </button>

        <img
          src={product.img}
          className="w-full h-full object-contain transition duration-500 group-hover:scale-105"
          loading="lazy"
          alt={product.name}
        />
      </div>

      {/* INFO */}
      <div className="px-3 pb-3 flex flex-col flex-grow" onClick={() => openModal(product)}>

        {/* CATEGORY */}
        <p className="text-[11px] text-[#007185] font-medium mb-0.5 truncate">{product.type}</p>

        {/* NAME */}
        <h3 className="text-[13px] text-[#0F1111] leading-snug line-clamp-2 mb-1.5 group-hover:text-[#C45500] transition-colors flex-grow">
          {product.name}
        </h3>

        {/* STARS */}
        <div className="mb-2">
          <StarRating rating={ratingVal} count={reviewCount} />
        </div>

        {/* PRICE */}
        <div className="flex items-baseline gap-1.5 flex-wrap mb-3">
          {discountActive ? (
            <>
              <span className="text-[#B12704] font-bold text-base leading-none">
                {memberPrice.toLocaleString()} F
              </span>
              <span className="text-xs text-[#565959] line-through">
                {originalPrice.toLocaleString()} F
              </span>
              <span className="text-xs text-[#B12704]">(-20%)</span>
            </>
          ) : (
            <>
              <span className="text-[#0F1111] font-bold text-base leading-none">
                {originalPrice.toLocaleString()} F
              </span>
              {vendorHasPromo && !user && (
                <Link to="/register" onClick={(e) => e.stopPropagation()}
                  className="text-[11px] text-[#007185] hover:underline block"
                >
                  Prix membre: {Math.round(originalPrice * 0.8).toLocaleString()} F
                </Link>
              )}
            </>
          )}
        </div>

        {/* ADD TO CART */}
        <button
          onClick={(e) => { e.stopPropagation(); handleAddToCart(e); }}
          className="w-full bg-[#FFD814] hover:bg-[#F7CA00] border border-[#FCD200] hover:border-[#F0C000] text-[#0F1111] py-1.5 rounded text-[13px] font-medium transition-colors shadow-sm active:scale-95"
        >
          Ajouter au panier
        </button>

        {/* PERSONALIZE */}
        <Link
          to="/studio"
          state={{ productId: product.id }}
          onClick={(e) => e.stopPropagation()}
          className="block text-center text-[11px] text-[#007185] hover:text-[#C45500] hover:underline mt-1.5 transition-colors"
        >
          <i className="fa-solid fa-wand-magic-sparkles text-[9px] mr-1"></i>
          Personnaliser
        </Link>
      </div>
    </div>
  );
};

});

export default ProductCard;
