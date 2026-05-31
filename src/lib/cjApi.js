// ─── CJ DROPSHIPPING API SERVICE ─────────────────────────────────────────────

// Supabase Edge Function URL — proxy côté serveur pour éviter les erreurs CORS
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
    ...(search     ? { productNameEn: search     } : {}),
    ...(categoryId ? { categoryId               } : {}),
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
  vendor_id:   null,
});
