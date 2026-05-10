import apiClient from './client';

export const getStudentSubjectReport = (uid, subjectId) =>
    apiClient.get(`/api/reports/student/${uid}/subject/${subjectId}`);

export const getAllSubjectReports = (uid) =>
    apiClient.get(`/api/reports/student/${uid}/all-subjects`);

export const listMyAttendance = (params) =>
    apiClient.get('/api/attendance', { params });

export const listSubjects = () =>
    apiClient.get('/api/subjects');

export const listLectures = (params) =>
    apiClient.get('/api/lectures', { params });