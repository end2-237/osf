import React from 'react';

const Hero = () => {
  return (
    <section id="home" className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      <div className="absolute right-0 top-0 w-1/2 h-full bg-zinc-100 dark:bg-zinc-900 z-0 hidden lg:block"></div>
      <div className="max-w-[1600px] mx-auto px-6 md:px-8 w-full grid lg:grid-cols-2 gap-0 z-10">
        <div className="py-12 md:py-20 text-center lg:text-left">
          <h1 className="text-6xl md:text-8xl lg:text-[12rem] font-black leading-[0.8] tracking-tighter mb-10 uppercase">
            BEYOND <br /> <span className="text-primary italic">LIMITS.</span>
          </h1>
          <div className="flex flex-col md:flex-row items-center justify-center lg:justify-start space-y-6 md:space-y-0 md:space-x-8">
            <button 
              onClick={() => window.location.href = '#shop'} 
              className="w-full md:w-auto bg-black dark:bg-white dark:text-black text-white px-12 py-6 font-black uppercase text-xs tracking-[0.2em] hover:bg-primary transition-all"
            >
              Shop Collection
            </button>
            <a href="studio.html" className="group flex items-center space-x-4">
              <span className="font-black text-2xl tracking-tighter group-hover:text-primary transition">Studio Lab</span>
              <i className="fa-solid fa-arrow-right group-hover:translate-x-2 transition text-primary"></i>
            </a>
          </div>
        </div>
        <div className="relative flex items-center justify-center p-4 md:p-10">
          <div className="absolute w-[300px] h-[300px] md:w-[500px] md:h-[500px] border border-primary/20 rounded-full animate-spin-slow"></div>
          <img 
            src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1000" 
            className="relative z-10 w-full max-w-[280px] md:max-w-md shadow-[30px_30px_0px_#00ff88]" 
            alt="Hero Image" 
          />
        </div>
      </div>
    </section>
  );
};

export default Hero;
