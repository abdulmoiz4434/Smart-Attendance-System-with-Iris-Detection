import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { listUsers } from '../../api/adminApi';
import { listLectures } from '../../api/adminApi';
import { getTodayISO, formatDate } from '@smart-attendance/shared';

export default function AdminDashboard() {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState({ students: 0, teachers: 0, lecturesToday: 0 });

  useEffect(() => {
    async function load() {
      const [studentsRes, teachersRes, lecturesRes] = await Promise.all([
        listUsers('student'),
        listUsers('teacher'),
        listLectures({ date: getTodayISO() }),
      ]);
      setStats({
        students: studentsRes.data.length,
        teachers: teachersRes.data.length,
        lecturesToday: lecturesRes.data.length,
      });
    }
    load();
  }, []);

  const today = new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = userProfile?.fullName?.split(' ')[0];

  return (
    <AdminLayout>
      {/* Header */}
      <span style={eyebrow}>ADMIN PORTAL</span>
      <h1 style={heading}>Good morning, {firstName}</h1>
      <p style={sub}>{today}</p>

      {/* Hero card */}
      <div style={heroCard}>
        <p style={heroLabel}>Smart Attendance System</p>
        <p style={heroSub}>System overview</p>
        <div style={heroStats}>
          {[
            { label: 'Total Students', value: stats.students },
            { label: 'Total Teachers', value: stats.teachers },
            { label: 'Lectures Today', value: stats.lecturesToday },
          ].map(s => (
            <div key={s.label} style={heroStat}>
              <span style={heroStatVal}>{s.value}</span>
              <span style={heroStatLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Module grid */}
      <span style={sectionEyebrow}>MODULES</span>
      <div style={grid}>
        {MODULES.map(m => (
          <a key={m.label} href={m.path} style={moduleCard}>
            <div style={iconTile}>{m.icon}</div>
            <p style={moduleTitle}>{m.label}</p>
            <p style={moduleSub}>{m.desc}</p>
          </a>
        ))}
      </div>
    </AdminLayout>
  );
}

const MODULES = [
  { label: 'User Management', path: '/admin/users', icon: '👤', desc: 'Create & manage accounts' },
  { label: 'Subject Management', path: '/admin/subjects', icon: '📚', desc: 'Subjects & schedules' },
  { label: 'Lecture Management', path: '/admin/lectures', icon: '🗓️', desc: 'View & manage lectures' },
  { label: 'Reports', path: '/admin/reports', icon: '📊', desc: 'Attendance analytics' },
  { label: 'System Config', path: '/admin/config', icon: '⚙️', desc: 'Thresholds & toggles' },
  { label: 'Notifications', path: '/admin/notifications', icon: '🔔', desc: 'Send announcements' },
];

const eyebrow = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '12px' };
const heading = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '28px', color: '#0B0D14', marginBottom: '4px' };
const sub = { fontSize: '13px', color: '#6B6760', marginBottom: '28px' };
const heroCard = { background: '#0B0D14', borderRadius: '22px', padding: '28px 32px', marginBottom: '32px' };
const heroLabel = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '18px', color: '#F5F3EF', marginBottom: '4px' };
const heroSub = { fontSize: '13px', color: '#6B6760', marginBottom: '24px' };
const heroStats = { display: 'flex', gap: '32px' };
const heroStat = { display: 'flex', flexDirection: 'column' };
const heroStatVal = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '28px', color: '#F5F3EF' };
const heroStatLabel = { fontSize: '11px', color: '#9B9790', marginTop: '2px' };
const sectionEyebrow = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '16px' };
const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '680px' };
const moduleCard = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '20px', padding: '22px', textDecoration: 'none', display: 'block', cursor: 'pointer' };
const iconTile = { width: 38, height: 38, borderRadius: 11, background: '#0B0D14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '14px' };
const moduleTitle = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '14px', color: '#0B0D14', marginBottom: '4px' };
const moduleSub = { fontSize: '11px', color: '#9B9790' };