import React from 'react';

const FlashDrop = () => {
  return (
    <section className="py-20 bg-primary text-black relative overflow-hidden">
      <div className="absolute top-0 right-0 h-full w-1/3 opacity-10 flex items-center">
        <h2 className="text-[20rem] font-black italic select-none">SOUND</h2>
      </div>
      <div className="max-w-[1600px] mx-auto px-8 grid lg:grid-cols-2 items-center relative z-10">
        <div>
          <span className="font-black uppercase tracking-[0.5em] text-xs border-b-2 border-black pb-2 mb-8 inline-block">
            Flash Drop Elite
          </span>
          <h2 className="text-7xl md:text-9xl font-black italic tracking-tighter leading-none mb-10">
            THE <br /> ULTIMATE <br /> BEAT.
          </h2>
          <p className="text-xl font-bold max-w-sm mb-10">
            Immersion totale. Basses sismiques. Design OneFreeStyle. Ne laissez personne dicter votre rythme.
          </p>
          <button className="bg-black text-white px-12 py-6 font-black uppercase text-xs tracking-widest hover:scale-105 transition transform">
            Réserver l'édition limitée
          </button>
        </div>
        <div className="hidden lg:block">
          <img 
            src="https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=80&w=1000" 
            className="w-full h-[600px] object-cover rounded-[3rem] shadow-[-30px_30px_0px_#000]" 
          />
        </div>
      </div>
    </section>
  );
};

export default FlashDrop;
