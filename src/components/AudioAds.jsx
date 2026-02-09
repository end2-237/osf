import React from 'react';

const AudioAds = ({ openModal }) => {
  return (
    <section id="audio-ads" className="py-12 px-4 md:px-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 relative h-[500px] rounded-[2rem] overflow-hidden group cursor-pointer bento-item">
            <img 
              src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1200" 
              className="w-full h-full object-cover transition duration-1000 group-hover:scale-105" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent p-12 flex flex-col justify-end">
              <span className="text-primary font-black uppercase tracking-[0.5em] text-[12px] mb-4">Master Audio Series</span>
              <h2 className="text-5xl md:text-7xl font-black text-white italic tracking-tighter leading-none mb-6">
                SONIC <br /> ONEFREESTYLE X1
              </h2>
              <button 
                onClick={() => openModal(1)} 
                className="w-fit bg-primary text-black px-8 py-4 font-black uppercase text-[10px] tracking-widest hover:scale-110 transition"
              >
                Découvrir le son
              </button>
            </div>
          </div>
          <div 
            className="bg-[#111] rounded-[2rem] overflow-hidden p-10 flex flex-col justify-between border border-white/5 bento-item group cursor-pointer" 
            onClick={() => openModal(2)}
          >
            <div>
              <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest block mb-2 underline decoration-primary underline-offset-4">
                Wireless Identity
              </span>
              <h3 className="text-3xl font-black italic uppercase leading-tight">
                Neon Buds <br /> <span className="text-primary">V2 Pro</span>
              </h3>
            </div>
            <img 
              src="https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=600" 
              className="w-full grayscale group-hover:grayscale-0 transition duration-500" 
            />
            <div className="flex justify-between items-center">
              <span className="font-black text-xl italic tracking-tighter">45.000 FCFA</span>
              <i className="fa-solid fa-plus bg-white text-black p-3 rounded-full"></i>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AudioAds;
