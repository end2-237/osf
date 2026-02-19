import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ofsLogo from '../assets/ofs.png'; 

const Icons = {
  Key: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
  Check: () => <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
};

const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Connexion initiale
      const { user } = await signIn(email.trim(), password);

      // Redirection conditionnelle basée sur les métadonnées ou le rôle
      // On vérifie si l'utilisateur a un 'vendor_id' ou le rôle 'vendor' dans ses métadonnées
      if (user?.user_metadata?.role === 'vendor' || user?.user_metadata?.vendor_id) {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-white flex overflow-hidden font-sans select-none">
      
      {/* --- PANEL GAUCHE : IDENTITÉ VISUELLE --- */}
      <div className="hidden lg:flex lg:w-[40%] relative flex-col justify-between p-10 overflow-hidden bg-[#0a0a0a] border-r border-zinc-800">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80" 
            className="w-full h-full object-cover opacity-20 grayscale transition-transform duration-[20s] hover:scale-110"
            alt="OFS Brand"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
        </div>
        
        <Link to="/" className="relative z-10 flex items-center gap-2 animate-in fade-in duration-700">
          <img src={ofsLogo} alt="Logo" className="w-6 h-6 object-contain brightness-100 invert" />
          <span className="text-white text-xs font-black tracking-[0.3em] uppercase italic">OFS Elite</span>
        </Link>

        <div className="relative z-10 space-y-3">
          <h2 className="text-3xl font-bold text-white tracking-tighter leading-tight animate-in slide-in-from-left duration-500">
            Welcome Back <br />
            <span className="text-primary italic">Elite Member.</span>
          </h2>
          <div className="space-y-1.5">
            {['Accès Dashboard Vendeur', 'Gestion de Stock Temps Réel', 'Analytiques Avancées'].map((text, i) => (
              <div key={i} className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                <Icons.Check /> {text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <div className="h-[1px] w-6 bg-primary mb-2"></div>
          <p className="text-zinc-600 text-[8px] font-bold tracking-[0.4em] uppercase">© 2026 OFS System</p>
        </div>
      </div>

      {/* --- PANEL DROIT : FORMULAIRE --- */}
      <div className="w-full lg:w-[60%] h-full flex flex-col justify-center items-center bg-white p-4 relative overflow-hidden">
        
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
           <img src={ofsLogo} alt="" className="w-96 h-96 object-contain" />
        </div>

        <div className="w-full max-w-[320px] z-10 animate-in fade-in zoom-in-95 duration-500">
          
          <header className="mb-8 text-center lg:text-left">
            <h1 className="text-xl font-black italic uppercase tracking-tighter text-zinc-900 leading-none">
              Sign In
            </h1>
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.3em] mt-1">Authorized Personnel Only</p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest ml-1">Security Mail</label>
              <input
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-50/50 border border-zinc-100 focus:border-zinc-900 p-3 rounded-lg text-xs font-bold outline-none transition-all placeholder:text-zinc-300"
                placeholder="PRO@OFS.COM"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest ml-1">Access Key</label>
              <input
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-50/50 border border-zinc-100 focus:border-zinc-900 p-3 rounded-lg text-xs font-bold outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-[8px] font-bold text-red-500 bg-red-50 p-2.5 rounded border border-red-100 text-center uppercase tracking-widest">
                {error}
              </p>
            )}

            <button
              disabled={loading}
              className="w-full py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.3em] transition-all relative overflow-hidden group shadow-lg active:scale-[0.97] mt-4 bg-zinc-900 text-white"
            >
               <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
               {loading ? "AUTHENTICATING..." : "START SESSION"}
            </button>
          </form>

          <footer className="mt-8 text-center text-[9px] font-bold text-zinc-400 tracking-tight">
            NOT REGISTERED YET ?{' '}
            <Link to="/register" className="text-zinc-900 border-b border-primary pb-0.5 ml-1 transition-all hover:text-primary">CREATE ACCESS</Link>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Login;