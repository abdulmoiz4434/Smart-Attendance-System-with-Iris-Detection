import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import apiClient from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          const loginRes = await apiClient.post('/api/auth/web-login', { idToken });
          localStorage.setItem('jwt', loginRes.data.token);
          setCurrentUser(firebaseUser);
          setUserProfile(loginRes.data.user);
          setAuthError(null);
        } catch (err) {
          if (err.response?.status === 403) setAuthError('inactive');
          else setAuthError('error');
          await signOut(auth);
          localStorage.removeItem('jwt');
          setCurrentUser(null);
          setUserProfile(null);
        }
      } else {
        localStorage.removeItem('jwt');
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
    localStorage.removeItem('jwt');
    setCurrentUser(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, loading, authError, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);