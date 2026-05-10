import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from storage on app start
    AsyncStorage.getItem('auth_token').then(async (token) => {
      if (token) {
        try {
          const res = await apiClient.get('/api/auth/me');
          setUserProfile(res.data);
        } catch {
          await AsyncStorage.removeItem('auth_token');
        }
      }
      setLoading(false);
    });
  }, []);

  const login = async (email, password) => {
    const res = await apiClient.post('/api/auth/mobile-login', { email, password });
    await AsyncStorage.setItem('auth_token', res.data.token);
    setUserProfile(res.data.user);
    return res.data;
  };

  const logout = async () => {
    await AsyncStorage.removeItem('auth_token');
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider value={{ userProfile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);