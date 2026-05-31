// ─── CJ DROPSHIPPING API SERVICE ─────────────────────────────────────────────

const BASE  = "https://developers.cjdropshipping.com/api2.0/v1";
export const CJ_TOKEN = import.meta.env.VITE_CJ_ACCESS_TOKEN || "";

const cjHeaders = () => ({
  "CJ-Access-Token": CJ_TOKEN,
  "Content-Type":    "application/json",
});

// ─── Raw fetch wrapper ────────────────────────────────────────────────────────
const cjFetch = async (path, params = {}) => {
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => { if (v !== "" && v != null) url.searchParams.set(k, v); });
  const res  = await fetch(url.toString(), { headers: cjHeaders() });
  const json = await res.json();
  if (json.code !== 200 && !json.result) throw new Error(json.message || `CJ error ${res.status}`);
  return json.data;
};

// ─── Products ─────────────────────────────────────────────────────────────────
export const cjListProducts = (pageNum = 1, pageSize = 200, search = "", categoryId = "") =>
  cjFetch("/product/list", { pageNum, pageSize, productNameEn: search, categoryId });

export const cjGetProductDetail = (pid) =>
  cjFetch("/product/query", { pid });

// ─── Categories ───────────────────────────────────────────────────────────────
export const cjGetCategories = () =>
  cjFetch("/product/getCategory");

// ─── OFS Category mapping ─────────────────────────────────────────────────────
export const CJ_TO_OFS = {
  "Audio Lab":    ["audio","headphone","speaker","earphone","earbuds","sound","music"],
  "Tech Lab":     ["tech","electron","computer","phone","tablet","gaming","laptop","drone","camera","robot"],
  "Shoes":        ["shoe","sneaker","boot","slipper","sandal","footwear","heel"],
  "Fragrance":    ["fragrance","perfume","beauty","skin","cosmetic","makeup","hair"],
  "Femme":        ["women","woman","female","dress","femme","skirt","blouse","lingerie"],
  "Accessories":  ["jewelry","watch","bracelet","necklace","ring","bag","purse","sunglasses","belt","wallet"],
};

export const mapOfsType = (categoryName = "") => {
  const n = (categoryName || "").toLowerCase();
  for (const [type, keywords] of Object.entries(CJ_TO_OFS)) {
    if (keywords.some(k => n.includes(k))) return type;
  }
  return "Clothing";
};

// USD → FCFA (1 USD ≈ 610 FCFA)
export const usdToFcfa = (usd) => Math.round(Number(usd || 0) * 610);

// ─── CJ product → Supabase product schema ────────────────────────────────────
export const mapCjToProduct = (p) => ({
  name:        p.productNameEn || p.productName || "Produit",
  price:       usdToFcfa(p.sellPrice || p.productPrice || 0),
  img:         p.productImage  || "",
  images:      p.productImage  ? [p.productImage] : [],
  type:        mapOfsType(p.categoryName || ""),
  status:      "Nouveau",
  description: p.productName   || "",
  features:    [],
  colors:      ["Black", "White"],
  vendor_id:   null,
});
