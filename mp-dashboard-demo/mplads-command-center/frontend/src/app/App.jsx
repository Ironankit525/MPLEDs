import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext.jsx';
import { UserProvider } from '../context/UserContext.jsx';
import { AppRoutes } from './AppRoutes.jsx';

export const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UserProvider>
          <AppRoutes />
        </UserProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};
