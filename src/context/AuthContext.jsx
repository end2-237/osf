import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { requestNotificationPermission } from '../lib/firebase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérifier la session actuelle
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchVendorData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchVendorData(session.user.id);
        } else {
          setVendor(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Dans src/context/AuthContext.jsx
const fetchVendorData = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    setVendor(data);
  } catch (error) {
    console.error('Erreur lors de la récupération des données vendeur:', error.message);
    // On ne bloque pas l'utilisateur si la requête échoue
  } finally {
    setLoading(false); // <--- DOIT TOUJOURS ÊTRE APPELÉ
  }
};

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  };

  const signUp = async (email, password, vendorData) => {
    // Vérifier le nombre de vendeurs actifs
    const { count } = await supabase
      .from('vendors')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (count >= 5) {
      throw new Error('Maximum de 5 vendeurs atteint');
    }

    // Créer le compte auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;

    // Créer le profil vendeur
    const { error: vendorError } = await supabase
      .from('vendors')
      .insert({
        user_id: authData.user.id,
        email: email,
        full_name: vendorData.full_name,
        phone: vendorData.phone,
        shop_name: vendorData.shop_name,
      });

    if (vendorError) {
      // Supprimer le compte auth si échec de création du profil
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw vendorError;
    }

    return authData;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setVendor(null);
  };

  const value = {
    user,
    vendor,
    loading,
    signIn,
    signUp,
    signOut,
  };

  // Remplace cette ligne à la fin de AuthContext.jsx
return (
  <AuthContext.Provider value={value}>
    {children} {/* Supprime le "!loading &&" ici pour forcer l'affichage */}
  </AuthContext.Provider>
);
};
