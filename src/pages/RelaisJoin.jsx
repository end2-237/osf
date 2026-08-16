import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

/* ══════════════════════════════════════════════════════════════════════════
   L'AFFICHE DU COMPTOIR — /r/:code

   Le client scanne l'autocollant collé sur le comptoir avec son appareil
   photo. Aucune application à installer : c'est une page web.

   Deux gestes, et rien de plus. Pas de code SMS, pas de vérification, pas de
   confirmation d'adresse. Demander un code à quelqu'un qui n'a encore rien
   reçu, debout dans une boutique avec un vendeur qui attend, fait tomber la
   conversion de moitié.

   Son numéro se vérifie tout seul à l'écran du paiement : on ne paie pas en
   Mobile Money avec le numéro d'un autre. La vérification arrive au moment où
   elle a une valeur, pas au moment où elle coûte un client.

   C'est le seul canal d'acquisition du modèle : deux cent quarante-six
   personnes par mois et par rayon découvrent Buyticle exactement ici.
   ══════════════════════════════════════════════════════════════════════════ */

export default function RelaisJoin() {
  const { code } = useParams();            // le code d'affiliation de la boutique
  const navigate = useNavigate();
  const { user } = useAuth();
  const [boutique, setBoutique] = useState(null);
  const [tel, setTel]   = useState('');
  const [mdp, setMdp]   = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg]   = useState('');

  useEffect(() => {
    if (user) { navigate('/mon-relais', { replace: true }); return; }
    if (!code) return;
    supabase.from('vendors').select('id, shop_name').eq('referral_code', code.toUpperCase())
      .maybeSingle()
      .then(({ data }) => setBoutique(data));
  }, [code, user, navigate]);

  const creer = async (e) => {
    e.preventDefault();
    const num = tel.replace(/\D/g, '');
    if (num.length < 9) { setMsg('Entre ton numéro à 9 chiffres.'); return; }
    if (mdp.length < 6)  { setMsg('Six caractères au minimum.'); return; }
    setBusy(true); setMsg('');

    // Le numéro tient lieu d'identifiant. L'adresse e-mail est dérivée, jamais
    // demandée : on ne fait pas taper une adresse à quelqu'un qui attend.
    const { error } = await supabase.auth.signUp({
      email: `${num}@relais.buyticle.cm`,
      password: mdp,
      options: { data: { phone: num, source: 'relais', boutique: code } },
    });
    setBusy(false);
    if (error) {
      // Un compte existe déjà avec ce numéro : on le connecte au lieu de le
      // renvoyer sur un écran d'erreur. Il est debout devant un vendeur.
      const { error: e2 } = await supabase.auth.signInWithPassword({
        email: `${num}@relais.buyticle.cm`, password: mdp,
      });
      if (e2) { setMsg('Ce numéro a déjà un compte, et le mot de passe ne correspond pas.'); return; }
    }
    navigate('/mon-relais', { replace: true });
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Buyticle</p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1.5 leading-tight">
            {boutique ? `${boutique.shop_name} t’envoie` : 'On t’envoie'} chez un voisin qui l’a
          </h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Ton numéro, un mot de passe, et tu as ton chemin et ta remise.
            Rien à installer.
          </p>
        </div>

        <form onSubmit={creer} className="space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400 block mb-1.5">
              Ton numéro
            </label>
            <input value={tel} onChange={(e) => setTel(e.target.value)}
              inputMode="numeric" autoFocus placeholder="6XX XX XX XX"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-lg outline-none focus:border-gray-900" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400 block mb-1.5">
              Un mot de passe
            </label>
            <input value={mdp} onChange={(e) => setMdp(e.target.value)}
              type="password" placeholder="6 caractères"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-lg outline-none focus:border-gray-900" />
          </div>
          <button type="submit" disabled={busy}
            className="w-full bg-gray-900 text-white rounded-xl py-4 text-[15px] font-bold disabled:opacity-40">
            {busy ? '…' : 'Voir mon relais'}
          </button>
        </form>

        {msg && <p className="text-[13px] text-red-600 text-center mt-3">{msg}</p>}

        <p className="text-[11px] text-gray-400 text-center mt-6 leading-relaxed">
          Ton numéro sert à retrouver ton compte. Il sera vérifié au moment du
          paiement, pas maintenant.
        </p>
      </div>
    </div>
  );
}
