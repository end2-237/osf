import React, { useState, useEffect } from 'react';

/**
 * ✅ ProductModal optimisé pour les noms longs et la stabilité du layout.
 * Empêche le dépassement du contenu et sécurise la visibilité du bouton d'action.
 */
const ProductModal = ({ isOpen, product, closeModal, addToCart }) => {
  const [size, setSize] = useState('M');
  const [color, setColor] = useState('Black');
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (product) {
      setSize('M');
      setColor('Black');
      setQty(1);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const isApparel = product.type === 'Clothing';
  const isShoes = product.type === 'Shoes';

  const handleAddToCart = () => {
    addToCart({
      ...product,
      selectedSize: (isApparel || isShoes) ? size : 'Unique',
      selectedColor: color,
      quantity: qty,
    });
    closeModal();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl animate-fadeIn" onClick={closeModal}></div>

      <div className="bg-white dark:bg-zinc-950 w-full max-w-6xl h-[90vh] md:h-[85vh] rounded-[2rem] md:rounded-[3rem] overflow-hidden relative z-10 grid md:grid-cols-2 shadow-2xl animate-modalUp">

        {/* SECTION IMAGE */}
        <div className="hidden md:block h-full bg-zinc-100 dark:bg-zinc-900 relative group overflow-hidden">
          <img
            src={product.img}
            className="w-full h-full object-cover transition duration-700 group-hover:scale-105"
            alt={product.name}
          />
          <div className="absolute top-6 left-6 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <span className="text-primary font-black text-[10px] uppercase tracking-widest italic">
              OneFreestyle Authentic
            </span>
          </div>
        </div>

        {/* SECTION DETAILS */}
        <div className="p-6 md:p-12 flex flex-col h-full overflow-hidden">
          
          {/* ZONE SCROLLABLE POUR LE CONTENU */}
          <div className="flex-grow overflow-y-auto pr-2 space-y-6 custom-scrollbar">
            <div>
              <span className="text-primary font-black uppercase text-[10px] tracking-[0.4em] mb-2 block underline decoration-primary underline-offset-8">
                {product.type} Selection
              </span>
              {/* ✅ LIMITATION DU TITRE À 2 LIGNES */}
              <h3 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic leading-none text-zinc-900 dark:text-white line-clamp-2">
                {product.name}
              </h3>
            </div>

            <div className="space-y-6">
              {/* COULEUR */}
              <div>
                <p className="text-[10px] font-black uppercase mb-3 tracking-widest text-zinc-500 italic">
                  Color: <span className="text-zinc-900 dark:text-white">{color}</span>
                </p>
                <div className="flex space-x-3">
                  {['Black', 'White', 'Neon'].map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full border-4 transition-all duration-300 ${
                        color === c ? 'border-primary scale-110' : 'border-transparent opacity-50'
                      }`}
                      style={{ backgroundColor: c.toLowerCase() === 'neon' ? '#00ff88' : c.toLowerCase() }}
                    />
                  ))}
                </div>
              </div>

              {/* TAILLE DYNAMIQUE */}
              {(isApparel || isShoes) && (
                <div className="animate-fadeIn">
                  <p className="text-[10px] font-black uppercase mb-3 tracking-widest text-zinc-500 italic">
                    Select Size
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(isShoes ? ['40', '41', '42', '43', '44'] : ['S', 'M', 'L', 'XL', 'XXL']).map(s => (
                      <button
                        key={s}
                        onClick={() => setSize(s)}
                        className={`min-w-[45px] h-10 px-3 text-[10px] font-black border-2 transition-all rounded-xl ${
                          size === s
                            ? 'bg-primary text-black border-primary shadow-lg'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-white'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* FEATURES / SPECS */}
              {!isApparel && !isShoes && product.features?.length > 0 && (
                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-white/5">
                  <div className="grid grid-cols-1 gap-2">
                    {product.features.slice(0, 4).map((f, i) => (
                      <div key={i} className="flex items-center space-x-3 text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase italic">
                        <i className="fa-solid fa-bolt text-primary text-[8px]"></i>
                        <span className="truncate">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ✅ FOOTER FIXE (NE BOUGE JAMAIS) */}
          <div className="border-t dark:border-zinc-900 pt-6 mt-4 bg-white dark:bg-zinc-950">
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest italic mb-1">
                  Unit Price
                </span>
                <span className="text-2xl md:text-3xl font-black italic tracking-tighter text-zinc-900 dark:text-white">
                  {Number(product.price).toLocaleString()} FCFA
                </span>
              </div>

              {/* QUANTITY */}
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 rounded-full px-3 py-1 border border-white/5">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="w-8 h-8 text-zinc-500 hover:text-primary transition font-bold"
                >
                  -
                </button>
                <span className="font-black text-xs px-3 min-w-[30px] text-center">{qty}</span>
                <button
                  onClick={() => setQty(qty + 1)}
                  className="w-8 h-8 text-zinc-500 hover:text-primary transition font-bold"
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              className="w-full bg-primary text-black py-4 md:py-5 font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-[0_15px_40px_rgba(0,255,136,0.3)] hover:scale-[1.01] active:scale-95 transition-all duration-300 flex items-center justify-center space-x-3"
            >
              <i className="fa-solid fa-bag-shopping"></i>
              <span>Lock into Arsenal</span>
            </button>
          </div>
        </div>

        {/* CLOSE BUTTON */}
        <button
          onClick={closeModal}
          className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-black/10 hover:bg-red-500 hover:text-white transition-all rounded-full backdrop-blur-md z-20"
        >
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>
    </div>
  );
};

export default ProductModal;