import apiClient from './client';

export const listMyLectures = (params) => apiClient.get('/api/lectures', { params });
export const openAttendance = (id) => apiClient.patch(`/api/lectures/${id}/open`);
export const closeAttendance = (id) => apiClient.patch(`/api/lectures/${id}/close`);
export const checkClose = (id) => apiClient.patch(`/api/lectures/${id}/check-close`);

export const listAttendance = (params) => apiClient.get('/api/attendance', { params });
export const approveRecord = (docId) => apiClient.patch(`/api/attendance/${docId}/approve`);
export const rejectRecord = (docId) => apiClient.patch(`/api/attendance/${docId}/reject`);
export const approveAll = (lectureId) => apiClient.post('/api/attendance/approve-all', null, { params: { lecture_id: lectureId } });
export const manualMark = (data) => apiClient.post('/api/attendance/manual', data);
export const listSubjects = () => apiClient.get('/api/subjects');
export const getConfig = () => apiClient.get('/api/system-config');