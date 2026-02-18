import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [vendor, setVendor]   = useState(null);
  const [loading, setLoading] = useState(true);
  const initDoneRef     = useRef(false);
  const vendorLoadedRef = useRef(false);

  const loadVendor = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      setVendor(data);
      vendorLoadedRef.current = !!data;
    } catch (e) {
      if (e?.name === 'AbortError' || e?.message?.includes('aborted')) {
        console.warn('⚠️ [LOAD_VENDOR] AbortError ignoré — vendor conservé');
        if (!vendorLoadedRef.current) setVendor(null);
      } else {
        console.error('❌ [LOAD_VENDOR]', e.message);
        setVendor(null);
        vendorLoadedRef.current = false;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const forceUnlock = setTimeout(() => {
        console.warn('⚠️ [SAFETY] Déblocage forcé après 15s');
        setLoading(false);
      }, 15000);

      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
            console.warn('⚠️ [INIT] AbortError ignoré, retry...');
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
          if (event === 'SIGNED_IN') {
            if (!initDoneRef.current) return;
            if (vendorLoadedRef.current) {
              console.log('[AUTH] Vendor déjà chargé, skip loadVendor');
              return;
            }
            await loadVendor(session.user.id);
          }
        } else {
          setUser(null);
          setVendor(null);
          vendorLoadedRef.current = false;
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /* ─── SIGN IN ─── */
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      if (error.message.includes('Email not confirmed'))
        throw new Error('Email non confirmé — vérifiez vos emails.');
      throw new Error(error.message);
    }
    vendorLoadedRef.current = false;
    return data;
  };

  /* ─── SIGN UP VENDOR ─── */
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

  /* ─── SIGN UP MEMBRE (client avec remise) ─── */
  const signUpMember = async (email, password, displayName) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("Échec création du compte.");
    // Pas d'insertion dans vendors → l'utilisateur est un membre normal
    return authData;
  };

  /* ─── SIGN OUT ─── */
  const signOut = async () => {
    initDoneRef.current = false;
    vendorLoadedRef.current = false;
    await supabase.auth.signOut();
    setVendor(null);
    setUser(null);
    localStorage.removeItem('sb-alrbokstfwwlvbvghrqr-auth-token');
  };

  /* ─── UPDATE VENDOR FIELD (pour le toggle depuis Dashboard) ─── */
  const updateVendorField = async (field, value) => {
    if (!vendor?.id) return;
    const { error } = await supabase
      .from('vendors')
      .update({ [field]: value })
      .eq('id', vendor.id);
    if (error) throw new Error(error.message);
    setVendor(prev => ({ ...prev, [field]: value }));
  };

  /* ─── FLAGS dérivés ─── */
  // isVendor : a un profil vendeur
  const isVendor = !!vendor;
  // isMember : connecté MAIS pas vendeur (compte client avec remise)
  const isMember = !!user && !isVendor;

  return (
    <AuthContext.Provider value={{
      user,
      vendor,
      loading,
      isVendor,
      isMember,
      signIn,
      signUp,
      signUpMember,
      signOut,
      updateVendorField,
    }}>
      {children}
    </AuthContext.Provider>
  );
};