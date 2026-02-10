import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
      await signIn(email.trim(), password);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-6 pt-24">
      <div className="w-full max-w-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 p-10 rounded-[3rem] shadow-2xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black italic tracking-tighter uppercase dark:text-white">
            Vendor <span className="text-primary">Access</span>
          </h2>
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500 mt-2">
            OneFreestyle Elite Dashboard
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6">
            <p className="text-red-500 text-xs font-bold text-center">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-[10px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl text-xs font-bold focus:border-primary outline-none dark:text-white"
              placeholder="vendor@freestyle.space"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl text-xs font-bold focus:border-primary outline-none dark:text-white"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black dark:bg-primary dark:text-black text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] hover:scale-[1.02] transition-all disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Se Connecter'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
            Pas encore vendeur ?{' '}
            <Link to="/register" className="text-primary hover:underline">S'inscrire</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;