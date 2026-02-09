import React from 'react';
import Hero from '../components/Hero';
import AudioAds from '../components/AudioAds';
import Categories from '../components/Categories';
import FlashDrop from '../components/FlashDrop';
import Marquee from '../components/Marquee';
import TechProducts from '../components/TechProducts';
import Trends from '../components/Trends';
import Shop from '../components/Shop';

const Home = ({ openModal, addToCart }) => {
  return (
    <>
      <Hero />
      <AudioAds openModal={openModal} />
      <Categories />
      <FlashDrop />
      <Marquee />
      <TechProducts openModal={openModal} />
      <Trends />
      <Shop openModal={openModal} addToCart={addToCart} />
    </>
  );
};

export default Home;