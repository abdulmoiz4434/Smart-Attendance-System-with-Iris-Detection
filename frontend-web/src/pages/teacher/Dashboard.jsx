import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import TeacherLayout from '../../components/layout/TeacherLayout';
import StatusPill from '../../components/shared/StatusPill';
import { openAttendance, closeAttendance, checkClose, listSubjects } from '../../api/teacherApi';
import { getTodayISO, formatTime } from '@smart-attendance/shared';
import { useNavigate } from 'react-router-dom';

const MODULES = [
  { label: 'Today\'s Schedule', path: null,                    icon: '🗓️', desc: 'View and manage today\'s lectures', key: 'schedule' },
  { label: 'Notifications',     path: '/teacher/notifications', icon: '🔔', desc: 'View announcements and alerts',     key: 'notif' },
];

export default function TeacherDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [lectures, setLectures] = useState([]);
  const [subjects, setSubjects] = useState({});
  const [pendingCounts, setPendingCounts] = useState({});
  const [toggling, setToggling] = useState({});
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Load subjects map once
  useEffect(() => {
    listSubjects().then(r => {
      const map = {};
      r.data.forEach(s => { map[s.subjectId] = s; });
      setSubjects(map);
    });
  }, []);

  // Real-time listener: today's lectures for this teacher
  useEffect(() => {
    if (!userProfile?.uid) return;
    const today = getTodayISO();
    console.log('Querying lectures for date:', today, '| Teacher UID:', userProfile.uid);
    const q = query(
      collection(db, 'lectures'),
      where('teacherId', '==', userProfile.uid),
      where('scheduledDate', '==', today),
    );
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => d.data());
      data.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setLectures(data);

      // Auto-close check for any open lectures past endTime
      data.forEach(lec => {
        if (lec.attendanceOpen) {
          checkClose(lec.lectureId).catch(() => { });
        }
      });
    });
    return unsub;
  }, [userProfile]);

  // Real-time listener: pending attendance counts per lecture
  useEffect(() => {
    if (lectures.length === 0) return;
    const lectureIds = lectures.map(l => l.lectureId);

    const q = query(
      collection(db, 'attendance'),
      where('lectureId', 'in', lectureIds.slice(0, 10)),
      where('status', '==', 'pending'),
    );
    const unsub = onSnapshot(q, snap => {
      const counts = {};
      snap.docs.forEach(d => {
        const { lectureId } = d.data();
        counts[lectureId] = (counts[lectureId] || 0) + 1;
      });
      setPendingCounts(counts);
    });
    return unsub;
  }, [lectures]);

  const handleToggle = async (lec) => {
    setToggling(t => ({ ...t, [lec.lectureId]: true }));
    try {
      if (lec.attendanceOpen) {
        await closeAttendance(lec.lectureId);
      } else {
        await openAttendance(lec.lectureId);
      }
    } finally {
      setToggling(t => ({ ...t, [lec.lectureId]: false }));
    }
  };

  const handleModuleClick = (mod) => {
    if (mod.key === 'schedule') {
      setScheduleOpen(v => !v);
    } else if (mod.path) {
      navigate(mod.path);
    }
  };

  const totalPending = Object.values(pendingCounts).reduce((a, b) => a + b, 0);
  const openCount = lectures.filter(l => l.attendanceOpen).length;
  const firstName = userProfile?.fullName?.split(' ')[0];
  const today = new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <TeacherLayout>
      <span style={eyebrow}>TEACHER PORTAL</span>
      <h1 style={heading}>Good morning, {firstName}</h1>
      <p style={sub}>{today}</p>

      {/* Hero card */}
      <div style={heroCard}>
        <p style={heroTitle}>Today's Overview</p>
        <div style={heroStats}>
          {[
            { label: "Today's Lectures", value: lectures.length },
            { label: 'Pending Approvals', value: totalPending },
            { label: 'Open Windows', value: openCount },
          ].map(s => (
            <div key={s.label} style={heroStat}>
              <span style={heroVal}>{s.value}</span>
              <span style={heroLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Module grid */}
      <span style={sectionLabel}>MODULES</span>
      <div style={grid}>
        {MODULES.map(m => (
          <div
            key={m.key}
            style={{
              ...moduleCard,
              ...(m.key === 'schedule' && scheduleOpen ? moduleCardActive : {}),
            }}
            onClick={() => handleModuleClick(m)}
          >
            <div style={iconTile}><span style={{ fontSize: 18 }}>{m.icon}</span></div>
            <p style={moduleTitle}>{m.label}</p>
            <p style={moduleSub}>{m.desc}</p>
            {m.key === 'schedule' && lectures.length > 0 && (
              <span style={lectureBadge}>{lectures.length}</span>
            )}
          </div>
        ))}
      </div>

      {/* Expanded schedule panel */}
      {scheduleOpen && (
        <>
          <span style={sectionLabel}>TODAY'S LECTURES</span>
          <div style={lectureList}>
            {lectures.length === 0 && (
              <div style={emptyCard}>
                <p style={emptyText}>No lectures scheduled for today.</p>
              </div>
            )}
            {lectures.map(lec => {
              const sub_ = subjects[lec.subjectId];
              const pending = pendingCounts[lec.lectureId] || 0;
              const isToggling = toggling[lec.lectureId];

              return (
                <div key={lec.lectureId} style={lectureCard}>
                  <div style={lectureLeft}>
                    <div style={lectureInfo}>
                      <p style={lectureName}>{sub_?.name || lec.subjectId}</p>
                      <p style={lectureMeta}>{sub_?.courseCode} · {lec.startTime} – {lec.endTime}</p>
                    </div>
                    <div style={lectureBadges}>
                      <StatusPill status={lec.status} />
                      {pending > 0 && (
                        <span style={pendingBadge}>{pending} pending</span>
                      )}
                    </div>
                  </div>

                  <div style={lectureActions}>
                    {lec.status !== 'cancelled' && lec.status !== 'completed' && (
                      <button
                        style={lec.attendanceOpen ? closeBtn : openBtn}
                        onClick={() => handleToggle(lec)}
                        disabled={isToggling}
                      >
                        {isToggling ? '…' : lec.attendanceOpen ? 'Close Window' : 'Open Window'}
                      </button>
                    )}
                    <button
                      style={ghostBtn}
                      onClick={() => navigate(`/teacher/lectures/${lec.lectureId}`)}
                    >
                      Manage
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </TeacherLayout>
  );
}

const eyebrow = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '12px' };
const heading = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '28px', color: '#0B0D14', marginBottom: '4px' };
const sub = { fontSize: '13px', color: '#6B6760', marginBottom: '28px' };
const heroCard = { background: '#0B0D14', borderRadius: '22px', padding: '28px 32px', marginBottom: '32px' };
const heroTitle = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '16px', color: '#F5F3EF', marginBottom: '20px' };
const heroStats = { display: 'flex', gap: '40px' };
const heroStat = { display: 'flex', flexDirection: 'column' };
const heroVal = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '28px', color: '#F5F3EF' };
const heroLabel = { fontSize: '11px', color: '#9B9790', marginTop: '2px' };
const sectionLabel = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '14px' };
const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' };
const moduleCard = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '20px', padding: '22px', cursor: 'pointer', position: 'relative' };
const moduleCardActive = { border: '1px solid #0B0D14', background: '#F0EDE8' };
const iconTile = { width: 38, height: 38, borderRadius: 11, background: '#0B0D14', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' };
const moduleTitle = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '14px', color: '#0B0D14', marginBottom: '4px' };
const moduleSub = { fontSize: '11px', color: '#9B9790' };
const lectureBadge = { position: 'absolute', top: '14px', right: '14px', background: '#0B0D14', color: '#F5F3EF', borderRadius: '100px', padding: '2px 8px', fontSize: '10px', fontWeight: 600 };
const lectureList = { display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' };
const emptyCard = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '16px', padding: '40px 32px', textAlign: 'center' };
const emptyText = { color: '#9B9790', fontSize: '13px' };
const lectureCard = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '16px', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' };
const lectureLeft = { display: 'flex', flexDirection: 'column', gap: '8px' };
const lectureInfo = {};
const lectureName = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '15px', color: '#0B0D14', margin: 0 };
const lectureMeta = { fontSize: '12px', color: '#9B9790', margin: '2px 0 0' };
const lectureBadges = { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' };
const pendingBadge = { background: '#FAF0DC', color: '#3D2500', borderRadius: '100px', padding: '2px 10px', fontSize: '11px', fontWeight: 500 };
const lectureActions = { display: 'flex', gap: '8px', alignItems: 'center' };
const openBtn = { background: '#0B0D14', color: '#F5F3EF', border: 'none', borderRadius: '10px', padding: '9px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' };
const closeBtn = { background: '#F5D8D8', color: '#8A1E1E', border: 'none', borderRadius: '10px', padding: '9px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' };
const ghostBtn = { background: 'none', border: '1px solid #E5E1DA', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', color: '#6B6760', cursor: 'pointer' };