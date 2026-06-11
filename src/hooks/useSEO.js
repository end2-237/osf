import { useEffect } from 'react';

const DEFAULT_TITLE = 'OFS Cameroun — Boutique en ligne';
const DEFAULT_DESC  = 'Shopping en ligne au Cameroun : mode, tech, beauté, maison. Livraison express Douala, Yaoundé et toutes les régions.';
const DEFAULT_IMAGE = 'https://alrbokstfwwlvbvghrqr.supabase.co/storage/v1/object/public/product-images/ofs-og.jpg';
const SITE_URL      = 'https://ofs-cm.com';
const SITE_NAME     = 'OFS Cameroun';

const setMeta = (selector, content) => {
  let el = document.querySelector(selector);
  if (!el) {
    const m = selector.match(/meta\[([^=]+)="([^"]+)"\]/);
    if (!m) return;
    el = document.createElement('meta');
    el.setAttribute(m[1], m[2]);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const setCanonical = (href) => {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

export const useSEO = ({ title, description, image, url, type = 'website' } = {}) => {
  useEffect(() => {
    const t = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
    const d = (description || DEFAULT_DESC).slice(0, 160);
    const i = image || DEFAULT_IMAGE;
    const u = url || window.location.href;

    document.title = t;
    setMeta('meta[name="description"]', d);
    setMeta('meta[property="og:title"]', t);
    setMeta('meta[property="og:description"]', d);
    setMeta('meta[property="og:image"]', i);
    setMeta('meta[property="og:url"]', u);
    setMeta('meta[property="og:type"]', type);
    setMeta('meta[property="og:site_name"]', SITE_NAME);
    setMeta('meta[name="twitter:card"]', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', t);
    setMeta('meta[name="twitter:description"]', d);
    setMeta('meta[name="twitter:image"]', i);
    setCanonical(u);

    return () => {
      document.title = DEFAULT_TITLE;
      setMeta('meta[name="description"]', DEFAULT_DESC);
      setMeta('meta[property="og:title"]', DEFAULT_TITLE);
      setMeta('meta[property="og:description"]', DEFAULT_DESC);
      setMeta('meta[property="og:image"]', DEFAULT_IMAGE);
      setMeta('meta[property="og:url"]', SITE_URL);
      setMeta('meta[property="og:type"]', 'website');
      setCanonical(SITE_URL);
    };
  }, [title, description, image, url, type]);
};
