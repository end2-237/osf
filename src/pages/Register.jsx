import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ofsLogo from '../assets/ofs.png'; 

const Icons = {
  User: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Business: () => <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745V20a2 2 0 002 2h14a2 2 0 002-2v-6.745zM16 8V5a2 2 0 00-2-2H10a2 2 0 00-2 2v3H4a2 2 0 00-2 2v3a2 2 0 002 2h16a2 2 0 002-2v-3a2 2 0 00-2-2h-4zM10 8h4V5h-4v3z" /></svg>,
  Check: () => <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
};

export default function Register() {
  const { signUpMember, signUpVendor } = useAuth();
  const navigate = useNavigate();
  const [flow, setFlow] = useState('member'); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    email: '', password: '', confirm: '', 
    displayName: '', full_name: '', shop_name: '', phone: ''
  });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirm) return setError('Mots de passe non identiques.');
    setLoading(true);
    try {
      if (flow === 'member') {
        await signUpMember(formData.email, formData.password, formData.displayName);
        setSuccess('Profil créé. Vérifiez votre boîte mail.');
      } else {
        await signUpVendor(formData.email, formData.password, { 
          full_name: formData.full_name,
          shop_name: formData.shop_name, 
          phone: formData.phone 
        });
        setSuccess('Demande Business enregistrée.');
      }
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

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
            {flow === 'member' ? "The Access" : "The Empire"} <br />
            <span className="text-primary italic italic">Redefined.</span>
          </h2>
          <div className="space-y-1.5">
            {['Standard de Qualité Global', 'Réseau de Logistique Intégrée', 'Sécurité Transactionnelle SSL'].map((text, i) => (
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

      {/* --- PANEL DROIT : LE FORMULAIRE AVEC FILIGRANE --- */}
      <div className="w-full lg:w-[60%] h-full flex flex-col justify-center items-center bg-white p-4 relative overflow-hidden">
        
        {/* FILIGRANE / WATERMARK IMAGE */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] transition-transform duration-1000">
           <img src={ofsLogo} alt="" className="w-96 h-96 object-contain" />
        </div>

        <div className="w-full max-w-[320px] z-10 animate-in fade-in zoom-in-95 duration-500">
          
          <header className="mb-6 text-center lg:text-left">
            <h1 className="text-xl font-black italic uppercase tracking-tighter text-zinc-900 leading-none">
              {flow === 'member' ? "Create Profile" : "Business Access"}
            </h1>
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.3em] mt-1">Marketplace Tier-1 Protocol</p>
          </header>

          {/* Selector Switch ultra-fin */}
          <div className="flex bg-zinc-50 p-1 rounded-xl mb-6 border border-zinc-100">
            <button
              onClick={() => setFlow('member')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all duration-300 ${
                flow === 'member' ? "bg-white text-zinc-900 shadow-sm border border-zinc-100" : "text-zinc-400 hover:text-zinc-500"
              }`}
            >
              <Icons.User /> Personal
            </button>
            <button
              onClick={() => setFlow('vendor')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all duration-300 ${
                flow === 'vendor' ? "bg-white text-zinc-900 shadow-sm border border-zinc-100" : "text-zinc-400 hover:text-zinc-500"
              }`}
            >
              <Icons.Business /> Business
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 max-h-[65vh] overflow-y-auto pr-1 custom-scrollbar scroll-smooth">
            {flow === 'member' ? (
              <div className="space-y-1 animate-in slide-in-from-top-1">
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest ml-1">Identity</label>
                <input
                  type="text" name="displayName" required
                  onChange={handleChange}
                  className="w-full bg-zinc-50/50 border border-zinc-100 focus:border-zinc-900 p-2.5 rounded-lg text-xs font-bold outline-none transition-all placeholder:text-zinc-300"
                  placeholder="NOM COMPLET"
                />
              </div>
            ) : (
              <div className="space-y-3 animate-in slide-in-from-top-1">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest ml-1">Manager</label>
                    <input
                      type="text" name="full_name" required
                      onChange={handleChange}
                      className="w-full bg-zinc-50/50 border border-zinc-100 focus:border-zinc-900 p-2.5 rounded-lg text-xs font-bold outline-none"
                      placeholder="GÉRANT"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest ml-1">Contact</label>
                    <input
                      type="tel" name="phone" required
                      onChange={handleChange}
                      className="w-full bg-zinc-50/50 border border-zinc-100 focus:border-zinc-900 p-2.5 rounded-lg text-xs font-bold outline-none"
                      placeholder="+237"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest ml-1">Brand Name</label>
                  <input
                    type="text" name="shop_name" required
                    onChange={handleChange}
                    className="w-full bg-zinc-50/50 border border-zinc-100 focus:border-zinc-900 p-2.5 rounded-lg text-xs font-bold outline-none"
                    placeholder="NOM DE LA BOUTIQUE"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest ml-1">Security Mail</label>
              <input
                type="email" name="email" required
                onChange={handleChange}
                className="w-full bg-zinc-50/50 border border-zinc-100 focus:border-zinc-900 p-2.5 rounded-lg text-xs font-bold outline-none transition-all placeholder:text-zinc-300"
                placeholder="PRO@OFS.COM"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest ml-1">Key</label>
                <input
                  type="password" name="password" required
                  onChange={handleChange}
                  className="w-full bg-zinc-50/50 border border-zinc-100 focus:border-zinc-900 p-2.5 rounded-lg text-xs font-bold outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest ml-1">Verify</label>
                <input
                  type="password" name="confirm" required
                  onChange={handleChange}
                  className="w-full bg-zinc-50/50 border border-zinc-100 focus:border-zinc-900 p-2.5 rounded-lg text-xs font-bold outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && <p className="text-[8px] font-bold text-red-500 bg-red-50 p-2 rounded border border-red-100 text-center uppercase tracking-widest">{error}</p>}
            {success && <p className="text-[8px] font-bold text-emerald-600 bg-emerald-50 p-2 rounded border border-emerald-100 text-center uppercase tracking-widest">{success}</p>}

            <button
              disabled={loading}
              className={`w-full py-3.5 rounded-xl text-[9px] font-black uppercase tracking-[0.3em] transition-all relative overflow-hidden group shadow-lg active:scale-[0.97] mt-2 ${
                flow === 'member' ? "bg-zinc-900 text-white" : "bg-primary text-black"
              }`}
            >
               <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
               {loading ? "PROCESSING..." : flow === 'member' ? "INITIALIZE ACCESS" : "LAUNCH BUSINESS"}
            </button>
          </form>

          <footer className="mt-6 text-center text-[9px] font-bold text-zinc-400 tracking-tight">
            ALREADY REGISTERED ?{' '}
            <Link to="/login" className="text-zinc-900 border-b border-primary pb-0.5 ml-1 transition-all hover:text-primary">SIGN IN</Link>
          </footer>
        </div>
      </div>
    </div>
  );
}