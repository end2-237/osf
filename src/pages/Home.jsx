import React, { useEffect, useState } from "react";
import Hero from "../components/Hero";
import AudioAds from "../components/AudioAds";
import Categories from "../components/Categories";
import FlashDrop from "../components/FlashDrop";
import Marquee from "../components/Marquee";
import TechProducts from "../components/TechProducts";
import Trends from "../components/Trends";
import Shop from "../components/Shop";
import { supabase } from "../lib/supabase";

const Home = ({ openModal, addToCart }) => {
  const [productsList, setProductsList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getItems() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order('created_at', { ascending: false }); 

        if (error) throw error;
        setProductsList(data || []);
      } catch (error) {
        console.error("Erreur:", error.message);
      } finally {
        setLoading(false);
      }
    }
    getItems();
  }, []);

  return (
    <>
      <Hero />
      
      {/* 1. On garde le Marquee pour le mouvement immédiat sous le Hero */}
      <Marquee />

      {/* 2. Les catégories permettent de filtrer rapidement */}
      <Categories />

      {/* 3. LE SHOP : On remonte le Shop ici pour qu'il soit visible très tôt */}
      <Shop 
        openModal={openModal} 
        addToCart={addToCart} 
        products={productsList} 
        loading={loading} 
      />

      {/* 4. Les sections spécifiques et pubs viennent ensuite pour enrichir l'expérience */}
      <AudioAds openModal={openModal} /> 
      <FlashDrop />
      <TechProducts openModal={openModal} />
      <Trends />
    </>
  );
};

export default Home;