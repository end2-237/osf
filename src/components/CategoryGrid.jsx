import React from "react";
import { Link } from "react-router-dom";

const CATS = [
  {
    name:  "Audio Lab",
    icon:  "fa-headphones",
    img:   "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=400",
    count: "120+",
    hot:   true,
  },
  {
    name:  "Streetwear",
    icon:  "fa-shirt",
    img:   "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=400",
    count: "85+",
  },
  {
    name:  "Mode Femme",
    icon:  "fa-person-dress",
    img:   "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=400",
    count: "40+",
    isNew: true,
  },
  {
    name:  "Sneakers",
    icon:  "fa-shoe-prints",
    img:   "https://images.unsplash.com/photo-1549298916-f52d724204b4?q=80&w=400",
    count: "60+",
    isNew: true,
  },
  {
    name:  "Tech Lab",
    icon:  "fa-microchip",
    img:   "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?q=80&w=400",
    count: "45+",
  },
  {
    name:  "Parfums",
    icon:  "fa-spray-can-sparkles",
    img:   "https://images.unsplash.com/photo-1587017539504-67cfbddac569?q=80&w=400",
    count: "30+",
    isNew: true,
  },
  {
    name:  "Accessoires",
    icon:  "fa-gem",
    img:   "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400",
    count: "95+",
  },
  {
    name:  "Flash Deals",
    icon:  "fa-bolt",
    img:   "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=400",
    count: "Offres",
    hot:   true,
  },
];

const CategoryGrid = () => {
  return (
    <section className="py-6 px-4 md:px-6 bg-[#EAEDED]">
      <div className="max-w-[1600px] mx-auto">

        {/* Amazon-style section grid of category cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
          {CATS.map((cat) => (
            <Link key={cat.name} to="/store"
              className="bg-white border border-[#D5D9D9] hover:border-[#FF9900] hover:shadow-md rounded p-3 transition-all group"
            >
              {/* HEADER */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-[#0F1111] text-sm group-hover:text-[#C45500] transition-colors leading-tight">
                  {cat.name}
                </h3>
                {(cat.hot || cat.isNew) && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cat.hot ? "bg-[#CC0C39] text-white" : "bg-[#FF9900] text-[#0F1111]"}`}>
                    {cat.hot ? "HOT" : "NEW"}
                  </span>
                )}
              </div>

              {/* IMAGE */}
              <div className="aspect-square overflow-hidden rounded mb-2">
                <img
                  src={cat.img}
                  alt={cat.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* FOOTER */}
              <p className="text-[#007185] text-[12px] font-medium group-hover:text-[#C45500] group-hover:underline transition-colors">
                Voir les {cat.count} articles →
              </p>
            </Link>
          ))}
        </div>

      </div>
    </section>
  );
};

export default CategoryGrid;
