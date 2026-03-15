import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      // Verify token is still valid
      verifyToken(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (tokenToVerify) => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${tokenToVerify}` }
      });
      setUser(response.data);
      setLoading(false);
    } catch (error) {
      // Token invalid or expired
      logout();
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, user: userData } = response.data;
    
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('auth_token', access_token);
    localStorage.setItem('auth_user', JSON.stringify(userData));
    
    return response.data;
  };

  const register = async (email, password, name) => {
    const response = await axios.post(`${API}/auth/register`, { email, password, name });
    return response.data;
  };

  const verifyCode = async (email, code) => {
    const response = await axios.post(`${API}/auth/verify`, { email, code });
    const { access_token, user: userData } = response.data;
    
    setToken(access_token);
    setUser(userData);
    localStorage.setItem('auth_token', access_token);
    localStorage.setItem('auth_user', JSON.stringify(userData));
    
    return response.data;
  };

  const forgotPassword = async (email) => {
    const response = await axios.post(`${API}/auth/forgot-password`, { email });
    return response.data;
  };

  const resetPassword = async (email, code, newPassword) => {
    const response = await axios.post(`${API}/auth/reset-password`, { 
      email, 
      code, 
      new_password: newPassword 
    });
    return response.data;
  };

  const resendCode = async (email) => {
    const response = await axios.post(`${API}/auth/resend-code`, { email });
    return response.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    verifyCode,
    forgotPassword,
    resetPassword,
    resendCode,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
