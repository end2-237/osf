// ════════════════════════════════════════════════════════════════════════════
// LIVE SHOPPING — couche données + temps réel (Supabase Realtime)
// Tables : live_shows, live_products, live_bids, live_messages, follows, live_saves
// ════════════════════════════════════════════════════════════════════════════
import { supabase } from "./supabase";

// ─── Catégories (taxonomie complète du store) ───
export const LIVE_CATEGORIES = [
  { key: "Audio Lab",      label: "Audio Lab",   icon: "fa-headphones"         },
  { key: "Tech Lab",       label: "Tech Lab",    icon: "fa-microchip"          },
  { key: "Femme",          label: "Pour Elle",   icon: "fa-person-dress"       },
  { key: "Clothing",       label: "Pour Lui",    icon: "fa-shirt"              },
  { key: "Shoes",          label: "Sneakers",    icon: "fa-shoe-prints"        },
  { key: "Beauté",         label: "Beauté",      icon: "fa-spray-can-sparkles" },
  { key: "Accessories",    label: "Accessoires", icon: "fa-gem"                },
  { key: "Maison",         label: "Maison",      icon: "fa-house"              },
  { key: "Sport",          label: "Sport",       icon: "fa-dumbbell"           },
  { key: "Bébé & Enfants", label: "Enfants",     icon: "fa-baby"               },
  { key: "Auto",           label: "Auto",        icon: "fa-car"                },
];

// ─── Formatters ───
export const formatCount = (n) => {
  n = Number(n) || 0;
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return String(n);
};
export const fcfa = (n) => (Number(n) || 0).toLocaleString("fr-FR") + " F";
export const mmss = (sec) => {
  sec = Math.max(0, Math.floor(sec || 0));
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
};
export const AVATAR_FALLBACK = "https://api.dicebear.com/7.x/initials/svg?seed=";

// ─── Enrichit les shows avec les infos créateur (vendor + avatar profil) ───
async function enrichShows(shows) {
  if (!shows?.length) return [];
  const hostIds = [...new Set(shows.map(s => s.host_user_id).filter(Boolean))];
  let profs = {};
  if (hostIds.length) {
    const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", hostIds);
    (data || []).forEach(p => { profs[p.id] = p; });
  }
  return shows.map(s => {
    const prof = profs[s.host_user_id] || {};
    const name = s.vendor?.shop_name || prof.full_name || "Créateur";
    return {
      ...s,
      creatorName:   name,
      creatorAvatar: prof.avatar_url || (AVATAR_FALLBACK + encodeURIComponent(name)),
      creatorHandle: s.vendor?.shop_name || s.host_user_id,
    };
  });
}

// ─── HUB : shows (live d'abord, puis programmés) ───
export async function fetchShows({ category } = {}) {
  let q = supabase
    .from("live_shows")
    .select("*, vendor:vendors!vendor_id(id, shop_name, user_id)")
    .in("status", ["live", "scheduled"])
    .order("status", { ascending: true })   // 'live' < 'scheduled'
    .order("started_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (category && category !== "All") q = q.eq("category", category);
  const { data, error } = await q;
  if (error) { console.warn("[fetchShows]", error.message); return []; }
  return enrichShows(data || []);
}

// ─── Un show + son produit actif courant ───
export async function fetchShow(showId) {
  const { data: show } = await supabase
    .from("live_shows")
    .select("*, vendor:vendors!vendor_id(id, shop_name, user_id)")
    .eq("id", showId).maybeSingle();
  if (!show) return null;
  const [enriched] = await enrichShows([show]);
  const product = await fetchActiveProduct(showId);
  return { ...enriched, product };
}

export async function fetchActiveProduct(showId) {
  const { data } = await supabase
    .from("live_products").select("*")
    .eq("show_id", showId)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0] || null;
}

// Produits déjà vendus d'un show (pour le bandeau "vendus" flouté)
export async function fetchSoldProducts(showId) {
  const { data } = await supabase
    .from("live_products").select("id, name, img, sold_price, sold_to_name")
    .eq("show_id", showId).eq("status", "sold")
    .order("sold_at", { ascending: false });
  return data || [];
}

// Adjuger l'enchère en cours au meilleur enchérisseur (hôte)
export async function awardProduct(productId) {
  const { data, error } = await supabase.rpc("award_live_product", { p_product_id: productId });
  if (error) throw error;
  return data;
}

// Produits de la boutique du vendeur (pour les présenter à l'antenne)
export async function getVendorProducts(vendorId) {
  const { data } = await supabase
    .from("products").select("id, name, img, price, type")
    .eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(60);
  return data || [];
}

// Créateurs suivis + leur statut live (pour l'accueil)
export async function fetchFollowedLive(userId) {
  if (!userId) return [];
  const { data: fol } = await supabase.from("follows").select("vendor_id").eq("follower_id", userId);
  const vendorIds = (fol || []).map(f => f.vendor_id);
  if (!vendorIds.length) return [];
  const { data: vendors } = await supabase.from("vendors").select("id, shop_name, user_id").in("id", vendorIds);
  const { data: shows } = await supabase.from("live_shows")
    .select("id, vendor_id, status, cover_url, title").in("vendor_id", vendorIds).in("status", ["live", "scheduled"]);
  const hostIds = (vendors || []).map(v => v.user_id);
  let profs = {};
  if (hostIds.length) {
    const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", hostIds);
    (data || []).forEach(p => { profs[p.id] = p; });
  }
  return (vendors || []).map(v => {
    const live = (shows || []).find(s => s.vendor_id === v.id && s.status === "live");
    const next = (shows || []).find(s => s.vendor_id === v.id);
    const prof = profs[v.user_id] || {};
    const name = v.shop_name || prof.full_name || "Créateur";
    return {
      vendorId: v.id, handle: v.shop_name || v.user_id, name,
      avatar: prof.avatar_url || (AVATAR_FALLBACK + encodeURIComponent(name)),
      live: !!live, showId: (live || next)?.id || null,
    };
  }).sort((a, b) => Number(b.live) - Number(a.live));
}

// Lives mis en favori par l'utilisateur
export async function fetchSavedLives(userId) {
  if (!userId) return [];
  const { data: saves } = await supabase.from("live_saves").select("show_id").eq("user_id", userId);
  const ids = (saves || []).map(s => s.show_id);
  if (!ids.length) return [];
  const { data } = await supabase
    .from("live_shows").select("*, vendor:vendors!vendor_id(id, shop_name, user_id)").in("id", ids);
  return enrichShows(data || []);
}

export async function fetchMessages(showId, limit = 50) {
  const { data } = await supabase
    .from("live_messages").select("*")
    .eq("show_id", showId).order("created_at", { ascending: true }).limit(limit);
  return data || [];
}

// ─── Chat / commentaire (avec image optionnelle) ───
export async function uploadLiveImage(file, userId) {
  const path = `comments/${userId || "anon"}/${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("live-media").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("live-media").getPublicUrl(path).data.publicUrl;
}

export async function postMessage({ showId, userId, userName, text, imageUrl }) {
  const { error } = await supabase.from("live_messages").insert({
    show_id: showId, user_id: userId, user_name: userName,
    text: text || null, image_url: imageUrl || null, kind: "chat",
  });
  if (error) throw error;
}

// ─── Enchère / achat (RPC serveur) ───
export async function placeBid(productId, userName) {
  const { data, error } = await supabase.rpc("place_live_bid", { p_product_id: productId, p_user_name: userName });
  if (error) throw error;
  return data;
}
export async function buyNow(productId, userName) {
  const { data, error } = await supabase.rpc("buy_live_product", { p_product_id: productId, p_user_name: userName });
  if (error) throw error;
  return data;
}

// ─── Follow ───
export async function getFollowerCount(vendorId) {
  const { count } = await supabase.from("follows").select("id", { count: "exact", head: true }).eq("vendor_id", vendorId);
  return count || 0;
}
export async function isFollowing(vendorId, userId) {
  if (!userId) return false;
  const { data } = await supabase.from("follows").select("id").eq("vendor_id", vendorId).eq("follower_id", userId).maybeSingle();
  return !!data;
}
export async function toggleFollow(vendorId, userId, follow) {
  if (follow) return supabase.from("follows").insert({ vendor_id: vendorId, follower_id: userId });
  return supabase.from("follows").delete().eq("vendor_id", vendorId).eq("follower_id", userId);
}

// ─── Favoris (saves) ───
export async function isSaved(showId, userId) {
  if (!userId) return false;
  const { data } = await supabase.from("live_saves").select("id").eq("show_id", showId).eq("user_id", userId).maybeSingle();
  return !!data;
}
export async function toggleSave(showId, userId, save) {
  if (save) return supabase.from("live_saves").insert({ show_id: showId, user_id: userId });
  return supabase.from("live_saves").delete().eq("show_id", showId).eq("user_id", userId);
}

// ─── REALTIME : abonnement à un show (chat + produit + statut + présence) ───
// handlers : { onMessage, onProduct, onShow, onViewers }
export function subscribeToShow(showId, presenceKey, handlers = {}) {
  const channel = supabase.channel(`live:${showId}`, { config: { presence: { key: presenceKey || "anon" } } });

  channel
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_messages", filter: `show_id=eq.${showId}` },
        (p) => handlers.onMessage?.(p.new))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_products", filter: `show_id=eq.${showId}` },
        (p) => handlers.onProduct?.(p.new))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_products", filter: `show_id=eq.${showId}` },
        (p) => handlers.onProduct?.(p.new))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_shows", filter: `id=eq.${showId}` },
        (p) => handlers.onShow?.(p.new))
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      handlers.onViewers?.(Object.keys(state).length);
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") await channel.track({ online_at: new Date().toISOString() });
    });

  return channel;
}
export function unsubscribe(channel) { if (channel) supabase.removeChannel(channel); }

// ════════════════════════════════════════════════════════════════════════════
// CÔTÉ VENDEUR
// ════════════════════════════════════════════════════════════════════════════
export async function getVendorShows(vendorId) {
  const { data } = await supabase.from("live_shows").select("*").eq("vendor_id", vendorId).order("created_at", { ascending: false });
  return data || [];
}
export async function createShow({ vendor, title, category, coverUrl }) {
  const { data, error } = await supabase.from("live_shows").insert({
    vendor_id: vendor.id, host_user_id: vendor.user_id,
    title, category, cover_url: coverUrl || null, status: "scheduled",
  }).select().single();
  if (error) throw error;
  return data;
}
export async function setShowStatus(showId, status) {
  const patch = { status };
  if (status === "live")  patch.started_at = new Date().toISOString();
  if (status === "ended") patch.ended_at   = new Date().toISOString();
  const { error } = await supabase.from("live_shows").update(patch).eq("id", showId);
  if (error) throw error;
}
export async function updateViewerPeak(showId, count) {
  await supabase.from("live_shows").update({ viewer_count: count }).eq("id", showId);
}
export async function addLiveProduct(showId, p) {
  const start = Number(p.start_price) || 0;
  const step  = Number(p.bid_step) || 500;
  const { data, error } = await supabase.from("live_products").insert({
    show_id: showId, name: p.name, img: p.img || null, size: p.size || null,
    description: p.description || null, mode: p.mode || "auction",
    start_price: start, current_bid: start, bid_step: step, next_bid: start + step,
    buy_now: p.buy_now ? Number(p.buy_now) : null, status: "active", is_featured: true,
  }).select().single();
  if (error) throw error;
  return data;
}
export async function endProduct(productId) {
  await supabase.from("live_products").update({ status: "ended" }).eq("id", productId);
}
export async function fetchShowBids(showId, limit = 30) {
  const { data } = await supabase.from("live_bids").select("*").eq("show_id", showId)
    .order("created_at", { ascending: false }).limit(limit);
  return data || [];
}
