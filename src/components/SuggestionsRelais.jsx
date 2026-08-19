import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { mettreAuPanier } from '../lib/relais';

/* ══════════════════════════════════════════════════════════════════════════
   PENDANT QUE TU Y ES

   L'écran du relais ne montrait qu'un article : celui qu'on l'envoie
   chercher. C'est un client qui a déjà décidé de marcher, qui va entrer dans
   une boutique, et à qui on ne propose rien d'autre — alors que le panier,
   lui, propose depuis toujours.

   L'ordre des suggestions suit le trajet, pas le catalogue :

     1. CE QUE VEND LA BOUTIQUE OÙ IL VA. C'est la seule liste qui a une
        chance de se transformer en vente aujourd'hui : il sera physiquement
        devant l'étagère dans onze mètres. Rien d'autre ne vaut cette place.

     2. LA MÊME FAMILLE D'ARTICLES, ailleurs. Il cherchait quelque chose de
        précis ; ce qui lui ressemble l'intéresse encore.

     3. LE RESTE, pour ne pas laisser un espace vide sous les yeux de
        quelqu'un qui attend.

   Ajouter au panier ici n'annule rien : son relais continue de vivre au-
   dessus, avec son code et son chemin. Les deux ne se gênent pas — l'un se
   retire au comptoir, l'autre se fait livrer.
   ══════════════════════════════════════════════════════════════════════════ */

const CHAMPS = 'id, name, price, img, vendor_id, type, status';

export default function SuggestionsRelais({ relais }) {
  const [chezElle, setChezElle] = useState([]);
  const [ailleurs, setAilleurs] = useState([]);
  const [ajoute, setAjoute]     = useState(null);

  useEffect(() => {
    let vivant = true;
    if (!relais) return;

    const charger = async () => {
      // La famille de l'article relayé, quand il en a une. Un appel ouvert n'a
      // pas de fiche produit : on se rabat sur le reste sans bruit.
      let famille = null;
      if (relais.product_id) {
        const { data } = await supabase
          .from('products').select('type').eq('id', relais.product_id).maybeSingle();
        famille = data?.type || null;
      }

      const exclure = (q) =>
        relais.product_id ? q.neq('id', relais.product_id) : q;

      const [boutique, meme, recents] = await Promise.all([
        relais.boutique_id
          ? exclure(supabase.from('products').select(CHAMPS)
              .eq('vendor_id', relais.boutique_id))
              .order('created_at', { ascending: false }).limit(12)
              .then((r) => r.data || [])
          : Promise.resolve([]),
        famille
          ? exclure(supabase.from('products').select(CHAMPS).eq('type', famille))
              .order('created_at', { ascending: false }).limit(12)
              .then((r) => r.data || [])
          : Promise.resolve([]),
        exclure(supabase.from('products').select(CHAMPS))
          .order('created_at', { ascending: false }).limit(12)
          .then((r) => r.data || []),
      ]);

      if (!vivant) return;

      setChezElle(boutique.slice(0, 6));

      // Pas deux fois le même article dans les deux rangées.
      const vus = new Set(boutique.slice(0, 6).map((p) => p.id));
      const reste = [];
      for (const p of [...meme, ...recents]) {
        if (vus.has(p.id)) continue;
        vus.add(p.id);
        reste.push(p);
        if (reste.length >= 10) break;
      }
      setAilleurs(reste);
    };

    charger();
    return () => { vivant = false; };
  }, [relais?.product_id, relais?.boutique_id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const ajouter = (p) => {
    mettreAuPanier({
      id: p.id, name: p.name, price: p.price, img: p.img,
      vendor_id: p.vendor_id, type: p.type,
      selectedSize: null, selectedColor: null,
    });
    setAjoute(p.id);
    setTimeout(() => setAjoute((x) => (x === p.id ? null : x)), 1800);
  };

  const Carte = ({ p }) => (
    <div className="flex flex-col group">
      <Link to={`/product/${p.id}`}
        className="aspect-square w-full bg-[#F7F7F7] rounded-lg flex items-center justify-center overflow-hidden mb-2">
        <img src={p.img || 'https://via.placeholder.com/300'} alt={p.name} loading="lazy"
          className="max-w-full max-h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300" />
      </Link>
      <Link to={`/product/${p.id}`}
        className="text-[13px] text-[#0F1111] hover:text-[#C7511F] leading-snug line-clamp-2 min-h-[34px] transition-colors">
        {p.name}
      </Link>
      <p className="text-[16px] font-bold text-[#B12704] mt-1">
        {Number(p.price || 0).toLocaleString()}
        <span className="text-[10px] align-top ml-0.5">FCFA</span>
      </p>
      <button onClick={() => ajouter(p)}
        className={`mt-2 w-full rounded-full text-[12px] font-medium py-1.5 border transition shadow-[0_2px_5px_rgba(213,217,217,.5)] ${
          ajoute === p.id
            ? 'bg-[#E8F5E8] border-[#007600]/30 text-[#007600]'
            : 'bg-[#FFD814] hover:bg-[#F7CA00] border-[#FCD200] text-[#0F1111]'}`}>
        {ajoute === p.id
          ? <><i className="fa-solid fa-circle-check mr-1.5 text-[11px]" />Ajouté !</>
          : 'Ajouter au panier'}
      </button>
    </div>
  );

  if (!chezElle.length && !ailleurs.length) return null;

  return (
    <>
      {chezElle.length > 0 && (
        <div className="bg-white rounded-lg p-4 sm:p-6">
          <h2 className="text-[17px] sm:text-[20px] font-bold text-[#0F1111]">
            Pendant que tu y es, chez {relais.boutique}
          </h2>
          <p className="text-[13px] text-[#565959] mt-1 mb-4 leading-relaxed">
            Tu y seras dans quelques minutes. Ajoute-les à ton panier et
            demande-les au comptoir en récupérant ton article.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
            {chezElle.map((p) => <Carte key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {ailleurs.length > 0 && (
        <div className="bg-white rounded-lg p-4 sm:p-6">
          <h2 className="text-[17px] sm:text-[20px] font-bold text-[#0F1111] mb-4">
            Ça pourrait aussi te plaire
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            {ailleurs.map((p) => <Carte key={p.id} p={p} />)}
          </div>
        </div>
      )}
    </>
  );
}
