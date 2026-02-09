import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-zinc-100 dark:bg-zinc-950 pt-24 pb-12 px-6 md:px-8 border-t dark:border-zinc-900">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
        <div className="col-span-1 md:col-span-2">
          <div className="logo-font font-bold text-3xl uppercase mb-6 italic">
            OneFree<span className="text-primary italic">Style</span>
          </div>
          <p className="text-zinc-500 max-w-sm text-base">
            Elite Concept Store à Douala. Streetwear, High-Tech, Audio & Culture.
          </p>
        </div>
        <div>
          <h5 className="font-black uppercase text-[10px] tracking-[0.3em] mb-6 text-primary underline underline-offset-8 decoration-primary italic">
            Shop
          </h5>
          <ul className="space-y-4 font-bold uppercase text-[9px] tracking-widest text-zinc-500">
            <li><a href="#audio-ads" className="hover:text-primary transition">Audio Lab</a></li>
            <li><a href="#shop" className="hover:text-primary transition">Streetwear</a></li>
          </ul>
        </div>
        <div>
          <h5 className="font-black uppercase text-[10px] tracking-[0.3em] mb-6 text-primary underline underline-offset-8 decoration-primary italic">
            Contact
          </h5>
          <p className="text-[9px] font-black text-zinc-500 mb-2 uppercase tracking-widest">
            Akwa, Douala, CM
          </p>
          <p className="text-[9px] font-black text-primary underline uppercase tracking-[0.2em]">
            contact@onefreestyle.space
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
