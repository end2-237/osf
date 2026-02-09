import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const PrivateRoute = ({ isAdmin }) => {
  // Si isAdmin est true, on affiche les composants enfants (Outlet)
  // Sinon, redirection vers la home
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />;
};

export default PrivateRoute;