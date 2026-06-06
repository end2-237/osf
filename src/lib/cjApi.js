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

// ─── OFS Category mapping (CJ → OFS) ─────────────────────────────────────────
// CJ categoryName is a hierarchical path: "Top / Mid / Leaf" or "Top, Sub > Leaf"
// We split into segments and test each word, prioritised top-down.

const _segs = (s = "") => s.toLowerCase().split(/[\/,>&]+/).map(t => t.trim()).filter(Boolean);

export const mapOfsType = (categoryName = "") => {
  const segs = _segs(categoryName);
  const n    = segs.join(" ");

  // ── Audio & Sound ───────────────────────────────────────────────────────────
  if (/headphone|earphone|earbuds?|casque|oreillette|in.ear|over.ear|on.ear|speaker|soundbar|subwoofer|enceinte|bluetooth.speaker|portable.speaker|microphone|amplifier|home.theater|sound.system|musical.instrument|audio.equipment|hi.fi/.test(n))
    return "Audio Lab";

  // ── Kitchen, Cookware & Dining (ustensiles MANUELS — avant l'électroménager électrique) ──
  // Important : « dishwasher safe », « microwave safe » sont des attributs de cookware,
  // pas des appareils. On capte ici les poêles, casseroles, hachoirs, éplucheurs, etc.
  if (/frying.pan|\bskillet\b|sauce.?pan|stock.?pot|\bwok\b|cookware|bakeware|cast.iron|non.?stick|casserole|dutch.oven|roasting.pan|grill.pan|cooking.pot|crepe.maker|baking.(?:tray|sheet|mold|pan)|cake.(?:mold|pan)|muffin.pan|pizza.pan/.test(n)
    || /kitchen.(?:tool|gadget|utensil|ware|accessor)|kitchen.?ware|\butensils?\b|\bspatula\b|\bwhisk\b|\bladle\b|\bcolander\b|\bstrainer\b|\bsieve\b|cooking.tongs|kitchen.tongs|food.tongs|bbq.tongs|serving.tongs|salad.tongs|\bgrater\b|\bpeeler\b|\bmasher\b|rolling.pin|garlic.press|can.opener|bottle.opener|cork.?screw|salad.spinner|kitchen.scale/.test(n)
    || /vegetable.chopper|food.chopper|veggie.chopper|hand.chopper|manual.chopper|\bslicer\b|\bdicer\b|vegetable.shredder|cheese.shredder|mandoline|vegetable.cutter|fruit.cutter|kitchen.cutter|onion.cutter|salad.cutter/.test(n)
    || /pasta.maker|noodle.maker|dough.(?:maker|press|roller)|dumpling.(?:maker|mold)/.test(n)
    || /egg.poacher|poach.*egg|egg.mold|egg.ring|egg.boat|silicone.egg|egg.separator|egg.cooker|egg.boiler/.test(n)
    || /cutting.board|chopping.board|\bcutlery\b|dinnerware|tableware|flatware|silverware|mixing.bowl|salad.bowl|measuring.(?:cup|spoon)|lunch.box|\bbento\b|food.container|meal.prep|\bthermos\b|insulated.(?:bottle|mug|cup)|water.bottle|\btumbler\b|coffee.mug|\bteapot\b|tea.infuser|\bcoaster\b|\btrivet\b|oven.mitt|pot.holder|\bapron\b|dish.rack|drying.rack|knife.(?:set|holder|block|sharpener)|\bknives\b|kitchen.knife/.test(n))
    return "Maison";

  // ── Tech & Electronics (+ électroménager, avant Maison) ───────────────────
  if (/smartphone|mobile.phone|cell.phone|\bphone\b|telecom|telecommunication|television|televiseur|\btv\b|tablet|ipad|laptop|notebook|computer|pc.desktop|gaming|game.controller|drone|action.camera|projector|smart.home|iot|robot|3d.printer|vr.headset|power.bank|usb.hub|screen.protector|phone.case|phone.bag|phone.holder|consumer.electronics|electronics/.test(n)
    || (/charger|cable|usb/.test(n) && !/car.charger/.test(n))
    || (/\bcamera\b/.test(n) && !/security.camera|doorbell/.test(n))
    || (/gaming|console/.test(n))
    || /home.appliance|kitchen.appliance|\bappliance\b|electric.kettle|air.fryer|air.condition|\bmicrowave\b(?!\W+safe)|washing.machine|refrigerator|freezer|\bdishwasher\b(?!\W+safe)|water.heater|robot.vacuum|vacuum.cleaner|air.purifier|humidifier|electric.fan|space.heater|coffee.maker|\bblender\b|rice.cooker|bread.maker|food.processor|\bjuicer\b|induction.cooker|\btoaster\b/.test(n)
    // Outils électriques & machines
    || /\belectric\b(?!.*(?:blue|red|green|yellow|pink|white|black|purple|orange))|power.tool|hand.tool|tool.set|\bdriller\b|\bgrinder\b|\bsander\b|\bstripper\b|soldering|\bwelder\b|oscillat|laser.engrav|cnc.machine|3d.print/.test(n))
    return "Tech Lab";

  // ── Shoes & Footwear ───────────────────────────────────────────────────────
  if (/\bshoes?\b|sneaker|boot(?!h)|slipper|sandal|footwear|loafer|moccasin|oxford|\bpump\b|wedge|espadrille|stiletto|trainer|athletic.shoe|running.shoe|basketball.shoe|soccer.cleat/.test(n))
    return "Shoes";

  // ── Women's Clothing ───────────────────────────────────────────────────────
  if (/women.?s.cloth|women.?s.fashion|women.?s.dress|women.?s.top|ladies.cloth|female.cloth|girls.cloth/.test(n)
    || /\b(dress|skirt|blouse|lingerie|\bbra\b|bikini|swimwear|romper|jumpsuit)\b/.test(n)
    || /\bgown\b|\bwomens?\b|\bladies\b|female.fashion|girl.dress/.test(n)
    || (segs.some(s => s.includes("women") && (s.includes("cloth") || s.includes("fashion") || s.includes("apparel") || s.includes("top") || s.includes("shirt")))))
    return "Femme";

  // ── Beauty & Fragrance ─────────────────────────────────────────────────────
  if (/perfume|fragrance|cologne|eau.de|beauty|skin.care|skincare|facial|serum|moisturizer|\bcream\b|\blotion\b|body.care|hair.care|shampoo|conditioner|hair.extension|\bwig\b|makeup|cosmetic|lipstick|mascara|foundation|eyeshadow|\bblush\b|\bnail\b|eyelash|\blash\b|sunscreen|toner|essence|body.wash|bath.bomb/.test(n))
    return "Beauté";

  // ── Home & Living (décor, mobilier, textiles — non électrique) ────────────
  if (/home.decor|home.furnish|home.living|home.textile|home.garden|cookware|tableware|cutlery|bedding|\bpillow\b|mattress|\bblanket\b|curtain|\brug\b|\bcarpet\b|\blamp\b|lighting|wall.art|picture.frame|\bcandle\b|\bvase\b|\bfurniture\b|\bshelf\b|\bcabinet\b|bathroom.access|\bcleaning.supply\b|\bstorage.box\b|organizer/.test(n))
    return "Maison";

  // ── Sport & Outdoors ───────────────────────────────────────────────────────
  if (/\bsport\b|fitness|\bgym\b|\byoga\b|cycling|bicycle|\bhiking\b|\bcamping\b|\bswimming\b|\brunning\b|football|soccer|basketball|\btennis\b|\bgolf\b|skiing|martial.arts|\bbox(ing)?\b|\boutdoor\b|exercise|workout|dumbbell|resistance.band|treadmill|jump.rope|activewear|volleyball|badminton|baseball|cricket|\btraining.ball\b|sportswear/.test(n))
    return "Sport";

  // ── Baby, Kids & Pets ──────────────────────────────────────────────────────
  if (/\bbaby\b|infant|toddler|\bchild\b|children|\bkids\b|\btoy\b|\bdoll\b|action.figure|lego|puzzle|nursery|stroller|\bcrib\b|baby.seat|diaper|pamper|baby.cloth|kids.cloth|school.bag|\bpet\b|\bdog\b|\bcat\b|\bpuppy\b|\bkitten\b|pet.supply|pet.accessor|aquarium|\bbird\b/.test(n))
    return "Bébé & Enfants";

  // ── Auto & Moto ────────────────────────────────────────────────────────────
  if (/\bcar\b|\bauto\b|automobile|vehicle|\btruck\b|motorcycle|motorbike|\bmoto\b|scooter|car.accessor|car.seat|car.cover|car.mat|car.charger|car.holder|car.wash|\btire\b|\bwheel\b|auto.tool|navigation/.test(n))
    return "Auto";

  // ── Men's Clothing ─────────────────────────────────────────────────────────
  if (/hoodie|sweatshirt|pullover|t.shirt|tshirt|\bpolo\b|\bshirt\b(?!.women)|men.?s.cloth|men.?s.fashion|men.?s.shirt|men.?s.jacket|men.?s.coat|men.?s.pant|men.?s.suit|men.?s.top|\bjeans?\b|\bdenim\b|trouser|\bblazer\b|men.?s.short|men.?s.underwear|jogger|tracksuit|streetwear|urban.fashion/.test(n)
    || (segs.some(s => s.includes("men") && !s.includes("women") && (s.includes("cloth") || s.includes("fashion") || s.includes("apparel") || s.includes("shirt") || s.includes("suit") || s.includes("wear")))))
    return "Clothing";

  // ── Accessories ────────────────────────────────────────────────────────────
  if (/jewelry|jewellery|necklace|bracelet|\bring\b|earring|\bwatch\b|smartwatch|\bbrooch\b|\bbag\b|handbag|\bpurse\b|backpack|\btote\b|clutch|\bwallet\b|card.holder|sunglasses|\bglasses\b|eyewear|\bbelt\b|\bcap\b|\bhat\b|\bbeanie\b|\bscarf\b|\bglove\b|\btie\b|hair.accessor|hair.clip/.test(n))
    return "Accessories";

  // Default fallback
  return "Clothing";
};

// ─── Combined mapper ──────────────────────────────────────────────────────────
// Product name is checked FIRST (it's always descriptive).
// Category name is used only when product name gives no specific match.
export const mapCjProductType = (categoryName = "", productName = "") => {
  const fromName = mapOfsType(productName);
  if (fromName !== "Clothing") return fromName;
  // product name was generic/empty — fall back to CJ category
  return mapOfsType(categoryName);
};

// Same priority logic for subcategory: product name first, categoryName as fallback.
// CJ category paths often contain generic terms (e.g. "Storage" in camera accessories)
// that would wrongly override the actual subcategory derived from the product name.
export const mapCjSubcategory = (categoryName = "", productName = "") => {
  const fromName = mapSubcategory(productName);
  if (fromName) return fromName;
  return mapSubcategory(categoryName) || null;
};

// ─── Subcategory mapping ──────────────────────────────────────────────────────
export const mapSubcategory = (categoryName = "") => {
  const n = (categoryName || "").toLowerCase();

  // Audio Lab
  if (/headphone|casque|over.ear|on.ear|studio.headphone/.test(n))              return "Casques";
  if (/earphone|earbuds?|in.ear|wireless.earbud/.test(n))                        return "Écouteurs";
  if (/speaker|soundbar|enceinte|bluetooth.speaker|portable.speaker/.test(n))   return "Enceintes";
  if (/microphone|\bmic\b/.test(n))                                               return "Microphones";

  // Tech Lab
  if (/television|televiseur|\btv\b|tv.&.video|home.cinema/.test(n))            return "TV & Vidéo";
  if (/smartphone|mobile.phone|cell.phone|\bphone\b|telecom/.test(n))            return "Smartphones";
  if (/\btablet\b|ipad/.test(n))                                                  return "Tablettes";
  if (/laptop|notebook|\bcomputer\b|pc.desktop|chromebook/.test(n))              return "Informatique";
  if (/\bgaming\b|\bconsole\b|game.controller|video.game/.test(n))               return "Gaming";
  if (/\bdrone\b|action.camera|camcorder|projector/.test(n)
    || (/\bcamera\b/.test(n) && !/phone|security|doorbell/.test(n)))             return "Photo & Vidéo";
  if (/charger|power.bank|usb.hub|\bcable\b|data.cable/.test(n))                return "Câbles & Chargeurs";
  if (/smart.home|smart.plug|smart.bulb|security.camera|doorbell/.test(n))      return "Maison Connectée";
  if (/smartwatch|wearable|fitness.tracker|smart.band/.test(n))                 return "Objets Connectés";
  if (/appliance|air.fryer|air.condition|\bmicrowave\b(?!\W+safe)|washing.machine|refrigerator|freezer|\bdishwasher\b(?!\W+safe)|water.heater|robot.vacuum|vacuum.cleaner|air.purifier|humidifier|electric.fan|coffee.maker|\bblender\b|rice.cooker|bread.maker|food.processor|\bjuicer\b|induction.cooker|\btoaster\b|electric.kettle/.test(n)) return "Électroménager";

  // Shoes
  if (/sneaker|trainer|athletic.shoe|running.shoe|basketball.shoe/.test(n))     return "Sneakers";
  if (/\bboot\b|ankle.shoe|chelsea/.test(n))                                     return "Bottes";
  if (/sandal|slipper|flip.flop/.test(n))                                        return "Sandales";
  if (/loafer|moccasin/.test(n))                                                  return "Mocassins";
  if (/\bheel\b|\bpump\b|\bwedge\b|stiletto/.test(n))                           return "Talons";

  // Clothing (men)
  if (/hoodie|sweatshirt|pullover/.test(n))                                        return "Hoodies & Sweats";
  if (/t.shirt|tshirt|\btee\b|\bpolo\b/.test(n))                                  return "T-Shirts & Polos";
  if (/men.s.shirt|\bshirt\b(?!.women|.dress)/.test(n))                           return "Chemises";
  if (/\bjeans?\b|\bdenim\b|trouser|\bpant\b|jogger/.test(n))                     return "Pantalons & Jeans";
  if (/\bjacket\b|\bcoat\b|\bblazer\b|parka/.test(n))                             return "Vestes & Manteaux";
  if (/\bshort\b(?!.sleeve)|bermuda/.test(n))                                      return "Shorts";
  if (/tracksuit|men.s.suit|\bsuit\b(?!.case)/.test(n))                           return "Costumes & Survêtements";
  if (/men.s.underwear|men.s.boxer|men.s.brief|men.s.sock/.test(n))               return "Sous-vêtements";

  // Femme
  if (/\bdress\b|\brobe\b|\bskirt\b/.test(n))                                    return "Robes & Jupes";
  if (/\btop\b|\bblouse\b|women.s.shirt/.test(n))                               return "Tops & Blouses";
  if (/lingerie|\bbra\b|\bpanty\b|women.s.underwear/.test(n))                   return "Lingerie";
  if (/women.s.coat|women.s.jacket|women.s.outerwear/.test(n))                  return "Manteaux";
  if (/jumpsuit|romper|playsuit/.test(n))                                         return "Combinaisons";

  // Beauté
  if (/perfume|fragrance|cologne|eau.de/.test(n))                                return "Parfums";
  if (/skin.care|skincare|facial|serum|moisturizer|\bcream\b|\blotion\b|toner|essence/.test(n)) return "Soins Visage";
  if (/hair.care|shampoo|conditioner|hair.extension|\bwig\b|hair.oil/.test(n)) return "Soins Cheveux";
  if (/makeup|cosmetic|lipstick|mascara|foundation|eyeshadow|\bblush\b|\bnail\b|eyelash/.test(n)) return "Maquillage";
  if (/body.care|body.lotion|body.wash|\bbath\b|\bshower\b/.test(n))            return "Corps & Bain";

  // Accessories
  if (/\bwatch\b|smartwatch/.test(n))                                             return "Montres";
  if (/jewelry|jewellery|necklace|bracelet|\bring\b|earring/.test(n))           return "Bijoux";
  if (/\bbag\b|handbag|\bpurse\b|\btote\b|\bclutch\b|backpack/.test(n))        return "Sacs à main";
  if (/\bwallet\b|card.holder/.test(n))                                          return "Portefeuilles";
  if (/sunglasses|\bglasses\b|eyewear/.test(n))                                  return "Lunettes";
  if (/\bbelt\b/.test(n))                                                         return "Ceintures";
  if (/\bcap\b|\bhat\b|\bbeanie\b/.test(n))                                      return "Chapeaux";

  // Maison
  if (/kitchen|cookware|bakeware|baking|tableware|dinnerware|cutlery|flatware|frying.pan|\bskillet\b|sauce.?pan|\bwok\b|cast.iron|non.?stick|casserole|dutch.oven|\bpans?\b|\bpots?\b|chopper|\bslicer\b|\bdicer\b|\bpeeler\b|\bgrater\b|mandoline|fruit.cutter|kitchen.cutter|pasta.maker|noodle.maker|egg.poach|poach.*egg|silicone.egg|egg.cooker|egg.boiler|\bwhisk\b|\bspatula\b|\bladle\b|\bcolander\b|\bstrainer\b|cutting.board|mixing.bowl|measuring.(?:cup|spoon)|\butensils?\b|garlic.press|can.opener|food.container|lunch.box|\bbento\b|\bthermos\b|water.bottle|\btumbler\b|coffee.mug|\bteapot\b|\bknives\b|kitchen.knife/.test(n)) return "Cuisine";
  if (/home.decor|\bdecor\b|wall.art|picture.frame|\bcandle\b|\bvase\b/.test(n)) return "Décoration";
  if (/bedding|\bpillow\b|mattress|\bblanket\b|\bduvet\b|bed.sheet/.test(n))     return "Literie";
  if (/\blamp\b|\blighting\b|led.strip|\bbulb\b|\blight\b/.test(n))             return "Éclairage";
  if (/\bstorage\b|organizer|\bshelf\b|\bcabinet\b/.test(n))                    return "Rangement";

  // Sport
  if (/\bgym\b|fitness|\byoga\b|dumbbell|resistance.band|treadmill/.test(n))    return "Fitness";
  if (/sports?.wear|activewear|sport.t.shirt|sport.pant/.test(n))               return "Vêtements Sport";
  if (/cycling|\bbicycle\b|\bbike\b/.test(n))                                    return "Cyclisme";
  if (/\bswim\b|\bpool\b|\bdiving\b/.test(n))                                    return "Natation";
  if (/\bcamp\b|\bhiking\b|outdoor.gear|\btent\b/.test(n))                      return "Camping";

  // Bébé & Enfants
  if (/\btoy\b|\bdoll\b|action.figure|\blego\b|\bpuzzle\b/.test(n))             return "Jouets";
  if (/baby.cloth|kids.cloth|children.cloth|toddler.cloth/.test(n))             return "Vêtements Enfant";
  if (/nursery|\bcrib\b|\bstroller\b|baby.seat|baby.monitor/.test(n))           return "Nurserie";
  if (/school.bag|pencil.case|school.supply/.test(n))                            return "Scolaire";

  // Auto
  if (/car.interior|seat.cover|car.mat|steering.wheel/.test(n))                 return "Intérieur Auto";
  if (/car.exterior|car.decal|car.light/.test(n))                               return "Extérieur Auto";
  if (/motorcycle|motorbike|\bmoto\b|scooter/.test(n))                           return "Moto & Scooter";
  if (/auto.tool|car.repair|car.maintenance|car.wash/.test(n))                  return "Entretien";

  return null;
};

// USD → FCFA  (1 USD ≈ 610 FCFA)
export const usdToFcfa = (usd) => {
  const n = parseFloat(usd);
  return isNaN(n) || n <= 0 ? 0 : Math.round(n * 610);
};

// Silent profit margin applied to all customer-facing prices
export const PRICE_MARGIN = 1.15;
const withMargin = (fcfa) => Math.round(fcfa * PRICE_MARGIN);

// Detect video URLs — extension-based OR known CJ/Alibaba video CDN patterns
export const isVideoUrl = (url = "") =>
  /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) ||
  /\/product[_-]?video\//i.test(url) ||
  /video\.cjdropshipping\.com\//i.test(url) ||
  /cbu01\.alicdn\.com\/img\/ibank\/video\//i.test(url);

// Parse price strings — handles CJ list ranges like "0.05 -- 0.20" (returns higher end)
const parsePrice = (raw) => {
  if (raw == null) return 0;
  const s = String(raw).trim();
  if (s.includes("--") || / - \d/.test(s)) {
    const parts = s.split(/\s*-{1,2}\s*/).filter(Boolean);
    return Math.max(...parts.map(p => parseFloat(p) || 0));
  }
  return parseFloat(s) || 0;
};

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
  const mainImg = p.productImage || p.bigImage || "";
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
  const cj_product_id = p.pid || p.productId || p.cjProductId || p.id || null;

  // ── Variant color/size extraction helpers ──────────────────────────────────
  // Known color keywords (CJ returns English names)
  const COLOR_KW = new Set([
    "black","white","red","blue","green","yellow","orange","purple","pink","gray","grey",
    "brown","navy","beige","gold","silver","rose","violet","coral","turquoise","cream",
    "khaki","camel","olive","maroon","burgundy","cyan","teal","lavender","tan","sand",
    "ivory","charcoal","slate","indigo","mint","lime","multicolor","colorful","multicolour",
    "nude","apricot","champagne","coffee","wine","army","dark","light","bright","pale",
    // French
    "noir","blanc","rouge","bleu","vert","jaune","gris","marron","doré","argenté",
  ]);
  // Size tokens: XS/S/M/L/XL/XXL, digits (shoe/EU sizes), capacity (128GB), lengths
  const SIZE_RE = /^(xs|s|m|l|xl|xxl|2xl|3xl|4xl|5xl|xxxl|\d{1,3}(gb|tb|ml|g|kg|cm|mm|in)?|\d{2}x\d{2}|\d{2}-\d{2}|eu\d{2}|us\d{1,2}|\d{2,3})$/i;
  const JUNK_RE = /^\d+pcs?$/i; // strip "2PCS", "3PC"

  // Extract colour & size words from a short string (≤8 words)
  const parseWords = (str, cSet, sSet) => {
    if (!str) return;
    const words = str.split(/[\s\-\/,;|()[\]]+/).filter(w => w.length >= 1);
    if (words.length > 8) return; // skip full product descriptions
    words.forEach(w => {
      const lo = w.toLowerCase();
      if (COLOR_KW.has(lo))   cSet.add(w.charAt(0).toUpperCase() + w.slice(1));
      else if (SIZE_RE.test(lo) && !JUNK_RE.test(lo)) sSet.add(w.toUpperCase());
    });
  };

  // ── Variants (colors, sizes, stock per variant) ─────────────────────────────
  const variants = Array.isArray(p.variants) ? p.variants : [];

  const colorsSet = new Set();
  const sizesSet  = new Set();

  variants.forEach(v => {
    const raw = (v.variantProperty || v.property || "").trim();

    if (raw.includes(":")) {
      // Standard CJ format: "Color:Black;Size:XL" (semicolon or comma separated)
      raw.split(/[;,]/).forEach(prop => {
        const ci = prop.indexOf(":");
        if (ci === -1) return;
        const key = prop.slice(0, ci).toLowerCase().replace(/\s/g, "");
        const val = prop.slice(ci + 1).trim();
        if (!val) return;

        if (key.includes("col") || key.includes("coul") || key === "colour") {
          // Strip trailing size/quantity noise: "Khaki S 2PCS" → "Khaki"
          const cleaned = val.split(/\s+/)
            .filter(w => !SIZE_RE.test(w.toLowerCase()) && !JUNK_RE.test(w))
            .join(" ").trim();
          colorsSet.add(cleaned || val);
          // Also save any embedded size tokens
          val.split(/\s+/).forEach(w => {
            if (SIZE_RE.test(w.toLowerCase()) && !JUNK_RE.test(w)) sizesSet.add(w.toUpperCase());
          });
        } else if (
          key.includes("size") || key.includes("taille") || key.includes("pointure") ||
          key.includes("capacity") || key.includes("storage") || key.includes("us ")
        ) {
          sizesSet.add(val);
        }
      });
    } else if (raw) {
      // No ":" separators — try word-level extraction
      parseWords(raw, colorsSet, sizesSet);
    }

    // variantKey fallback: "Color-Size-2PCS" or "Color-Size"
    // Used when variantProperty is absent/empty/"[]" (CJ omits it for many products)
    if (!raw.includes(":")) {
      const vKey = (v.variantKey || "").trim();
      if (vKey) {
        const parts = vKey.split("-");
        // Strip trailing quantity tokens ("2PCS", "3PC")
        while (parts.length > 0 && JUNK_RE.test(parts[parts.length - 1].trim())) parts.pop();
        // Last remaining token: if it looks like a size, extract it
        if (parts.length >= 2) {
          const last = parts[parts.length - 1].trim();
          if (SIZE_RE.test(last.toLowerCase())) sizesSet.add(parts.pop().trim().toUpperCase());
        }
        // Remaining parts joined = color name ("Sky Blue", "Army Green", "Khaki")
        const cName = parts.join(" ").trim();
        if (cName && cName.toLowerCase() !== "default") colorsSet.add(cName);
      }
    }

    // variantNameEn fallback: only for short labels like "Khaki S" or "Black XL"
    const vName = (v.variantNameEn || v.variantName || "").trim();
    parseWords(vName, colorsSet, sizesSet);
  });

  const colors = colorsSet.size > 0 ? [...colorsSet] : [];
  const sizes  = [...sizesSet];

  // ── Stock: sum variants or top-level field ─────────────────────────────────
  let stock_qty = -1;
  if (typeof p.totalVerifiedInventory === "number" && p.totalVerifiedInventory >= 0) {
    // CJ list endpoint: verified inventory count
    stock_qty = p.totalVerifiedInventory;
  } else if (typeof p.inventoryQuantity === "number") {
    stock_qty = p.inventoryQuantity;
  } else if (typeof p.quantity === "number") {
    stock_qty = p.quantity;
  } else if (typeof p.warehouseInventoryNum === "number" && p.warehouseInventoryNum >= 0) {
    stock_qty = Math.min(p.warehouseInventoryNum, 9999);
  } else if (variants.length > 0) {
    // CJ detail endpoint: stock lives inside variants[].inventories[].totalInventory
    // Each variant has inventories: [{ countryCode, totalInventory, cjInventory, factoryInventory }]
    const hasInventoriesStructure = variants.some(v => Array.isArray(v.inventories) && v.inventories.length > 0);
    const hasLegacyFields = variants.some(v =>
      (v.inventoryNum != null && v.inventoryNum !== "") ||
      (v.variantInventory != null) || (v.quantity != null)
    );

    if (hasInventoriesStructure) {
      stock_qty = variants.reduce((s, v) => {
        if (!Array.isArray(v.inventories) || !v.inventories.length) return s;
        // Prefer CN warehouse; fall back to first entry
        const inv = v.inventories.find(i => i.countryCode === "CN") || v.inventories[0];
        return s + (parseInt(inv.totalInventory ?? inv.cjInventory ?? inv.factoryInventory ?? 0) || 0);
      }, 0);
    } else if (hasLegacyFields) {
      stock_qty = variants.reduce((s, v) =>
        s + (parseInt(v.inventoryNum ?? v.variantInventory ?? v.quantity ?? 0) || 0), 0);
    }
  }
  // CJ doesn't always expose inventory — a listed product is assumed available
  if (stock_qty < 0) stock_qty = 999;

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
  // Material from materialNameEn (JSON array string like "[\"metal\",\"plastic\"]")
  if (p.materialNameEn) {
    try {
      const mats = JSON.parse(p.materialNameEn).filter(Boolean);
      if (mats.length > 0 && !features.some(f => /mati[eè]r/i.test(f))) {
        features.push(`Material: ${mats.join(", ")}`);
      }
    } catch { /* not a JSON array — skip */ }
  }
  // Variant attribute type (Color / Size / Storage…) — surfaced in the UI for labels
  const variant_key_type = (p.productKeyEn || "").trim() || null;
  // Customs HS code — useful for order compliance
  const customs_code = p.entryCode || null;
  const customs_name = p.entryNameEn || p.entryName || null;

  // ── Price USD (keep original for audit/recalculation) ──────────────────────
  const price_usd = parsePrice(p.nowPrice ?? p.sellPrice ?? p.productPrice ?? 0) || null;

  // ── Weight ─────────────────────────────────────────────────────────────────
  // productWeight = product only; packingWeight = with packaging (actual shipping weight)
  const weight_g      = parseFloat(p.productWeight  || p.logisticWeight  || 0) || null;
  const ship_weight_g = parseFloat(p.packingWeight  || p.logisticWeight  || p.productWeight || 0) || null;

  // ── Quantity price tiers ────────────────────────────────────────────────────
  // CJ may expose these as quantityDiscount [{quantity, discount}]
  // or priceList [{quantity, price}] or quantityPrices [{minNum, maxNum, price}]
  const quantity_prices = [];
  const baseUsd = parsePrice(p.nowPrice ?? p.sellPrice ?? p.productPrice ?? 0);

  if (Array.isArray(p.quantityDiscount) && p.quantityDiscount.length > 0) {
    const sorted = [...p.quantityDiscount].sort((a, b) => (a.quantity || a.qty || 1) - (b.quantity || b.qty || 1));
    sorted.forEach((tier, i) => {
      const pct  = parseFloat(tier.discount || tier.discountPercent || 0) / 100;
      const min  = parseInt(tier.quantity || tier.qty || tier.minQty) || 1;
      const max  = sorted[i + 1] ? (parseInt(sorted[i + 1].quantity || sorted[i + 1].qty) - 1) : null;
      const fp   = withMargin(usdToFcfa(baseUsd * (1 - pct)));
      if (min && fp > 0) quantity_prices.push({ min, max, price_fcfa: fp });
    });
  } else if (Array.isArray(p.priceList) && p.priceList.length > 0) {
    const sorted = [...p.priceList].sort((a, b) => (a.quantity || a.qty || 1) - (b.quantity || b.qty || 1));
    sorted.forEach((tier, i) => {
      const min = parseInt(tier.quantity || tier.qty || tier.minNum) || 1;
      const max = sorted[i + 1] ? (parseInt(sorted[i + 1].quantity || sorted[i + 1].qty) - 1) : null;
      const fp  = withMargin(usdToFcfa(parseFloat(tier.price || tier.sellPrice || 0)));
      if (min && fp > 0) quantity_prices.push({ min, max, price_fcfa: fp });
    });
  } else if (Array.isArray(p.quantityPrices) && p.quantityPrices.length > 0) {
    p.quantityPrices.forEach(tier => {
      const min = parseInt(tier.minNum || tier.minQty || tier.quantity) || 1;
      const max = tier.maxNum || tier.maxQty ? parseInt(tier.maxNum || tier.maxQty) : null;
      const fp  = withMargin(usdToFcfa(parseFloat(tier.price || tier.sellPrice || 0)));
      if (min && fp > 0) quantity_prices.push({ min, max, price_fcfa: fp });
    });
  }

  // ── Physical dimensions (product) — cm ─────────────────────────────────────
  const length_cm = parseFloat(p.productLength || p.length || 0) || null;
  const width_cm  = parseFloat(p.productWidth  || p.width  || 0) || null;
  const height_cm = parseFloat(p.productHeight || p.height || 0) || null;

  // ── Packaging / shipping box dimensions — cm ───────────────────────────────
  const pack_l_cm = parseFloat(p.packLength || p.packageLength || p.cargoLength || p.productLength || 0) || null;
  const pack_w_cm = parseFloat(p.packWidth  || p.packageWidth  || p.cargoWidth  || p.productWidth  || 0) || null;
  const pack_h_cm = parseFloat(p.packHeight || p.packageHeight || p.cargoHeight || p.productHeight || 0) || null;

  // ── Brand ────────────────────────────────────────────────────────────────────
  const brand = p.brand || p.brandName || p.productBrand || null;

  // ── SKU (product reference for orders) ───────────────────────────────────────
  const sku = p.productSku || p.sku || null;

  // ── Buy quantity limits ──────────────────────────────────────────────────────
  const min_buy_qty = parseInt(p.directMinOrderNum || p.minBuyNum || p.minOrderNum || p.moq || 1) || 1;
  const max_buy_qty = parseInt(p.maxBuyNum || p.maxOrderNum || 0) || null;

  // ── Product unit (piece, pair, set) ──────────────────────────────────────────
  const product_unit = (p.productUnit || p.unit || "").trim() || null;

  // ── Sales count (social proof) ────────────────────────────────────────────────
  const sale_num = parseInt(p.saleNum || p.sold || p.salesCount || 0) || 0;

  // ── CJ suggested retail price — actual field: suggestSellPrice (may be a range)
  const suggest_price_usd  = parsePrice(p.suggestSellPrice || p.productSugSellPrice || p.sugSellPrice || 0) || null;
  const suggest_price_fcfa = suggest_price_usd ? usdToFcfa(suggest_price_usd) : null;

  // ── Certifications/labels (CE, FCC, RoHS…) ───────────────────────────────────
  const label_codes = (p.labelCode || p.labels || p.certification || "").trim() || null;

  // ── Origin country ─────────────────────────────────────────────────────────────
  const origin_country = (p.originCountry || p.countryCode || p.productOriginCountry || "CN").trim();

  // ── CJ delivery/processing times ──────────────────────────────────────────────
  const express_delivery_days = String(p.expressDeliveryTime || p.expressDays || "").trim() || null;
  const delivery_cycle        = String(p.deliveryCycle || p.processingDays || "").trim() || null;

  // ── CJ shipping fee (USD) ─────────────────────────────────────────────────────
  const shipping_fee_usd = parseFloat(p.shippingFee || p.freight || p.logisticFee || 0) || null;

  // ── On-sale status ────────────────────────────────────────────────────────────
  const is_on_sale = p.isOnSale !== undefined
    ? Boolean(p.isOnSale) : p.onSale !== undefined
    ? Boolean(p.onSale) : true;

  // ── CJ product creation date ──────────────────────────────────────────────────
  const cj_added_at = p.addMarkTime || p.createTime || null;

  // ── Rating & reviews ─────────────────────────────────────────────────────────
  const rating_avg    = parseFloat(p.productRatingAvg || p.ratingAvg || p.avgRating || 0) || null;
  const review_count  = parseInt(p.reviewCount || p.totalReview || p.reviewNum || 0) || 0;

  // ── Advertising images (append to gallery) ────────────────────────────────────
  const adImgs = [];
  if (p.advertisingImageSet) {
    const raw = Array.isArray(p.advertisingImageSet) ? p.advertisingImageSet : p.advertisingImageSet.split(",");
    raw.map(s => s.trim()).filter(Boolean).forEach(u => { if (!images.includes(u) && !isVideoUrl(u)) adImgs.push(u); });
  } else if (Array.isArray(p.advertisingImages)) {
    p.advertisingImages.forEach(u => { if (u && !images.includes(u) && !isVideoUrl(u)) adImgs.push(u); });
  }
  if (adImgs.length > 0) images = [...images, ...adImgs];

  // ── Pack / multi-package info ─────────────────────────────────────────────────
  const pack_num      = parseInt(p.packNum || p.packageNum || 1) || 1;
  const multi_package = Boolean(p.multiPackage || p.isMultiPackage || false);

  // ── CJ sale status (ONLINE / OFFLINE) ────────────────────────────────────────
  const sale_status = (p.saleStatus || p.productStatus || "").trim() || null;

  // ── Category hierarchy ────────────────────────────────────────────────────────
  const cj_category_path = [
    p.firstCategoryName, p.secondCategoryName, p.thirdCategoryName
  ].filter(Boolean).join(" > ") || p.categoryName || null;

  // ── Video thumbnail ───────────────────────────────────────────────────────────
  const video_thumbnail = (p.productVideoImage || p.videoThumbnail || p.videoImage || "").trim() || null;

  // ── Cost price (stored for admin only — never shown to customers) ─────────────
  const cost_price_usd = price_usd;

  // ── Promo / discount from CJ ──────────────────────────────────────────────────
  const is_discount_sell = Boolean(p.isDiscountSell || p.discountSell || false);

  // ── Custom processing (engraving, logo, etc.) ─────────────────────────────────
  const is_customizable = Boolean(p.isProcessCustom || p.processCustom || p.customizable || false);

  // ── Light unit classification (faster/cheaper shipping) ───────────────────────
  const light_unit = Boolean(p.lightUnit || p.isLightUnit || false);

  // ── Language of CJ listing ───────────────────────────────────────────────────
  const product_language = (p.productLanguage || "").trim() || null;

  return {
    // Core
    name:             p.productNameEn || p.productName || p.nameEn || "Produit",
    price:            withMargin(usdToFcfa(parsePrice(p.nowPrice ?? p.sellPrice ?? p.productPrice ?? 0))),
    price_usd,
    img:              images.find(u => !isVideoUrl(u)) || mainImg,
    images,
    type:             mapCjProductType(p.categoryName || "", p.productNameEn || p.productName || ""),
    subcategory:      mapCjSubcategory(p.categoryName || "", p.productNameEn || p.productName || ""),
    status,
    description,
    features,
    colors:           colors.length > 0 ? colors : ["Default"],
    sizes:            sizes.length  > 0 ? sizes  : [],
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
    quantity_prices:  quantity_prices.length > 0 ? quantity_prices : null,
    cj_category_id:   p.categoryId   || null,
    cj_category_name: p.categoryName || null,
    supplier_id:      p.supplierId   || null,
    supplier_name:    p.supplierName || null,
    // Extended CJ fields
    brand,
    sku,
    min_buy_qty,
    max_buy_qty,
    product_unit,
    sale_num,
    suggest_price_usd,
    suggest_price_fcfa,
    label_codes,
    origin_country,
    express_delivery_days,
    delivery_cycle,
    shipping_fee_usd,
    is_on_sale,
    cj_added_at,
    variant_key_type,
    customs_code,
    customs_name,
    // New CJ fields
    rating_avg,
    review_count,
    pack_num,
    multi_package,
    sale_status,
    cj_category_path,
    video_thumbnail,
    product_video:    videoUrl || null,
    cost_price_usd,
    is_discount_sell,
    is_customizable,
    light_unit,
    product_language,
  };
};
