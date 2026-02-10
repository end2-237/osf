import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = () => {
  const { vendor, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return vendor ? <Outlet /> : <Navigate to="/login" replace />;
};

export default PrivateRoute;
