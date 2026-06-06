import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../hooks/useWishlist";
import { useNavigate } from "react-router-dom";
import { useTranslate } from "../hooks/useTranslate";

const MEMBER_DISCOUNT = 0.2;

// ─── Color hex resolution ─────────────────────────────────────────────────────
const COLOR_HEX = {
  black:"#1a1a1a", white:"#f5f5f5", red:"#dc2626", blue:"#2563eb", green:"#16a34a",
  yellow:"#eab308", orange:"#ea580c", purple:"#9333ea", pink:"#ec4899",
  gray:"#6b7280", grey:"#6b7280", brown:"#92400e", navy:"#1e3a5f",
  beige:"#d4c5a9", gold:"#d97706", silver:"#c0c0c0", rose:"#fb7185",
  violet:"#7c3aed", coral:"#f97316", turquoise:"#0d9488", cream:"#fef9c3",
  khaki:"#c3b091", camel:"#c19a6b", olive:"#808000", maroon:"#800000",
  // French
  noir:"#1a1a1a", blanc:"#f5f5f5", rouge:"#dc2626", bleu:"#2563eb",
  vert:"#16a34a", jaune:"#eab308", gris:"#6b7280", doré:"#d97706",
  argenté:"#c0c0c0",
};
const resolveHex = (name = "") => {
  const n = (name || "").toLowerCase().trim();
  if (/^#[0-9a-f]{3,6}$/i.test(n)) return n;
  return COLOR_HEX[n] || COLOR_HEX[n.split(/[\s\-_]/)[0]] || null;
};

// ─── Star Rating ──────────────────────────────────────────────────────────────
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

// ─── Product Card ─────────────────────────────────────────────────────────────
const ProductCard = React.memo(({ product, openModal, addToCart }) => {
  const navigate   = useNavigate();
  const { isInWishlist, toggle: toggleWishlist } = useWishlist();
  const inWishlist = isInWishlist(product.id);
  const { user, isMember } = useAuth();
  const translatedName = useTranslate(product.name);

  const originalPrice  = (() => { const n = parseFloat(product.price); return isNaN(n) || n <= 0 ? 0 : n; })();
  const vendorHasPromo = product.vendor?.member_discount_enabled ?? product.vendor_member_discount_enabled ?? false;
  const discountActive = isMember && vendorHasPromo;
  const memberPrice    = discountActive ? Math.round(originalPrice * (1 - MEMBER_DISCOUNT)) : originalPrice;

  const ratingVal   = 3.8 + ((product.id?.charCodeAt(0) || 65) % 12) * 0.1;
  const reviewCount = 10 + ((product.id?.charCodeAt(0) || 65) % 200);

  // Only show swatches when there are 3+ distinct non-generic colors
  // (CJ products often only have ["Black","White"] which adds no value)
  const GENERIC = new Set(["default", "black", "white", "noir", "blanc", "black/white", "white/black"]);
  const colorSwatches = (product.colors || [])
    .filter(c => !GENERIC.has((c || "").toLowerCase()))
    .map(c => ({ name: c, hex: resolveHex(c) }))
    .filter(c => c.hex);

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
        className="relative overflow-hidden bg-white rounded-t p-1.5 aspect-square"
        onClick={() => openModal(product)}
      >
        {/* BADGES */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          {product.stock_qty === 0 ? (
            <span className="bg-[#565959] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm leading-tight">
              Rupture
            </span>
          ) : product.stock_qty > 0 && product.stock_qty <= 10 ? (
            <span className="bg-[#CC0C39] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm leading-tight">
              Plus que {product.stock_qty}
            </span>
          ) : product.status === "Nouveau" ? (
            <span className="bg-[#007600] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm leading-tight">
              Nouveau
            </span>
          ) : product.status ? (
            <span className="bg-[#CC0C39] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm leading-tight">
              {product.status}
            </span>
          ) : null}
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

      {/* COLOR SWATCHES */}
      {colorSwatches.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 border-t border-[#F8F8F8]">
          {colorSwatches.slice(0, 5).map((c, i) => (
            <span key={i} title={c.name}
              className="w-3.5 h-3.5 rounded-full border border-white shadow-sm ring-1 ring-[#D0D0D0] flex-shrink-0 inline-block"
              style={{ backgroundColor: c.hex }}
            />
          ))}
          {colorSwatches.length > 5 && (
            <span className="text-[10px] text-[#007185] font-medium">+{colorSwatches.length - 5}</span>
          )}
          <span className="text-[10px] text-[#767676] ml-0.5">
            {colorSwatches.length > 1 ? `${colorSwatches.length} couleurs` : colorSwatches[0].name}
          </span>
        </div>
      )}

      {/* INFO */}
      <div className="px-2 pb-2 flex flex-col flex-grow" onClick={() => openModal(product)}>

        {/* CATEGORY + SUBCATEGORY */}
        <p className="text-[10px] text-[#007185] font-medium mb-0.5 truncate">
          {product.subcategory || product.type}
        </p>

        {/* NAME */}
        <h3 className="text-[12px] text-[#0F1111] leading-snug line-clamp-2 mb-1 group-hover:text-[#C45500] transition-colors flex-grow">
          {translatedName}
        </h3>

        {/* STARS */}
        <div className="mb-1">
          <StarRating rating={ratingVal} count={reviewCount} />
        </div>

        {/* PRICE */}
        <div className="flex items-baseline gap-1 flex-wrap mb-2">
          {discountActive ? (
            <>
              <span className="text-[#B12704] font-bold text-[13px] leading-none">
                {memberPrice.toLocaleString()} F
              </span>
              <span className="text-xs text-[#565959] line-through">
                {originalPrice.toLocaleString()} F
              </span>
              <span className="text-xs text-[#B12704]">(-20%)</span>
            </>
          ) : (
            <>
              <span className="text-[#0F1111] font-bold text-[13px] leading-none">
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

        {/* Shipping estimate for CJ products */}
        {!product.vendor_id && (
          <p className="text-[10px] text-[#007185] -mt-1 mb-1.5 flex items-center gap-1">
            <i className="fa-solid fa-plane text-[9px]" />
            <span>
              + ~{Math.round(1015 + ((product.ship_weight_g || product.weight_g || 200) / 1000) * 10000).toLocaleString()} F livraison
            </span>
          </p>
        )}

        {/* ADD TO CART */}
        <button
          onClick={(e) => { e.stopPropagation(); handleAddToCart(e); }}
          className="w-full bg-[#FFD814] hover:bg-[#F7CA00] border border-[#FCD200] hover:border-[#F0C000] text-[#0F1111] py-1 rounded text-[12px] font-medium transition-colors shadow-sm active:scale-95"
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
});

export default ProductCard;
