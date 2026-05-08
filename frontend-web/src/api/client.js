import axios from 'axios';
import { auth } from '../firebase';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

// Attach Firebase ID token to every request
apiClient.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle inactive user (403)
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 403) {
      await auth.signOut();
      window.location.href = '/login?reason=inactive';
    }
    return Promise.reject(error);
  }
);

export default apiClient;