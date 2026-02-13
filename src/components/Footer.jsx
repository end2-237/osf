import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [time, setTime] = useState(new Date());
  const [onlineCount] = useState(Math.floor(Math.random() * 40) + 18);
  const footerRef = useRef(null);

  // Intersection observer pour animation d'entrée
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    if (footerRef.current) observer.observe(footerRef.current);
    return () => observer.disconnect();
  }, []);

  // Horloge live
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
    }
  };

  const formatTime = (d) => {
    return d.toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: 'Africa/Douala'
    });
  };

  const navColumns = [
    {
      title: 'Collections',
      links: [
        { label: 'Audio Lab', path: '/store', tag: 'HOT' },
        { label: 'Streetwear', path: '/store' },
        { label: 'Tech Lab', path: '/store' },
        { label: 'Sneakers', path: '/store' },
        { label: 'Parfums Elite', path: '/store', tag: 'NEW' },
      ]
    },
    {
      title: 'Espace',
      links: [
        { label: 'Studio Lab', path: '/studio', accent: true },
        { label: 'Marketplace', path: '/store' },
        { label: 'Devenir Vendeur', path: '/register' },
        { label: 'Mon Dashboard', path: '/admin' },
      ]
    },
    {
      title: 'Support',
      links: [
        { label: 'Livraison Douala', path: '/' },
        { label: 'Retours & Échanges', path: '/' },
        { label: 'Guide des Tailles', path: '/' },
        { label: 'FAQ Elite', path: '/' },
      ]
    },
  ];

  const socials = [
    { icon: 'fa-instagram', label: 'Instagram', color: 'hover:text-pink-400', href: '#' },
    { icon: 'fa-tiktok', label: 'TikTok', color: 'hover:text-white', href: '#' },
    { icon: 'fa-whatsapp', label: 'WhatsApp', color: 'hover:text-green-400', href: '#' },
    { icon: 'fa-twitter', label: 'Twitter', color: 'hover:text-sky-400', href: '#' },
  ];

  return (
    <footer
      ref={footerRef}
      className="bg-zinc-950 text-white relative overflow-hidden"
    >
      {/* ── FOND DÉCORATIF ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary/3 rounded-full blur-[120px]" />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] bg-primary/4 rounded-full blur-[100px]" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'linear-gradient(rgba(0,255,136,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* ── BANDE STATUTS LIVE ── */}
      <div className="border-b border-white/5 relative z-10">
        <div className="max-w-[1600px] mx-auto px-6 md:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-6 text-[9px] font-black uppercase tracking-[0.2em]">
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
              <span className="text-zinc-400">{onlineCount} visiteurs actifs</span>
            </div>
            <div className="hidden md:flex items-center space-x-2">
              <i className="fa-solid fa-truck text-primary text-[10px]"></i>
              <span className="text-zinc-400">Livraison opérationnelle</span>
            </div>
            <div className="hidden lg:flex items-center space-x-2">
              <i className="fa-solid fa-shield-check text-primary text-[10px]"></i>
              <span className="text-zinc-400">Paiement sécurisé</span>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-[9px] font-mono text-zinc-500">
            <i className="fa-solid fa-clock text-primary text-[10px]"></i>
            <span>Douala — {formatTime(time)}</span>
          </div>
        </div>
      </div>

      {/* ── NEWSLETTER ── */}
      <div
        className={`border-b border-white/5 relative z-10 transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="max-w-[1600px] mx-auto px-6 md:px-8 py-12 md:py-16">
          <div className="grid md:grid-cols-2 items-center gap-8">
            <div>
              <span className="text-primary font-black uppercase text-[10px] tracking-[0.4em] mb-3 block">
                Drop Alert
              </span>
              <h3 className="text-3xl md:text-4xl font-black italic tracking-tighter leading-tight">
                Soyez le premier <br />
                <span className="text-primary">informé.</span>
              </h3>
              <p className="text-zinc-500 text-sm mt-3 font-bold">
                Nouveaux drops, promotions exclusives, accès anticipé.
              </p>
            </div>
            <div>
              {subscribed ? (
                <div className="flex items-center space-x-4 p-6 bg-primary/10 border border-primary/30 rounded-2xl">
                  <div className="bg-primary rounded-full w-10 h-10 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-check text-black"></i>
                  </div>
                  <div>
                    <p className="font-black uppercase text-[11px] tracking-widest text-primary">Bienvenue dans l'Elite</p>
                    <p className="text-zinc-400 text-[10px] mt-0.5">Vous recevrez les prochains drops en avant-première.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold placeholder-zinc-600 focus:border-primary focus:bg-white/8 outline-none transition-all duration-300 dark:text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-primary text-black px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all duration-200 whitespace-nowrap shadow-[0_0_20px_rgba(0,255,136,0.3)]"
                  >
                    <span className="hidden sm:inline">S'abonner</span>
                    <i className="fa-solid fa-arrow-right sm:hidden"></i>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENU PRINCIPAL ── */}
      <div
        className={`relative z-10 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <div className="max-w-[1600px] mx-auto px-6 md:px-8 py-16">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">

            {/* BRAND COLUMN */}
            <div className="col-span-2">
              <Link to="/" className="logo-font font-bold text-2xl uppercase tracking-tighter group flex items-center mb-4">
                OneFree<span className="text-primary italic group-hover:text-white transition-colors">Style</span>
              </Link>
              <p className="text-zinc-500 text-sm leading-relaxed mb-6 max-w-xs">
                Le concept store Elite de Douala. Streetwear, Audio Lab, Tech & Culture — tout ce qui fait battre la ville.
              </p>

              {/* Socials */}
              <div className="flex items-center space-x-2 mb-8">
                {socials.map(({ icon, label, color, href }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-zinc-400 ${color} hover:border-white/20 hover:bg-white/10 transition-all duration-300 group`}
                  >
                    <i className={`fa-brands ${icon} text-sm group-hover:scale-110 transition-transform`}></i>
                  </a>
                ))}
              </div>

              {/* Localisation */}
              <div className="flex items-start space-x-3 p-4 bg-white/3 border border-white/5 rounded-2xl">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <i className="fa-solid fa-location-dot text-primary text-xs"></i>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Bonamoussadi</p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">Douala, Cameroun 🇨🇲</p>
                </div>
              </div>
            </div>

            {/* NAV COLUMNS */}
            {navColumns.map((col, ci) => (
              <div
                key={col.title}
                className={`transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${300 + ci * 80}ms` }}
              >
                <h5 className="font-black uppercase text-[9px] tracking-[0.35em] mb-5 text-primary border-b border-primary/20 pb-3 flex items-center space-x-2">
                  <span className="w-1 h-3 bg-primary rounded-full inline-block"></span>
                  <span>{col.title}</span>
                </h5>
                <ul className="space-y-2.5">
                  {col.links.map(({ label, path, tag, accent }) => (
                    <li key={label}>
                      <Link
                        to={path}
                        className={`text-[11px] font-bold flex items-center space-x-2 group transition-all duration-200
                          ${accent ? 'text-primary hover:text-white' : 'text-zinc-400 hover:text-white'}`}
                      >
                        <span className="w-0 group-hover:w-2 h-[1px] bg-primary transition-all duration-300 inline-block shrink-0 rounded-full" />
                        <span className="group-hover:translate-x-1 transition-transform duration-200">{label}</span>
                        {tag && (
                          <span className="bg-primary text-black text-[7px] font-black px-1.5 py-0.5 rounded-full">
                            {tag}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── BARRE BAS ── */}
      <div
        className={`border-t border-white/5 relative z-10 transition-all duration-700 delay-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="max-w-[1600px] mx-auto px-6 md:px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-[9px] font-bold uppercase tracking-widest text-zinc-600">
            <span>© {new Date().getFullYear()} OneFreestyle Elite</span>
            <span className="w-1 h-1 bg-zinc-700 rounded-full hidden md:block"></span>
            <a href="#" className="hover:text-primary transition-colors">Confidentialité</a>
            <span className="w-1 h-1 bg-zinc-700 rounded-full hidden md:block"></span>
            <a href="#" className="hover:text-primary transition-colors">Conditions</a>
            <span className="w-1 h-1 bg-zinc-700 rounded-full hidden md:block"></span>
            <a href="#" className="hover:text-primary transition-colors">Cookies</a>
          </div>

          <div className="flex items-center space-x-3">
            {/* Paiements acceptés */}
            <div className="flex items-center space-x-2">
              {['fa-mobile-screen-button', 'fa-money-bill-wave', 'fa-truck-fast'].map((icon, i) => (
                <div
                  key={i}
                  className="w-8 h-6 bg-white/5 border border-white/8 rounded flex items-center justify-center hover:border-primary/40 transition-colors"
                >
                  <i className={`fa-solid ${icon} text-[9px] text-zinc-500`}></i>
                </div>
              ))}
            </div>
            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest hidden md:block">
              Paiements acceptés
            </span>
          </div>
        </div>
      </div>

      {/* ── WATERMARK ── */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 pointer-events-none select-none overflow-hidden w-full flex justify-center">
        <span className="text-[120px] md:text-[180px] font-black italic uppercase text-white/[0.02] leading-none whitespace-nowrap">
          ELITE
        </span>
      </div>
    </footer>
  );
};

export default Footer;