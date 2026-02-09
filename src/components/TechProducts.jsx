import React from 'react';

const TechProducts = ({ openModal }) => {
  return (
    <section className="py-24 px-4 md:px-8">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <div 
          className="bg-zinc-900 rounded-[3rem] p-12 flex flex-col justify-center border border-white/5 bento-item group cursor-pointer" 
          onClick={() => openModal(3)}
        >
          <h3 className="text-5xl font-black italic text-primary uppercase mb-6 leading-tight">
            CYBER <br /> SPEAKER 80W
          </h3>
          <p className="text-zinc-500 mb-8 max-w-sm">
            Synchronisation LED. Basses profondes. L'enceinte qui transforme Douala en festival.
          </p>
          <div className="flex items-center space-x-4">
            <span className="text-3xl font-black text-white">65.000 FCFA</span>
            <i className="fa-solid fa-arrow-right text-primary"></i>
          </div>
          <img 
            src="https://images.unsplash.com/photo-1589003077984-894e133dabab?q=80&w=600" 
            className="w-1/2 mt-10 ml-auto group-hover:scale-110 transition" 
          />
        </div>
        <div 
          className="bg-zinc-100 dark:bg-zinc-900 rounded-[3rem] p-12 overflow-hidden relative bento-item group cursor-pointer" 
          onClick={() => openModal(4)}
        >
          <h3 className="text-5xl font-black italic uppercase mb-6 leading-tight">
            VR LAB <br /> ALPHA 4K
          </h3>
          <p className="text-zinc-400 mb-8 max-w-sm">
            La réalité virtuelle, version OneFreestyle Elite. Immersion visuelle et sonore totale.
          </p>
          <button className="bg-black dark:bg-white text-white dark:text-black px-8 py-3 font-black text-[10px] uppercase tracking-widest">
            Entrer dans la matrice
          </button>
          <img 
            src="https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?q=80&w=600" 
            className="absolute -right-20 -bottom-10 w-3/4 opacity-40 group-hover:opacity-100 transition" 
          />
        </div>
      </div>
    </section>
  );
};

export default TechProducts;
