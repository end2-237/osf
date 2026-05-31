// ─── CJ DROPSHIPPING API SERVICE ─────────────────────────────────────────────

const BASE  = "https://developers.cjdropshipping.com/api2.0/v1";
export const CJ_TOKEN = import.meta.env.VITE_CJ_ACCESS_TOKEN || "";

// CORS proxy — active en développement si l'API bloque les appels browser
// Mettre à "" pour désactiver (si l'API supporte CORS nativement ou via Edge Function)
const CORS_PROXY = "https://corsproxy.io/?url=";

const buildUrl = (path, params = {}) => {
  const target = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined) target.searchParams.set(k, String(v));
  });
  return CORS_PROXY ? `${CORS_PROXY}${encodeURIComponent(target.toString())}` : target.toString();
};

const cjHeaders = () => ({
  "CJ-Access-Token": CJ_TOKEN,
  "Content-Type":    "application/json",
  ...(CORS_PROXY ? { "x-requested-with": "XMLHttpRequest" } : {}),
});

// ─── Raw fetch wrapper ────────────────────────────────────────────────────────
const cjFetch = async (path, params = {}) => {
  const url = buildUrl(path, params);
  const res  = await fetch(url, { headers: cjHeaders(), mode: "cors" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 200 && !json.result) throw new Error(json.message || `CJ error`);
  return json.data;
};

// ─── Products ─────────────────────────────────────────────────────────────────
// CJ API accepte : productNameEn (recherche en anglais), categoryId, pageNum, pageSize
export const cjListProducts = (pageNum = 1, pageSize = 200, search = "", categoryId = "") =>
  cjFetch("/product/list", {
    pageNum,
    pageSize,
    ...(search ? { productNameEn: search } : {}),
    ...(categoryId ? { categoryId } : {}),
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

// USD → FCFA  (1 USD ≈ 610 FCFA)
export const usdToFcfa = (usd) => Math.round(Number(usd || 0) * 610);

// ─── CJ product → Supabase product schema ────────────────────────────────────
// vendor_id = null → produit plateforme OFS (pas lié à un vendeur)
export const mapCjToProduct = (p) => ({
  name:        p.productNameEn || p.productName || "Produit",
  price:       usdToFcfa(p.sellPrice ?? p.productPrice ?? 0),
  img:         p.productImage  || "",
  images:      p.productImage  ? [p.productImage] : [],
  type:        mapOfsType(p.categoryName || ""),
  status:      "Nouveau",
  description: p.productName   || p.productNameEn || "",
  features:    [],
  colors:      ["Black", "White"],
  vendor_id:   null,   // produit plateforme — aucun vendeur associé
});
