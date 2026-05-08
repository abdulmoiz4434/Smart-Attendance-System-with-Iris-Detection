import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfigProvider } from './context/ConfigContext';
import RoleGuard from './components/layout/RoleGuard';

// Pages — will be created in later phases; stubs for now
import LoginPage from './pages/auth/LoginPage';

import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminSubjects from './pages/admin/Subjects';
import AdminLectures from './pages/admin/Lectures';
import AdminConfig from './pages/admin/Config';
import AdminNotifications from './pages/admin/Notifications';
import AdminReports from './pages/admin/Reports';

import TeacherDashboardPage from './pages/teacher/Dashboard';
import LectureDetail from './pages/teacher/LectureDetail';
import TeacherNotifications from './pages/teacher/Notifications';

import StudentDashboardPage from './pages/student/Dashboard';
import StudentSchedule from './pages/student/Schedule';
import StudentHistory from './pages/student/History';
import StudentNotifications from './pages/student/Notifications';

function RootRedirect() {
  const { userProfile, loading } = useAuth();
  if (loading) return null;
  if (!userProfile) return <Navigate to="/login" replace />;
  const routes = { admin: '/admin/dashboard', teacher: '/teacher/dashboard', student: '/student/dashboard' };
  return <Navigate to={routes[userProfile.role] || '/login'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ConfigProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />

            <Route path="/admin/*" element={
              <RoleGuard allowedRoles={['admin']}>
                <Routes>
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="subjects" element={<AdminSubjects />} />
                  <Route path="lectures" element={<AdminLectures />} />
                  <Route path="config" element={<AdminConfig />} />
                  <Route path="reports" element={<AdminReports />} />
                  <Route path="notifications" element={<AdminNotifications />} />
                </Routes>
              </RoleGuard>
            } />

            {/* Teacher */}
            <Route path="/teacher/*" element={
              <RoleGuard allowedRoles={['teacher']}>
                <Routes>
                  <Route path="dashboard" element={<TeacherDashboardPage />} />
                  <Route path="lectures/:lectureId" element={<LectureDetail />} />
                  <Route path="notifications" element={<TeacherNotifications />} />
                </Routes>
              </RoleGuard>
            } />

            {/* Student */}
            <Route path="/student/*" element={
              <RoleGuard allowedRoles={['student']}>
                <Routes>
                  <Route path="dashboard" element={<StudentDashboardPage />} />
                  <Route path="schedule" element={<StudentSchedule />} />
                  <Route path="history" element={<StudentHistory />} />
                  <Route path="notifications" element={<StudentNotifications />} />
                </Routes>
              </RoleGuard>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ConfigProvider>
    </AuthProvider>
  );
}