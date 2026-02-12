import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  // Surveillance de la session au démarrage

useEffect(() => {
  console.log("🔍 [INIT] Démarrage de la surveillance Auth...");

  const initializeAuth = async () => {
    // Sécurité ultime : si après 7 secondes rien n'est chargé, on débloque l'UI
    const forceUnlock = setTimeout(() => {
      if (loading) {
        console.warn("⚠️ [SAFETY] Déblocage forcé du loader après 7s");
        setLoading(false);
      }
    }, 7000);

    try {
      // 1. Récupérer la session persistée (JWT dans le localStorage)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw sessionError;

      if (session?.user) {
        setUser(session.user);
        // On attend le profil vendeur, mais loadVendor a son propre try/finally
        await loadVendor(session.user.id);
      } else {
        // Pas de session trouvée
        setLoading(false);
      }
    } catch (error) {
      console.error("❌ [INIT] Erreur lors de l'initialisation:", error.message);
      // En cas d'erreur de session corrompue, on peut nettoyer ici
      // mais seulement si c'est une erreur critique
      if (error.message.includes("JWT") || error.message.includes("expired")) {
        console.log("Cleaning corrupted session...");
        localStorage.removeItem('sb-alrbokstfwwlvbvghrqr-auth-token');
      }
    } finally {
      // ✅ Ce bloc s'exécute TOUJOURS, succès ou échec
      setLoading(false);
      clearTimeout(forceUnlock);
    }
  };

  initializeAuth();

  // Écouteur pour les événements futurs
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      console.log(`🔄 [AUTH_CHANGE] Événement: ${event}`);
      
      if (session?.user) {
        setUser(session.user);
        if (event === 'SIGNED_IN') {
           await loadVendor(session.user.id);
        }
      } else {
        setUser(null);
        setVendor(null);
        setLoading(false);
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);

// Mise à jour de loadVendor pour être aussi "étanche"
const loadVendor = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(); // maybeSingle est crucial pour ne pas crasher si pas de profil

    if (error) throw error;
    setVendor(data);
  } catch (e) {
    console.error("❌ [LOAD_VENDOR] Erreur profil:", e.message);
    setVendor(null);
  } finally {
    // ✅ On s'assure que le chargement s'arrête ici aussi
    setLoading(false);
  }
};

  // Connexion
  const signIn = async (email, password) => {
    console.log("🔐 [SIGN_IN] Tentative de connexion pour:", email);
    const { data, error } = await supabase.auth.signInWithPassword({ 
      email: email.trim(), 
      password 
    });

    if (error) {
      console.error("❌ [SIGN_IN] Erreur Supabase Auth:", error.message);
      if (error.message.includes('Email not confirmed'))
        throw new Error('Email non confirmé — vérifiez vos emails ou désactivez la confirmation dans Supabase.');
      throw new Error(error.message);
    }
    console.log("✅ [SIGN_IN] Succès !");
    return data;
  };

  // Inscription avec Logs d'étapes
  const signUp = async (email, password, vendorData) => {
    console.log(">>> [STEP 1] Début du processus d'inscription pour:", email);
    
    try {
      // 1. Vérification du quota
      console.log(">>> [STEP 2] Vérification du quota de vendeurs (Max 5)...");
      const { count, error: countError } = await supabase
        .from('vendors')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (countError) {
        console.error("xxx [STEP 2] Erreur lors du comptage:", countError.message);
        throw countError;
      }
      console.log(">>> [STEP 2.1] Nombre actuel de vendeurs:", count);

      if (count >= 5) {
        console.error("xxx [STEP 2] Blocage: Limite de 5 vendeurs atteinte.");
        throw new Error('Le marketplace a atteint sa limite maximale de 5 vendeurs.');
      }

      // 2. Création de l'utilisateur Auth
      console.log(">>> [STEP 3] Création du compte dans Supabase Auth...");
      const { data: authData, error: authError } = await supabase.auth.signUp({ 
        email, 
        password 
      });

      if (authError) {
        console.error("xxx [STEP 3] Erreur Supabase Auth:", authError.message);
        throw authError;
      }
      
      if (!authData.user) {
        console.error("xxx [STEP 3] Aucun utilisateur retourné.");
        throw new Error('Échec de la création de l\'utilisateur.');
      }
      console.log(">>> [STEP 3.1] Utilisateur Auth créé. ID:", authData.user.id);

      // 3. Insertion du profil vendeur
      console.log(">>> [STEP 4] Insertion des données dans la table 'vendors'...");
      const { error: vendorError } = await supabase.from('vendors').insert({
        user_id: authData.user.id,
        email: email,
        full_name: vendorData.full_name,
        phone: vendorData.phone,
        shop_name: vendorData.shop_name,
        is_active: true,
      });

      if (vendorError) {
        console.error("xxx [STEP 4] Échec critique insertion 'vendors':", vendorError.message);
        console.error("Détails SQL:", vendorError);
        throw new Error('Erreur profil vendeur: ' + vendorError.message);
      }

      console.log(">>> [SUCCESS] Inscription et création de profil terminées !");
      return authData;

    } catch (error) {
      console.error("!!! [BLOCK] L'inscription a échoué à une étape critique:", error.message);
      throw error;
    }
  };

  const signOut = async () => {
    console.log("🚪 [SIGN_OUT] Déconnexion de l'utilisateur.");
    await supabase.auth.signOut();
    setVendor(null);
    setUser(null);
    
    // ✅ FIX : Nettoyer le cache pour éviter les bugs après déconnexion
    localStorage.removeItem('sb-alrbokstfwwlvbvghrqr-auth-token');
  };

  return (
    <AuthContext.Provider value={{ user, vendor, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};