import React from 'react';

const Trends = () => {
  return (
    <section id="ads" className="py-12 px-4 md:px-8">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-4 h-auto">
        <div className="md:col-span-1 bg-zinc-100 dark:bg-zinc-800 p-10 bento-item relative overflow-hidden h-64">
          <h3 className="text-xl font-bold italic mb-4 uppercase">Trends</h3>
          <p className="text-4xl md:text-6xl font-black text-outline uppercase">TikTok</p>
          <i className="fa-brands fa-tiktok absolute -bottom-4 -right-4 text-8xl opacity-10"></i>
        </div>
        <div className="md:col-span-2 bg-black border border-white/10 bento-item flex items-center px-12 h-64 overflow-hidden relative group">
          <div className="z-10">
            <h3 className="text-2xl font-black text-white uppercase italic">Bundle Offer</h3>
            <p className="text-primary font-bold uppercase text-[10px] tracking-widest">-15% SUR LE PACK DE 2</p>
          </div>
          <img 
            src="https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?q=80&w=400" 
            className="absolute right-0 h-full object-cover opacity-50 group-hover:scale-110 transition duration-1000" 
          />
        </div>
        <div className="bg-primary p-10 flex flex-col justify-between bento-item h-64">
          <i className="fa-solid fa-bolt text-4xl text-black"></i>
          <h3 className="text-2xl font-black text-black leading-none uppercase italic">
            Livraison <br /> 2h Douala
          </h3>
        </div>
      </div>
    </section>
  );
};

export default Trends;
