// ════════════════════════════════════════════════════════════════════════════
// LIVE SHOPPING — données de démonstration
// Structure pensée pour être remplacée par des tables Supabase :
//   creators, live_shows, live_auctions, bids, follows, show_messages.
// Prix en FCFA. Images Unsplash (placeholder).
// ════════════════════════════════════════════════════════════════════════════

export const LIVE_CATEGORIES = [
  { key: "tops",    label: "Tops",    img: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=300" },
  { key: "dresses", label: "Robes",   img: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=300" },
  { key: "shoes",   label: "Shoes",   img: "https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=300" },
  { key: "bags",    label: "Sacs",    img: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=300" },
  { key: "bottoms", label: "Bottoms", img: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&w=300" },
  { key: "beauty",  label: "Beauté",  img: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?q=80&w=300" },
];

export const LIVE_FILTERS = ["Robes", "Femme", "Homme", "Shoes", "Sacs", "Tops", "Beauté"];

export const CREATORS = {
  jirehsales: {
    handle: "jirehsales",
    name: "JirehSales",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=300",
    cover: "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1200",
    rating: 4.9,
    ratingCount: "1.1k",
    followers: 7800,
    following: 120,
    reviews: "1.1k",
    sold: "7.8k",
    shipTime: "2j",
    bio: "Live fashion deals · Douala 🇨🇲 · Livraison express",
    live: true,
    verified: true,
  },
  stylefinds: {
    handle: "stylefinds",
    name: "Style Finds",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300",
    cover: "https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=1200",
    rating: 4.8,
    ratingCount: "820",
    followers: 4200,
    following: 88,
    reviews: "820",
    sold: "3.4k",
    shipTime: "3j",
    bio: "Streetwear & sneakers · Yaoundé",
    live: true,
    verified: true,
  },
  bellamode: {
    handle: "bellamode",
    name: "Bella Mode",
    avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?q=80&w=300",
    cover: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200",
    rating: 4.7,
    ratingCount: "560",
    followers: 3100,
    following: 210,
    reviews: "560",
    sold: "2.1k",
    shipTime: "2j",
    bio: "Mode femme & accessoires",
    live: false,
    verified: false,
  },
};

// Enchères live en cours
export const LIVE_AUCTIONS = [
  {
    id: "auc-1",
    title: "Cardigan tricot vintage",
    size: "M · Excellent état",
    creator: "jirehsales",
    img: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?q=80&w=600",
    currentBid: 17000,
    nextBid: 18500,
    bids: 3,
    viewers: 1200,
    endsInSec: 610,
    live: true,
  },
  {
    id: "auc-2",
    title: "Pull oversize crème",
    size: "L · Neuf",
    creator: "stylefinds",
    img: "https://images.unsplash.com/photo-1576871337622-98d48d1cf531?q=80&w=600",
    currentBid: 19500,
    nextBid: 21000,
    bids: 5,
    viewers: 1500,
    endsInSec: 480,
    live: true,
  },
  {
    id: "auc-3",
    title: "Veste en jean délavée",
    size: "S · Très bon état",
    creator: "bellamode",
    img: "https://images.unsplash.com/photo-1516257984-b1b4d707412e?q=80&w=600",
    currentBid: 12000,
    nextBid: 13000,
    bids: 2,
    viewers: 640,
    endsInSec: 900,
    live: true,
  },
  {
    id: "auc-4",
    title: "Sac à main cuir camel",
    size: "Unique · Neuf",
    creator: "jirehsales",
    img: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?q=80&w=600",
    currentBid: 28000,
    nextBid: 30000,
    bids: 7,
    viewers: 2100,
    endsInSec: 300,
    live: true,
  },
];

// Shows live (streaming)
export const LIVE_SHOWS = [
  {
    id: "show-1",
    title: "Style Finds — Live deals",
    creator: "jirehsales",
    cover: "https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=800",
    viewers: 1200,
    live: true,
    startsAt: null,
  },
  {
    id: "show-2",
    title: "Sneaker drops du soir",
    creator: "stylefinds",
    cover: "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=800",
    viewers: 1200,
    live: true,
    startsAt: null,
  },
  {
    id: "show-3",
    title: "Robes de soirée",
    creator: "bellamode",
    cover: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=800",
    viewers: 0,
    live: false,
    startsAt: "Jeu. 19:10",
  },
  {
    id: "show-4",
    title: "Accessoires premium",
    creator: "jirehsales",
    cover: "https://images.unsplash.com/photo-1523293182086-7651a899d37f?q=80&w=800",
    viewers: 0,
    live: false,
    startsAt: "Dim. 20:25",
  },
];

// Détail d'un live (viewer)
export const LIVE_STREAM_DETAIL = {
  "show-1": {
    id: "show-1",
    creator: "jirehsales",
    poster: "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1000",
    viewers: 842,
    elapsed: "12:45",
    product: {
      name: "Cardigan tricot vintage",
      size: "M · Excellent état",
      img: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?q=80&w=400",
      currentBid: 17000,
      nextBid: 18500,
      buyNow: 28000,
      freeShipping: true,
      returns: "Retour 15 jours",
    },
    messages: [
      { user: "lexfinds",     text: "J'adore ! 😍" },
      { user: "mikecollects", text: "C'est oversize ?" },
      { user: "sarahh.lee",   text: "🔥🔥🔥" },
      { user: "john_doe",     text: "Elle porte quelle taille ?" },
    ],
  },
};

export const getCreator = (handle) => CREATORS[handle] || CREATORS.jirehsales;

export const formatCount = (n) => {
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
  return String(n);
};

export const fcfa = (n) => Number(n).toLocaleString("fr-FR") + " F";

export const mmss = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
