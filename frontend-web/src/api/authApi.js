import apiClient from './client';

export const verifyToken = async (idToken) => {
  // Exchange Firebase ID token for a custom JWT the backend accepts
  const res = await apiClient.post('/api/auth/verify-token', { idToken });
  return res.data;
};

export const webLogin = async (idToken) => {
  const res = await apiClient.post('/api/auth/web-login', { idToken });
  return res.data; // { token, user }
};