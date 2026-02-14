import React from 'react';
import { Link } from 'react-router-dom';

const CATS = [
  {
    name: 'Audio Lab',
    icon: 'fa-headphones',
    img: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=400',
    count: '120+',
    color: '#00ff88',
    hot: true,
  },
  {
    name: 'Streetwear',
    icon: 'fa-shirt',
    img: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=400',
    count: '85+',
    color: '#a855f7',
  },
  {
    name: 'Sneakers',
    icon: 'fa-shoe-prints',
    img: 'https://images.unsplash.com/photo-1549298916-f52d724204b4?q=80&w=1113&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    count: '60+',
    color: '#f97316',
    new: true,
  },
  {
    name: 'Tech Lab',
    icon: 'fa-microchip',
    img: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?q=80&w=400',
    count: '45+',
    color: '#3b82f6',
  },
  {
    name: 'Parfums',
    icon: 'fa-spray-can-sparkles',
    img: 'https://images.unsplash.com/photo-1587017539504-67cfbddac569?q=80&w=735&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    count: '30+',
    color: '#ec4899',
    new: true,
  },
  {
    name: 'Accessoires',
    icon: 'fa-gem',
    img: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400',
    count: '95+',
    color: '#eab308',
  },
];

const CategoryGrid = () => {
  return (
    <section className="py-8 px-4 md:px-8 bg-white dark:bg-black">
      <div className="max-w-[1600px] mx-auto">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-1 h-8 bg-primary rounded-full"></div>
            <h2 className="text-xl font-black uppercase tracking-tighter dark:text-white text-zinc-900">
              Explorer par <span className="text-primary italic">Catégorie</span>
            </h2>
          </div>
          <Link
            to="/store"
            className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 hover:underline decoration-primary underline-offset-4"
          >
            <span>Tout voir</span>
            <i className="fa-solid fa-arrow-right text-xs"></i>
          </Link>
        </div>

        {/* CATEGORY GRID */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {CATS.map((cat) => (
            <Link
              key={cat.name}
              to="/store"
              className="group relative overflow-hidden rounded-2xl aspect-square cursor-pointer"
            >
              {/* BG IMAGE */}
              <img
                src={cat.img}
                alt={cat.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale-[20%]"
              />

              {/* OVERLAY */}
              <div
                className="absolute inset-0 transition-opacity duration-500"
                style={{
                  background: `linear-gradient(to top, ${cat.color}60 0%, transparent 60%)`,
                  opacity: 0.8,
                }}
              ></div>
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors duration-500"></div>

              {/* BADGE */}
              {(cat.hot || cat.new) && (
                <div
                  className="absolute top-2 left-2 z-20 text-[8px] font-black uppercase px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: cat.color, color: '#000' }}
                >
                  {cat.hot ? 'HOT' : 'NEW'}
                </div>
              )}

              {/* CONTENT */}
              <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center mb-2 transition-all duration-300 group-hover:scale-110"
                  style={{ backgroundColor: `${cat.color}20`, border: `1px solid ${cat.color}40` }}
                >
                  <i className={`fa-solid ${cat.icon} text-xs`} style={{ color: cat.color }}></i>
                </div>
                <p className="text-white font-black text-[11px] uppercase leading-tight">{cat.name}</p>
                <p className="font-bold text-[9px] mt-0.5" style={{ color: cat.color }}>{cat.count} items</p>
              </div>

              {/* HOVER ARROW */}
              <div className="absolute top-2 right-2 w-7 h-7 bg-white/10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 backdrop-blur-sm">
                <i className="fa-solid fa-arrow-right text-white text-xs"></i>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </section>
  );
};

export default CategoryGrid;