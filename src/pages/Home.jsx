import React from "react";
import Hero from "../components/Hero";
import AudioAds from "../components/AudioAds";
import Categories from "../components/Categories";
import FlashDrop from "../components/FlashDrop";
import Marquee from "../components/Marquee";
import TechProducts from "../components/TechProducts";
import Trends from "../components/Trends";
import Shop from "../components/Shop";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const Home = ({ openModal, addToCart }) => {
  const [productsList, setProductsList] = useState([]);

  // src/pages/Home.jsx
useEffect(() => {
  async function getItems() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      // Retirez .single() pour obtenir un tableau
      .order('created_at', { ascending: false }); 

    if (error) {
      console.error("Erreur de récupération:", error.message);
      return;
    }

    setProductsList(data); // "data" est maintenant un tableau
  }
  getItems();
}, []);
  return (
    <>
      <Hero />
      <AudioAds openModal={openModal} />
      <Categories />
      <FlashDrop />
      <Marquee />
      <TechProducts openModal={openModal} />
      <Trends />
      <Shop openModal={openModal} addToCart={addToCart} products={productsList}/>
    </>
  );
};

export default Home;
