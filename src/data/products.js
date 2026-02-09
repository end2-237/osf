export const products = [
  {
    id: 1,
    name: "AirPods Pro 2",
    price: 185000,
    type: "Audio Lab",
    status: "Elite Choice",
    img: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?q=80&w=1000",
    features: ["Puce H2", "Réduction Bruit Pro", "Audio Spatial Personnalisé", "30h Autonomie"]
  },
  {
    id: 2,
    name: "Sonic Elite X1",
    price: 125000,
    type: "Audio Lab",
    status: "Master Series",
    img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1200",
    features: ["360° Spatial Audio", "Active Noise Cancelling Pro", "45h Battery Life", "Freestyle Design"]
  },
  {
    id: 3,
    name: "AirPods Max Elite",
    price: 450000,
    type: "Audio Lab",
    status: "Premium",
    img: "https://images.unsplash.com/photo-1613040809024-b4ef7ba99bc3?q=80&w=1000",
    features: ["Transducteur Dynamique", "Mode Transparence", "Tricot en Mesh", "Acier Inoxydable"]
  },
  {
    id: 4,
    name: "Neon Buds Pro V2",
    price: 45000,
    type: "Audio Lab",
    status: "New Drop",
    img: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=600",
    features: ["Waterproof IPX8", "Touch Control Identity", "Bass Boost Tech", "Minimalist Case"]
  },
  {
    id: 5,
    name: "Cyber Speaker Studio",
    price: 65000,
    type: "Audio Lab",
    status: "In Stock",
    img: "https://images.unsplash.com/photo-1589003077984-894e133dabab?q=80&w=600",
    features: ["LED Sync Mode", "Deep Subwoofer", "Portable Elite", "80W Sound Power"]
  },
  {
    id: 6,
    name: "Studio Headphones Pro",
    price: 95000,
    type: "Audio Lab",
    status: "Hot",
    img: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=80&w=1000",
    features: ["Monitor Grade Sound", "Foldable Design", "Detachable Cable", "Elite Comfort"]
  },
  {
    id: 7,
    name: "Phantom Buds Wireless",
    price: 35000,
    type: "Audio Lab",
    status: "Limited",
    img: "https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?q=80&w=1000",
    features: ["Ultra Light", "Fast Charge", "Crystal Clear Voice", "Matte Finish"]
  },
  {
    id: 8,
    name: "Elite Soundbar X",
    price: 155000,
    type: "Audio Lab",
    status: "Master Series",
    img: "https://images.unsplash.com/photo-1545454675-3531b543be5d?q=80&w=1000",
    features: ["Dolby Atmos 5.1", "Wireless Sub", "Titanium Drivers", "Smart Connect"]
  },
  {
    id: 9,
    name: "VR Headset Alpha",
    price: 185000,
    type: "Tech Lab",
    status: "Elite Only",
    img: "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?q=80&w=600",
    features: ["4K HDR Lenses", "Wireless Freedom", "Gesture Tracking", "Ultra-lightweight"]
  },
  {
    id: 10,
    name: "Veste Tech-Utility",
    price: 55000,
    type: "Clothing",
    status: "New",
    img: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=500",
    features: ["Ripstop Fabric", "Tactical Pockets", "Oversize Fit"]
  },
  {
    id: 11,
    name: "Sneakers Gravity X",
    price: 85000,
    type: "Shoes",
    status: "Promo",
    oldPrice: 110000,
    img: "https://images.unsplash.com/photo-1552066344-24632e509633?q=80&w=500",
    features: ["Air Sole System", "Italian Leather", "Reflective Identity"]
  }
];

// Générer les produits supplémentaires pour atteindre le quota de la marketplace
const types = ["Clothing", "Shoes", "Audio Lab", "Tech Lab"];
for (let i = 12; i <= 40; i++) {
  products.push({
    id: i,
    name: `Elite Piece #${i}`,
    price: 15000 + (i * 2500),
    type: types[i % 4],
    status: i % 5 === 0 ? "Best Seller" : "In Stock",
    img: `https://picsum.photos/600/800?random=${i}`,
    features: ["Elite Quality", "Unique Design", "Certified Authenticity", "Limited Edition"]
  });
}