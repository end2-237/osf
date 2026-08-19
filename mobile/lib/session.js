import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

/* ══════════════════════════════════════════════════════════════════════════
   QUI EST DEVANT L'ÉCRAN

   Un seul compte par boutique, celui du patron, connecté sur le téléphone de
   celui qui tient le comptoir — c'est la décision prise dans la stratégie et
   elle simplifie tout ici : soit ce compte a une boutique et l'application
   ouvre sur le comptoir, soit il n'en a pas et elle ouvre sur le relais du
   client. Il n'y a pas de troisième cas et pas de sélecteur de rôle.
   ══════════════════════════════════════════════════════════════════════════ */

const Ctx = createContext({});
export const useSession = () => useContext(Ctx);

export function useSessionValue() {
  const [user, setUser] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [charge, setCharge] = useState(true);

  const chargerVendeur = async (uid) => {
    if (!uid) { setVendor(null); return; }
    const { data } = await supabase
      .from('vendors').select('*').eq('user_id', uid).maybeSingle();
    setVendor(data || null);
  };

  useEffect(() => {
    let vivant = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivant) return;
      const u = data?.session?.user || null;
      setUser(u);
      await chargerVendeur(u?.id);
      if (vivant) setCharge(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if (!vivant) return;
      const u = s?.user || null;
      setUser(u);
      await chargerVendeur(u?.id);
      setCharge(false);
    });

    return () => { vivant = false; sub?.subscription?.unsubscribe(); };
  }, []);

  return {
    user, vendor, charge,
    rafraichir: () => chargerVendeur(user?.id),
    deconnecter: () => supabase.auth.signOut(),
  };
}

export const SessionProvider = Ctx.Provider;
