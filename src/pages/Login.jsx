import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ofsLogo from '../assets/ofs.png';
import { supabase } from '../lib/supabase';

const Login = () => {
  const navigate          = useNavigate();
  const location          = useLocation();
  const { signIn }        = useAuth();
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const from = location.state?.from || null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      const user = authData.user;

      if (from) { navigate(from, { replace: true }); return; }

      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id')
        .or(`id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle();

      if (vendorData || user?.user_metadata?.role === 'vendor') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      console.error('Login Error:', err);
      setError('Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!email.trim()) { setError('Entrez votre email pour réinitialiser.'); return; }
    setLoading(true); setError('');
    try {
      await supabase.auth.resetPasswordForEmail(email.trim());
      setForgotSent(true);
    } catch {
      setError('Erreur lors de l\'envoi. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#EAEDED] flex overflow-hidden font-sans select-none">

      {/* PANEL GAUCHE — Amazon navy */}
      <div className="hidden lg:flex lg:w-[38%] relative flex-col justify-between p-10 overflow-hidden bg-[#131921]">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80"
            className="w-full h-full object-cover opacity-10 grayscale"
            alt="OFS Brand"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#131921] via-[#131921]/60 to-transparent" />
        </div>

        <Link to="/" className="relative z-10 flex items-center gap-2">
          <img src={ofsLogo} alt="Logo" className="w-6 h-6 object-contain invert" />
          <span className="text-white text-sm font-bold tracking-wide">
            One<span className="text-[#FF9900]">Freestyle</span>
          </span>
        </Link>

        <div className="relative z-10 space-y-5">
          <h2 className="text-3xl font-bold text-white leading-tight">
            Bon retour<br /><span className="text-[#FF9900]">parmi nous.</span>
          </h2>
          {from === '/profile' && (
            <div className="flex items-center gap-2 bg-[#FF9900]/10 border border-[#FF9900]/20 rounded px-4 py-2.5">
              <i className="fa-solid fa-user text-[#FF9900] text-xs"></i>
              <span className="text-xs font-bold text-[#FF9900]">Connexion requise pour accéder à votre profil</span>
            </div>
          )}
          <div className="space-y-2">
            {['Accès Dashboard Vendeur', 'Gestion de Stock Temps Réel', 'Analytiques Avancées'].map((text, i) => (
              <div key={i} className="flex items-center gap-2 text-[#ADBAC7] text-sm">
                <i className="fa-solid fa-check text-[#FF9900] text-xs"></i> {text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <div className="h-px w-8 bg-[#FF9900] mb-2" />
          <p className="text-[#37475A] text-xs tracking-widest uppercase">© 2026 OFS System</p>
        </div>
      </div>

      {/* PANEL DROIT */}
      <div className="w-full lg:w-[62%] flex flex-col justify-center items-center bg-white p-6 relative overflow-y-auto">

        <div className="w-full max-w-[380px]">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 mb-6">
            <img src={ofsLogo} alt="Logo" className="w-6 h-6 object-contain" />
            <span className="text-[#0F1111] text-sm font-bold">
              One<span className="text-[#FF9900]">Freestyle</span>
            </span>
          </div>

          <header className="mb-6">
            <h1 className="text-2xl font-bold text-[#0F1111] leading-none mb-1">Se connecter</h1>
            <p className="text-sm text-[#565959]">
              {from === '/profile' ? 'Connexion requise · Profil' : 'Accédez à votre espace OneFreestyle'}
            </p>
          </header>

          {forgotSent ? (
            <div className="bg-green-50 border border-green-200 rounded p-4 text-center">
              <i className="fa-solid fa-envelope-open-text text-[#007600] text-2xl mb-2 block"></i>
              <p className="font-bold text-[#007600] text-sm mb-1">Email envoyé !</p>
              <p className="text-xs text-[#565959]">Vérifiez votre boîte mail pour réinitialiser votre mot de passe.</p>
              <button onClick={() => setForgotSent(false)} className="mt-3 text-xs text-[#007185] hover:underline">
                Retour à la connexion
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* EMAIL */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#565959] mb-1.5">
                  Adresse email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded px-3 py-2.5 text-sm text-[#0F1111] placeholder-[#adb5bd] transition-colors"
                  placeholder="votre@email.com"
                  autoComplete="email"
                />
              </div>

              {/* MOT DE PASSE */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#565959]">
                    Mot de passe
                  </label>
                  <button
                    type="button"
                    onClick={handleForgot}
                    className="text-xs text-[#007185] hover:text-[#C45500] hover:underline transition-colors"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-[#D5D9D9] focus:border-[#FF9900] focus:outline-none rounded px-3 py-2.5 pr-10 text-sm text-[#0F1111] transition-colors"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#adb5bd] hover:text-[#565959] transition-colors"
                  >
                    <i className={`fa-solid ${showPass ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                  </button>
                </div>
              </div>

              {/* ERREUR */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 flex items-center gap-2">
                  <i className="fa-solid fa-circle-exclamation text-red-400 text-sm flex-shrink-0"></i>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* CTA */}
              <button
                disabled={loading}
                className="w-full py-3.5 rounded font-bold text-sm transition-all bg-[#FFD814] hover:bg-[#F7CA00] text-[#0F1111] border border-[#FCD200] shadow-sm active:scale-[0.98] disabled:opacity-50 mt-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <i className="fa-solid fa-spinner fa-spin text-xs"></i> Connexion...
                  </span>
                ) : 'Se connecter'}
              </button>

              {/* Séparateur */}
              <div className="relative flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-[#D5D9D9]" />
                <span className="text-xs text-[#adb5bd]">ou</span>
                <div className="flex-1 h-px bg-[#D5D9D9]" />
              </div>

              {/* Devenir vendeur */}
              <Link to="/register"
                className="w-full flex items-center justify-center gap-2 py-3 border border-[#D5D9D9] hover:border-[#FF9900] rounded font-bold text-sm text-[#565959] hover:text-[#FF9900] transition-all"
              >
                <i className="fa-solid fa-store text-xs"></i>
                Devenir vendeur
              </Link>
            </form>
          )}

          <div className="mt-5 pt-5 border-t border-[#D5D9D9] text-center">
            <span className="text-sm text-[#565959]">Nouveau sur OneFreestyle ? </span>
            <Link to="/register" className="text-sm text-[#007185] hover:text-[#C45500] hover:underline font-bold">
              Créer un compte
            </Link>
          </div>

          <p className="mt-4 text-center text-xs text-[#adb5bd] leading-relaxed">
            En vous connectant, vous acceptez nos{' '}
            <span className="text-[#007185] underline cursor-pointer">conditions</span> et notre{' '}
            <span className="text-[#007185] underline cursor-pointer">politique de confidentialité</span>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
