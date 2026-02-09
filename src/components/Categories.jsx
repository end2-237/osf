import React from 'react';

const Categories = () => {
  const categories = [
    { icon: 'fa-headphones', name: 'Audio' },
    { icon: 'fa-shirt', name: 'Apparel' },
    { icon: 'fa-vr-cardboard', name: 'Tech' },
    { icon: 'fa-shoe-prints', name: 'Footwear' }
  ];

  return (
    <section className="py-10">
      <div className="flex overflow-x-auto gap-8 px-8 py-10 hide-scrollbar justify-start md:justify-center">
        {categories.map((category, index) => (
          <div key={index} className="min-w-[150px] text-center group cursor-pointer transform hover:-translate-y-4 transition duration-500">
            <div className="w-24 h-24 mx-auto bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary transition">
              <i className={`fa-solid ${category.icon} text-3xl group-hover:text-black`}></i>
            </div>
            <span className="font-black uppercase text-[10px] tracking-widest">{category.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Categories;
