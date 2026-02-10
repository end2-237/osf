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
    console.log(" [INIT] Vérification de la session existante...");
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log(" [INIT] Session trouvée pour:", session.user.email);
        setUser(session.user);
        loadVendor(session.user.id);
      } else {
        console.log(" [INIT] Aucune session active.");
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log(` [AUTH_CHANGE] Événement: ${_event}`);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadVendor(session.user.id);
        } else {
          setVendor(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Chargement des données du vendeur
  const loadVendor = async (userId) => {
    console.log(" [LOAD_VENDOR] Début du chargement...");
    setLoading(true); // Force le chargement au début de la fonction
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', userId)
        .single();
  
      if (error) {
        console.error(" [LOAD_VENDOR] Profil non trouvé ou erreur SQL:", error.message);
        setVendor(null);
      } else {
        console.log(" [LOAD_VENDOR] Profil vendeur chargé :", data.shop_name);
        setVendor(data);
      }
    } catch (e) {
      console.error(" [LOAD_VENDOR] Exception:", e);
      setVendor(null);
    } finally {
      setLoading(false); // On ne libère le chargement qu'ICI
      console.log(" [LOAD_VENDOR] Chargement terminé.");
    }
  };

  // Connexion
  const signIn = async (email, password) => {
    console.log(" [SIGN_IN] Tentative de connexion pour:", email);
    const { data, error } = await supabase.auth.signInWithPassword({ 
      email: email.trim(), 
      password 
    });

    if (error) {
      console.error(" [SIGN_IN] Erreur Supabase Auth:", error.message);
      if (error.message.includes('Email not confirmed'))
        throw new Error('Email non confirmé — vérifiez vos emails ou désactivez la confirmation dans Supabase.');
      throw new Error(error.message);
    }
    console.log(" [SIGN_IN] Succès !");
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
    console.log(" [SIGN_OUT] Déconnexion de l'utilisateur.");
    await supabase.auth.signOut();
    setVendor(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, vendor, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};