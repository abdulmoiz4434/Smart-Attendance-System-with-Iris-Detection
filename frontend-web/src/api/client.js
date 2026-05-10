import axios from 'axios';
import { auth } from '../firebase';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 403) {
      await auth.signOut();
      localStorage.removeItem('jwt');
      window.location.href = '/login?reason=inactive';
    }
    return Promise.reject(error);
  }
);

export default apiClient;