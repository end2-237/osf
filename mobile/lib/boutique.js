import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/* ══════════════════════════════════════════════════════════════════════════
   LA BOUTIQUE — panier, favoris, feuille de choix

   Le panier vit sur le téléphone et pas en base, exactement comme sur le
   site. Un client qui remplit son panier sans compte doit le retrouver ;
   demander une inscription avant d'avoir montré un prix fait fuir la moitié
   des visiteurs.

   La feuille de choix est pilotée ici plutôt que dans chaque écran : elle
   s'ouvre depuis une carte produit, une fiche, une suggestion de relais —
   partout. Un seul état, une seule feuille montée à la racine.
   ══════════════════════════════════════════════════════════════════════════ */

const CLE_PANIER = 'btl_panier';
const CLE_FAVORIS = 'btl_favoris';

const Ctx = createContext({});
export const useBoutique = () => useContext(Ctx);

export function BoutiqueProvider({ children }) {
  const [panier, setPanier] = useState([]);
  const [favoris, setFavoris] = useState([]);
  const [choix, setChoix] = useState(null);      // le produit dont on choisit les variantes
  const [pret, setPret] = useState(false);
  const premier = useRef(true);

  // Lecture au démarrage
  useEffect(() => {
    (async () => {
      try {
        const [p, f] = await AsyncStorage.multiGet([CLE_PANIER, CLE_FAVORIS]);
        setPanier(JSON.parse(p[1] || '[]'));
        setFavoris(JSON.parse(f[1] || '[]'));
      } catch { /* premier lancement */ }
      setPret(true);
    })();
  }, []);

  // Écriture à chaque changement, sauf le rendu initial : sans ce garde-fou
  // on écrase le panier lu avec un tableau vide au démarrage.
  useEffect(() => {
    if (!pret) return;
    if (premier.current) { premier.current = false; return; }
    AsyncStorage.setItem(CLE_PANIER, JSON.stringify(panier)).catch(() => {});
  }, [panier, pret]);

  useEffect(() => {
    if (!pret) return;
    AsyncStorage.setItem(CLE_FAVORIS, JSON.stringify(favoris)).catch(() => {});
  }, [favoris, pret]);

  /* ── Le panier ─────────────────────────────────────────────────────────
     Deux articles ne sont la même ligne que si le produit ET les variantes
     coïncident : une pointure 42 et une 45 sont deux lignes, pas deux
     exemplaires. */
  const cle = (a) => `${a.id}|${a.taille || ''}|${a.couleur || ''}`;

  const ajouter = useCallback((article, quantite = 1) => {
    setPanier((p) => {
      const i = p.findIndex((x) => cle(x) === cle(article));
      if (i > -1) {
        const c = [...p];
        c[i] = { ...c[i], quantite: (c[i].quantite || 1) + quantite };
        return c;
      }
      return [...p, { ...article, quantite, choisi: true }];
    });
  }, []);

  const changerQuantite = useCallback((k, delta) => {
    setPanier((p) => p.flatMap((x) => {
      if (cle(x) !== k) return [x];
      const q = (x.quantite || 1) + delta;
      return q <= 0 ? [] : [{ ...x, quantite: q }];
    }));
  }, []);

  const retirer = useCallback((k) => setPanier((p) => p.filter((x) => cle(x) !== k)), []);
  const viderPanier = useCallback(() => setPanier([]), []);

  const basculerChoisi = useCallback((k) => {
    setPanier((p) => p.map((x) => (cle(x) === k ? { ...x, choisi: !x.choisi } : x)));
  }, []);

  const toutChoisir = useCallback((valeur) => {
    setPanier((p) => p.map((x) => ({ ...x, choisi: valeur })));
  }, []);

  /* ── Les favoris ───────────────────────────────────────────────────────── */
  const estFavori = useCallback((id) => favoris.some((f) => f.id === id), [favoris]);

  const basculerFavori = useCallback((p) => {
    setFavoris((f) => f.some((x) => x.id === p.id)
      ? f.filter((x) => x.id !== p.id)
      : [...f, p]);
  }, []);

  /* ── Les totaux ────────────────────────────────────────────────────────── */
  const retenus = panier.filter((x) => x.choisi !== false);
  const sousTotal = retenus.reduce((s, x) => s + (Number(x.price) || 0) * (x.quantite || 1), 0);
  const economie = retenus.reduce(
    (s, x) => s + Math.max(0, (Number(x.prix_barre) || 0) - (Number(x.price) || 0)) * (x.quantite || 1), 0);
  const nbArticles = panier.reduce((s, x) => s + (x.quantite || 1), 0);

  return (
    <Ctx.Provider value={{
      pret,
      panier, retenus, sousTotal, economie, nbArticles, cle,
      ajouter, changerQuantite, retirer, viderPanier, basculerChoisi, toutChoisir,
      favoris, estFavori, basculerFavori,
      choix, ouvrirChoix: setChoix, fermerChoix: () => setChoix(null),
    }}>
      {children}
    </Ctx.Provider>
  );
}

/* ── Les données ─────────────────────────────────────────────────────────
   Une seule porte vers `products`, avec les colonnes que la carte attend.
   Les champs d'urgence — stock, note, prix barré — n'existent pas tous en
   base : on les dérive plutôt que de les inventer, et la carte supporte leur
   absence. */

const CHAMPS = 'id, name, price, img, images, vendor_id, type, status, description, created_at';

const enrichir = (p) => ({
  ...p,
  nb_photos: Array.isArray(p.images) ? p.images.length : 1,
  // Le prix barré n'est affiché que s'il existe vraiment. Inventer une remise
  // est le mensonge le plus courant du commerce en ligne, et il se voit.
  prix_barre: p.prix_barre ?? null,
  note: p.note ?? null,
  nb_avis: p.nb_avis ?? 0,
});

export async function produits({ type, vendorId, recherche, limite = 20, depuis = 0 } = {}) {
  let q = supabase.from('products').select(CHAMPS);
  if (type) q = q.eq('type', type);
  if (vendorId) q = q.eq('vendor_id', vendorId);
  if (recherche) q = q.ilike('name', `%${recherche}%`);
  const { data, error } = await q
    .order('created_at', { ascending: false })
    .range(depuis, depuis + limite - 1);
  if (error) return { data: [], error };
  return { data: (data || []).map(enrichir), error: null };
}

export async function produit(id) {
  const { data, error } = await supabase
    .from('products')
    .select(`${CHAMPS}, vendor:vendors!vendor_id(id, shop_name, logo_url, city)`)
    .eq('id', id).maybeSingle();
  return { data: data ? enrichir(data) : null, error };
}

export async function categories() {
  const { data } = await supabase.from('products').select('type').not('type', 'is', null);
  const compte = new Map();
  for (const r of data || []) compte.set(r.type, (compte.get(r.type) || 0) + 1);
  return [...compte.entries()]
    .map(([nom, n]) => ({ nom, n }))
    .sort((a, b) => b.n - a.n);
}
