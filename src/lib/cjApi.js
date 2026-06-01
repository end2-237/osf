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

// USD → FCFA  (1 USD ≈ 610 FCFA) — robust against NaN/null/string inputs
export const usdToFcfa = (usd) => {
  const n = parseFloat(usd);
  return isNaN(n) || n <= 0 ? 0 : Math.round(n * 610);
};

// Detect video URLs (stored inline in images array)
export const isVideoUrl = (url = "") =>
  /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);

// ─── CJ product → Supabase product schema ────────────────────────────────────
// vendor_id = null → produit plateforme OFS (pas lié à un vendeur)
export const mapCjToProduct = (p) => {
  const mainImg = p.productImage || "";

  // productImageSet can be a comma-separated string or an array
  let images = [];
  if (p.productImageSet) {
    if (Array.isArray(p.productImageSet)) {
      images = p.productImageSet.filter(Boolean);
    } else if (typeof p.productImageSet === "string" && p.productImageSet.trim()) {
      images = p.productImageSet.split(",").map(s => s.trim()).filter(Boolean);
    }
  }
  if (images.length === 0 && mainImg) images = [mainImg];

  // Append product video URL if available (detected via extension in the gallery)
  const videoUrl = (p.productVideo || "").trim();
  if (videoUrl && !images.includes(videoUrl)) images = [...images, videoUrl];

  return {
    name:        p.productNameEn || p.productName || "Produit",
    price:       usdToFcfa(p.sellPrice ?? p.productPrice ?? 0),
    img:         images.find(u => !isVideoUrl(u)) || mainImg,
    images,
    type:        mapOfsType(p.categoryName || ""),
    status:      "Nouveau",
    description: p.productName   || p.productNameEn || "",
    features:    [],
    colors:      ["Black", "White"],
    vendor_id:   null,
  };
};
