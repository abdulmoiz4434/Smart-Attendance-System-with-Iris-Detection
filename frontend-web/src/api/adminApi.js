import apiClient from './client';

// ── Users ──────────────────────────────────────────────────────────────────
export const createUser = (data) => apiClient.post('/api/admin/users', data);
export const listUsers = (role) => apiClient.get('/api/admin/users', { params: role ? { role } : {} });
export const getUser = (uid) => apiClient.get(`/api/admin/users/${uid}`);
export const updateUser = (uid, data) => apiClient.patch(`/api/admin/users/${uid}`, data);
export const deactivateUser = (uid) => apiClient.delete(`/api/admin/users/${uid}`);
export const resetIris = (uid) => apiClient.post(`/api/admin/users/${uid}/reset-iris`);

// ── Subjects ───────────────────────────────────────────────────────────────
export const createSubject = (data) => apiClient.post('/api/subjects', data);
export const listSubjects = () => apiClient.get('/api/subjects');
export const getSubject = (id) => apiClient.get(`/api/subjects/${id}`);
export const updateSubject = (id, data) => apiClient.patch(`/api/subjects/${id}`, data);
export const generateLectures = (id) => apiClient.post(`/api/subjects/${id}/generate-lectures`);
export const regenerateFutureLectures = (id) => apiClient.post(`/api/subjects/${id}/regenerate-future-lectures`);
export const enrollStudents = (id, studentIds) => apiClient.patch(`/api/subjects/${id}/enroll`, { studentIds });

// ── Lectures ───────────────────────────────────────────────────────────────
export const listLectures = (params) => apiClient.get('/api/lectures', { params });
export const createManualLecture = (data) => apiClient.post('/api/lectures', data);
export const cancelLecture = (id) => apiClient.patch(`/api/lectures/${id}/cancel`);

// ── Config ─────────────────────────────────────────────────────────────────
export const getConfig = () => apiClient.get('/api/system-config');
export const updateConfig = (data) => apiClient.patch('/api/system-config', data);