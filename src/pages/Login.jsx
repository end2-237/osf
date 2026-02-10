import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(formData.email, formData.password);
      navigate('/admin');
    } catch (error) {
      setError(error.message || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-6 pt-24">
      <div className="w-full max-w-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 p-10 rounded-[3rem] shadow-2xl animate-fadeIn">
        <div className="text-center mb-10">
          <h2 className="logo-font text-3xl font-black italic tracking-tighter uppercase dark:text-white">
            Vendor <span className="text-primary">Access</span>
          </h2>
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500 mt-2">
            OneFreestyle Elite Dashboard
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6 animate-shake">
            <p className="text-red-500 text-xs font-bold text-center">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-[10px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl text-xs font-bold focus:border-primary outline-none dark:text-white transition-all"
              placeholder="vendor@freestyle.space"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">
              Password
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl text-xs font-bold focus:border-primary outline-none dark:text-white transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black dark:bg-primary dark:text-black text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] hover:scale-[1.02] active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Connexion...' : 'Se Connecter'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
            Pas encore vendeur ?{' '}
            <Link to="/register" className="text-primary hover:underline">
              S'inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
