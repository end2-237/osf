import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [vendor, setVendor]   = useState(null);
  const [loading, setLoading] = useState(true);
  const initDoneRef = useRef(false);

  useEffect(() => {
    const loadVendor = async (userId) => {
      try {
        const { data, error } = await supabase
          .from('vendors')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        if (error) throw error;
        setVendor(data);
      } catch (e) {
        // ✅ FIX : ignorer silencieusement les AbortError (navigator.locks)
        if (e?.name === 'AbortError' || e?.message?.includes('aborted')) {
          console.warn('⚠️ [LOAD_VENDOR] AbortError ignoré (navigator.locks)');
        } else {
          console.error('❌ [LOAD_VENDOR]', e.message);
        }
        setVendor(null);
      } finally {
        setLoading(false);
      }
    };

    const initializeAuth = async () => {
      const forceUnlock = setTimeout(() => {
        console.warn('⚠️ [SAFETY] Déblocage forcé après 7s');
        setLoading(false);
      }, 7000);

      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        // ✅ FIX : ignorer les AbortError — elles ne signifient pas un échec d'auth
        if (error) {
          if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
            console.warn('⚠️ [INIT] AbortError ignoré, retry getSession...');
            // Petite pause puis retry une seule fois
            await new Promise(r => setTimeout(r, 500));
            const { data: retryData } = await supabase.auth.getSession();
            if (retryData?.session?.user) {
              setUser(retryData.session.user);
              await loadVendor(retryData.session.user.id);
              return;
            }
            setLoading(false);
            return;
          }
          throw error;
        }

        if (session?.user) {
          setUser(session.user);
          await loadVendor(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error('❌ [INIT]', e.message);
        if (e.message?.includes('JWT') || e.message?.includes('expired')) {
          localStorage.removeItem('sb-alrbokstfwwlvbvghrqr-auth-token');
        }
        setLoading(false);
      } finally {
        clearTimeout(forceUnlock);
        initDoneRef.current = true;
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`🔄 [AUTH_CHANGE] ${event}`);

        if (session?.user) {
          setUser(session.user);
          if (event === 'SIGNED_IN' && !initDoneRef.current) return;
          if (event === 'SIGNED_IN') await loadVendor(session.user.id);
        } else {
          setUser(null);
          setVendor(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      if (error.message.includes('Email not confirmed'))
        throw new Error('Email non confirmé — vérifiez vos emails.');
      throw new Error(error.message);
    }
    return data;
  };

  const signUp = async (email, password, vendorData) => {
    const { count, error: countError } = await supabase
      .from('vendors').select('*', { count: 'exact', head: true }).eq('is_active', true);
    if (countError) throw countError;
    if (count >= 5) throw new Error('Limite maximale de 5 vendeurs atteinte.');

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw authError;
    if (!authData.user) throw new Error("Échec création utilisateur.");

    const { error: vendorError } = await supabase.from('vendors').insert({
      user_id: authData.user.id, email,
      full_name: vendorData.full_name,
      phone: vendorData.phone,
      shop_name: vendorData.shop_name,
      is_active: true,
    });
    if (vendorError) throw new Error('Erreur profil vendeur: ' + vendorError.message);
    return authData;
  };

  const signOut = async () => {
    initDoneRef.current = false;
    await supabase.auth.signOut();
    setVendor(null);
    setUser(null);
    localStorage.removeItem('sb-alrbokstfwwlvbvghrqr-auth-token');
  };

  return (
    <AuthContext.Provider value={{ user, vendor, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};