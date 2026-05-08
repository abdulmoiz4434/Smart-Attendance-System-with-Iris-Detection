import apiClient from './client';

export const verifyToken = async (idToken) => {
  const res = await apiClient.post('/api/auth/verify-token', { idToken });
  return res.data;
};