import React from 'react';

const Marquee = () => {
  return (
    <section className="py-20 border-y dark:border-zinc-800 overflow-hidden bg-black text-white">
      <div className="flex animate-marquee whitespace-nowrap">
        <div className="flex space-x-20 px-10 items-center">
          <span className="text-4xl font-black italic uppercase">OneFreeStyle Audio Lab</span>
          <span className="text-4xl font-black text-outline uppercase tracking-tighter">Elite Technology</span>
          <span className="text-4xl font-black italic uppercase text-primary underline">Limited Drops</span>
          <span className="text-4xl font-black italic uppercase">OneFreeStyle Audio Lab</span>
          <span className="text-4xl font-black text-outline uppercase tracking-tighter">Elite Technology</span>
        </div>
        <div className="flex space-x-20 px-10 items-center">
          <span className="text-4xl font-black italic uppercase">OneFreeStyle Audio Lab</span>
          <span className="text-4xl font-black text-outline uppercase tracking-tighter">Elite Technology</span>
          <span className="text-4xl font-black italic uppercase text-primary underline">Limited Drops</span>
          <span className="text-4xl font-black italic uppercase">OneFreeStyle Audio Lab</span>
          <span className="text-4xl font-black text-outline uppercase tracking-tighter">Elite Technology</span>
        </div>
      </div>
    </section>
  );
};

export default Marquee;
