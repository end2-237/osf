// ─── CJ DROPSHIPPING API SERVICE ─────────────────────────────────────────────

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cj-proxy`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// ─── Raw fetch via Edge Function ──────────────────────────────────────────────
const cjFetch = async (path, params = {}) => {
  const url = new URL(EDGE_URL);
  url.searchParams.set("path",   path);
  url.searchParams.set("params", JSON.stringify(params));

  const res = await fetch(url.toString(), {
    headers: {
      "apikey":        ANON_KEY,
      "Authorization": `Bearer ${ANON_KEY}`,
      "Content-Type":  "application/json",
    },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 200 && !json.result) throw new Error(json.message || "CJ error");
  return json.data;
};

// ─── Products ─────────────────────────────────────────────────────────────────
export const cjListProducts = (pageNum = 1, pageSize = 200, search = "", categoryId = "") =>
  cjFetch("/product/list", {
    pageNum,
    pageSize,
    ...(search     ? { productNameEn: search } : {}),
    ...(categoryId ? { categoryId }            : {}),
  });

export const cjGetProductDetail = (pid) =>
  cjFetch("/product/query", { pid });

// ─── Categories ───────────────────────────────────────────────────────────────
export const cjGetCategories = () =>
  cjFetch("/product/getCategory");

// ─── OFS Category mapping ─────────────────────────────────────────────────────
export const CJ_TO_OFS = {
  "Audio Lab":    ["audio","headphone","speaker","earphone","earbuds","sound","music","microphone"],
  "Tech Lab":     ["tech","electron","computer","phone","tablet","gaming","laptop","drone","camera","robot","smart","usb","charger"],
  "Shoes":        ["shoe","sneaker","boot","slipper","sandal","footwear","heel","loafer"],
  "Fragrance":    ["fragrance","perfume","beauty","skin","cosmetic","makeup","hair","lotion","serum"],
  "Femme":        ["women","woman","female","dress","femme","skirt","blouse","lingerie","bra"],
  "Accessories":  ["jewelry","watch","bracelet","necklace","ring","bag","purse","sunglasses","belt","wallet","cap","hat"],
};

export const mapOfsType = (categoryName = "") => {
  const n = (categoryName || "").toLowerCase();
  for (const [type, keywords] of Object.entries(CJ_TO_OFS)) {
    if (keywords.some(k => n.includes(k))) return type;
  }
  return "Clothing";
};

// ─── Subcategory mapping (derived from CJ category name) ─────────────────────
export const mapSubcategory = (categoryName = "") => {
  const n = (categoryName || "").toLowerCase();
  if (n.includes("headphone") || n.includes("casque"))                                          return "Casques";
  if (n.includes("earphone") || n.includes("earbuds") || n.includes("earpiece"))               return "Écouteurs";
  if (n.includes("speaker") || n.includes("soundbar") || n.includes("enceinte"))               return "Enceintes";
  if (n.includes("microphone"))                                                                  return "Microphones";
  if (n.includes("phone") && !n.includes("earphone") && !n.includes("headphone"))              return "Smartphones";
  if (n.includes("tablet") || n.includes("ipad"))                                               return "Tablettes";
  if (n.includes("laptop") || n.includes("notebook") || n.includes("computer"))                return "Informatique";
  if (n.includes("gaming") || n.includes("console") || n.includes("game"))                     return "Gaming";
  if (n.includes("camera") || n.includes("drone") || n.includes("photo") || n.includes("gopro")) return "Photo & Vidéo";
  if (n.includes("charger") || n.includes("cable") || n.includes("power bank") || n.includes("usb hub")) return "Câbles & Chargeurs";
  if (n.includes("sneaker") || (n.includes("shoe") && !n.includes("boot") && !n.includes("sandal"))) return "Sneakers";
  if (n.includes("boot") || n.includes("ankle shoe"))                                           return "Bottes";
  if (n.includes("sandal") || n.includes("slipper") || n.includes("flip flop"))                return "Sandales";
  if (n.includes("hoodie") || n.includes("sweatshirt") || n.includes("pullover"))              return "Hoodies";
  if (n.includes("t-shirt") || n.includes("tshirt") || n.includes(" tee"))                    return "T-Shirts";
  if (n.includes("pant") || n.includes("trouser") || n.includes("jeans") || n.includes("legging")) return "Pantalons";
  if (n.includes("jacket") || n.includes("coat") || n.includes("blazer") || n.includes("veste")) return "Vestes";
  if (n.includes("dress") || n.includes("skirt") || n.includes("robe"))                        return "Robes & Jupes";
  if (n.includes("top") && (n.includes("women") || n.includes("woman") || n.includes("female"))) return "Tops";
  if (n.includes("lingerie") || n.includes("bra") || n.includes("underwear") || n.includes("panty")) return "Lingerie";
  if (n.includes("perfume") || n.includes("fragrance") || n.includes("cologne") || n.includes("parfum")) return "Parfums";
  if (n.includes("serum") || n.includes("cream") || n.includes("moisturizer") || n.includes("facial")) return "Soins Visage";
  if (n.includes("hair") || n.includes("shampoo") || n.includes("conditioner"))                return "Soins Cheveux";
  if (n.includes("makeup") || n.includes("cosmetic") || n.includes("lipstick") || n.includes("mascara")) return "Maquillage";
  if (n.includes("watch") || n.includes("smartwatch") || n.includes("montre"))                  return "Montres";
  if (n.includes("jewelry") || n.includes("necklace") || n.includes("bracelet") || n.includes("ring") || n.includes("earring")) return "Bijoux";
  if (n.includes("bag") || n.includes("purse") || n.includes("backpack") || n.includes("handbag")) return "Sacs";
  if (n.includes("wallet") || n.includes("card holder"))                                        return "Portefeuilles";
  if (n.includes("sunglasses") || n.includes("glasses") || n.includes("eyewear"))              return "Lunettes";
  if (n.includes("belt") || n.includes("ceinture"))                                             return "Ceintures";
  if (n.includes("cap") || n.includes("hat") || n.includes("beanie"))                         return "Chapeaux";
  return null;
};

// USD → FCFA  (1 USD ≈ 610 FCFA)
export const usdToFcfa = (usd) => {
  const n = parseFloat(usd);
  return isNaN(n) || n <= 0 ? 0 : Math.round(n * 610);
};

// Detect video URLs stored inline in images array
export const isVideoUrl = (url = "") =>
  /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);

// Sanitize CJ description HTML and extract embedded image URLs
const parseHtmlDescription = (html = "") => {
  if (!html) return { safeHtml: "", extraImages: [] };

  // Extract <img src> URLs for the gallery
  const extraImages = [];
  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    const src = m[1];
    if (src && !isVideoUrl(src)) extraImages.push(src);
  }

  const safeHtml = html
    // Strip dangerous tags entirely
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    // Strip event handlers
    .replace(/\s+on\w+="[^"]*"/gi, "")
    .replace(/\s+on\w+='[^']*'/gi, "")
    // Clean <img>: keep only src attribute, drop data-* etc.
    .replace(/<img([^>]*)>/gi, (_, attrs) => {
      const s = /src=["']([^"']+)["']/.exec(attrs);
      return s ? `<img src="${s[1]}">` : "";
    })
    .trim();

  return { safeHtml, extraImages };
};

// ─── CJ product → Supabase product schema ────────────────────────────────────
export const mapCjToProduct = (p) => {
  // ── Images ─────────────────────────────────────────────────────────────────
  const mainImg = p.productImage || "";
  let images = [];
  if (p.productImageSet) {
    if (Array.isArray(p.productImageSet)) {
      images = p.productImageSet.filter(Boolean);
    } else if (typeof p.productImageSet === "string" && p.productImageSet.trim()) {
      images = p.productImageSet.split(",").map(s => s.trim()).filter(Boolean);
    }
  }
  if (images.length === 0 && mainImg) images = [mainImg];
  const videoUrl = (p.productVideo || "").trim();
  if (videoUrl && !images.includes(videoUrl)) images = [...images, videoUrl];

  // ── CJ product ID (try all known field names) ───────────────────────────────
  const cj_product_id = p.pid || p.productId || p.cjProductId || null;

  // ── Variants (colors, sizes, stock per variant) ─────────────────────────────
  const variants = Array.isArray(p.variants) ? p.variants : [];

  // Extract colors AND sizes from variant properties
  // CJ format: "Color:Black;Size:XL" or "US Size:M" or "Color:Red,Size:S"
  const colorsSet = new Set();
  const sizesSet  = new Set();
  variants.forEach(v => {
    const raw = v.variantProperty || v.property || "";
    raw.split(/[;,]/).forEach(prop => {
      const ci  = prop.indexOf(":");
      if (ci === -1) return;
      const key = prop.slice(0, ci).toLowerCase().replace(/\s/g, "");
      const val = prop.slice(ci + 1).trim();
      if (!val) return;
      if (key.includes("col") || key.includes("coul") || key === "colour") {
        colorsSet.add(val);
      } else if (key.includes("size") || key.includes("taille") || key.includes("pointure")
              || key.includes("capacity") || key.includes("storage") || key.includes("storage")) {
        sizesSet.add(val);
      }
    });
    // Fallback: if variantNameEn looks like a standalone color (no ":" in raw)
    const vName = (v.variantNameEn || v.variantName || "").trim();
    if (vName && !raw.includes(":") && colorsSet.size === 0) {
      colorsSet.add(vName);
    }
  });
  const colors = colorsSet.size > 0 ? [...colorsSet] : [];
  const sizes  = [...sizesSet];

  // ── Stock: sum variants or top-level field (-1 = unknown) ──────────────────
  let stock_qty = -1;
  if (typeof p.inventoryQuantity === "number") {
    stock_qty = p.inventoryQuantity;
  } else if (typeof p.quantity === "number") {
    stock_qty = p.quantity;
  } else if (variants.length > 0) {
    const hasStockData = variants.some(v => "variantInventory" in v || "quantity" in v);
    if (hasStockData) {
      stock_qty = variants.reduce((s, v) => s + (parseInt(v.variantInventory ?? v.quantity ?? 0) || 0), 0);
    }
  }

  // ── Status from stock ───────────────────────────────────────────────────────
  const status =
    stock_qty === 0              ? "Rupture"      :
    stock_qty > 0 && stock_qty <= 10 ? "Stock limité" :
    "Nouveau";

  // ── Description: sanitize HTML, extract embedded images ───────────────────
  const rawDesc = p.productRemark || p.remark || p.entryRemark || p.description || p.productNameEn || p.productName || "";
  const { safeHtml: description, extraImages } = parseHtmlDescription(rawDesc);
  // Append description images that aren't already in the images array
  extraImages.forEach(url => { if (!images.includes(url)) images.push(url); });

  // ── Features from product attributes ───────────────────────────────────────
  const features = [];
  (Array.isArray(p.productAttribute) ? p.productAttribute : []).forEach(a => {
    const name  = a.attrEnName  || a.attrName  || "";
    const value = a.attrEnValue || a.attrValue || "";
    if (name && value) features.push(`${name}: ${value}`);
  });

  // ── Price USD (keep original for audit/recalculation) ──────────────────────
  const price_usd = parseFloat(p.sellPrice ?? p.productPrice ?? 0) || null;

  // ── Weight ─────────────────────────────────────────────────────────────────
  const weight_g       = parseFloat(p.productWeight  || p.logisticWeight  || 0) || null;
  const ship_weight_g  = parseFloat(p.logisticWeight || p.productWeight   || 0) || null;

  // ── Physical dimensions (product) — cm ─────────────────────────────────────
  const length_cm = parseFloat(p.productLength || p.length || 0) || null;
  const width_cm  = parseFloat(p.productWidth  || p.width  || 0) || null;
  const height_cm = parseFloat(p.productHeight || p.height || 0) || null;

  // ── Packaging / shipping box dimensions — cm ───────────────────────────────
  const pack_l_cm = parseFloat(p.packLength || p.packageLength || p.cargoLength || p.productLength || 0) || null;
  const pack_w_cm = parseFloat(p.packWidth  || p.packageWidth  || p.cargoWidth  || p.productWidth  || 0) || null;
  const pack_h_cm = parseFloat(p.packHeight || p.packageHeight || p.cargoHeight || p.productHeight || 0) || null;

  return {
    // Core
    name:             p.productNameEn || p.productName || "Produit",
    price:            usdToFcfa(p.sellPrice ?? p.productPrice ?? 0),
    price_usd,
    img:              images.find(u => !isVideoUrl(u)) || mainImg,
    images,
    type:             mapOfsType(p.categoryName || ""),
    subcategory:      mapSubcategory(p.categoryName || ""),
    status,
    description,
    features,
    colors:           colors.length > 0 ? colors : ["Default"],
    vendor_id:        null,
    // CJ-specific
    cj_product_id,
    stock_qty,
    weight_g,
    ship_weight_g,
    length_cm,
    width_cm,
    height_cm,
    pack_l_cm,
    pack_w_cm,
    pack_h_cm,
    variants:         variants.length > 0 ? variants : null,
    cj_category_id:   p.categoryId   || null,
    cj_category_name: p.categoryName || null,
    supplier_id:      p.supplierId   || null,
    supplier_name:    p.supplierName || null,
  };
};
