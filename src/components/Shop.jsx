import React from 'react';
import ProductCard from './ProductCard';
import { products } from '../data/products';

const Shop = ({ openModal, addToCart }) => {
  return (
    <section id="shop" className="py-24 px-4 md:px-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-[1600px] mx-auto text-center">
        <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-20 italic">
          Elite <span className="text-primary underline decoration-black dark:decoration-white">Collection</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 md:gap-x-8 gap-y-12 md:gap-y-16">
          {products.map(product => (
            <ProductCard 
              key={product.id} 
              product={product} 
              openModal={openModal} 
              addToCart={addToCart} 
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Shop;
