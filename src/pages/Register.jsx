import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [formData, setFormData] = useState({
    email: '', password: '', confirmPassword: '',
    full_name: '', phone: '', shop_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Mot de passe : minimum 6 caractères.');
      return;
    }

    setLoading(true);
    try {
      const data = await signUp(formData.email, formData.password, {
        full_name: formData.full_name,
        phone:     formData.phone,
        shop_name: formData.shop_name,
      });

      // Session immédiate = confirmation email désactivée → on redirige
      if (data?.session) {
        navigate('/admin');
        return;
      }

      // Sinon Supabase a envoyé un email de confirmation
      setSuccess('Compte créé ! Vérifiez votre email puis connectez-vous.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-6 pt-24 pb-12">
      <div className="w-full max-w-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 p-10 rounded-[3rem] shadow-2xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black italic tracking-tighter uppercase dark:text-white">
            Become a <span className="text-primary">Vendor</span>
          </h2>
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500 mt-2">
            Join OneFreestyle Elite Marketplace
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6">
            <p className="text-red-500 text-xs font-bold text-center">{error}</p>
          </div>
        )}

        {success ? (
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-6 text-center space-y-4">
            <p className="text-primary font-black text-sm">{success}</p>
            <Link to="/login" className="inline-block bg-primary text-black px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest">
              Se connecter
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">Nom Complet *</label>
                <input type="text" name="full_name" required value={formData.full_name} onChange={handleChange}
                  className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl text-xs font-bold focus:border-primary outline-none dark:text-white"
                  placeholder="John Doe" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">Téléphone *</label>
                <input type="tel" name="phone" required value={formData.phone} onChange={handleChange}
                  className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl text-xs font-bold focus:border-primary outline-none dark:text-white"
                  placeholder="+237 6XX XXX XXX" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">Nom de la Boutique *</label>
              <input type="text" name="shop_name" required value={formData.shop_name} onChange={handleChange}
                className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl text-xs font-bold focus:border-primary outline-none dark:text-white"
                placeholder="Elite Tech Store" />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">Email *</label>
              <input type="email" name="email" required value={formData.email} onChange={handleChange}
                className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl text-xs font-bold focus:border-primary outline-none dark:text-white"
                placeholder="vendor@freestyle.space" />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">Mot de Passe *</label>
                <input type="password" name="password" required value={formData.password} onChange={handleChange}
                  className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl text-xs font-bold focus:border-primary outline-none dark:text-white"
                  placeholder="••••••••" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-400 mb-2 block tracking-widest">Confirmer *</label>
                <input type="password" name="confirmPassword" required value={formData.confirmPassword} onChange={handleChange}
                  className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl text-xs font-bold focus:border-primary outline-none dark:text-white"
                  placeholder="••••••••" />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-black dark:bg-primary dark:text-black text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] hover:scale-[1.02] transition-all disabled:opacity-50">
              {loading ? 'Création...' : 'Créer mon compte vendeur'}
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
            Déjà vendeur ?{' '}
            <Link to="/login" className="text-primary hover:underline">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;