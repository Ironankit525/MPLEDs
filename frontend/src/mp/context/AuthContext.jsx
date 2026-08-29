import React, { createContext, useState, useEffect } from 'react';
import { mockAuthService } from '../mockServices/mockAuthService';
import { MOCK_MPS } from '../mock/mps';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentMP, setCurrentMP] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const session = await mockAuthService.getCurrentSession();
        if (session) {
          setCurrentUser(session.user);
          setCurrentMP(session.mp);
        }
      } catch (err) {
        console.error('Failed to initialize auth session:', err);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const loginAsMP = async (mpId) => {
    setLoading(true);
    try {
      const session = await mockAuthService.loginWithMP(mpId);
      setCurrentUser(session.user);
      setCurrentMP(session.mp);
      return session;
    } finally {
      setLoading(false);
    }
  };

  const switchMP = async (mpId) => {
    setLoading(true);
    try {
      const session = await mockAuthService.loginWithMP(mpId);
      setCurrentUser(session.user);
      setCurrentMP(session.mp);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await mockAuthService.logout();
      setCurrentUser(null);
      setCurrentMP(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentMP,
        isAuthenticated: !!currentUser,
        loading,
        loginAsMP,
        switchMP,
        logout,
        availableMPs: MOCK_MPS
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
