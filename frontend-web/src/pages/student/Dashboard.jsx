import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import StudentLayout from '../../components/layout/StudentLayout';
import { listSubjects, getAllSubjectReports, listLectures } from '../../api/studentApi';
import { getTodayISO } from '@smart-attendance/shared';
import { useNavigate } from 'react-router-dom';

export default function StudentDashboard() {
  const { userProfile } = useAuth();
  const config = useConfig();
  const navigate = useNavigate();

  const [mySubjects, setMySubjects] = useState([]);
  const [subjectStats, setSubjectStats] = useState({});   // subjectId → report
  const [todayLectures, setTodayLectures] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.uid) return;
    loadAll();
  }, [userProfile]);

  async function loadAll() {
    setStatsLoading(true);
    try {
      const [subRes, statsRes, lecRes] = await Promise.all([
        listSubjects(),
        getAllSubjectReports(userProfile.uid),
        listLectures({ date: getTodayISO() }),
      ]);

      const enrolled = subRes.data.filter(s =>
        (s.enrolledStudentIds || []).includes(userProfile.uid)
      );
      setMySubjects(enrolled);

      const statsMap = Object.fromEntries((statsRes.data || []).map(s => [s.subjectId, s]));
      setSubjectStats(statsMap);

      const myLectures = lecRes.data.filter(l =>
        enrolled.some(s => s.subjectId === l.subjectId)
      );
      myLectures.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setTodayLectures(myLectures);
    } finally {
      setStatsLoading(false);
    }
  }

  // Overall attendance: average across all subjects
  const statsArr = Object.values(subjectStats);
  const overallPct = statsArr.length > 0
    ? Math.round(statsArr.reduce((sum, s) => sum + s.percentage, 0) / statsArr.length)
    : null;

  const shortageSubjects = statsArr.filter(s => s.belowThreshold);
  const threshold = config?.attendanceThreshold || 75;
  const firstName = userProfile?.fullName?.split(' ')[0];
  const today = new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' });

  const subjectMap = Object.fromEntries(mySubjects.map(s => [s.subjectId, s]));

  return (
    <StudentLayout>
      <span style={eyebrow}>STUDENT PORTAL</span>
      <h1 style={heading}>Good morning, {firstName}</h1>
      <p style={sub}>{today}</p>

      {/* Shortage warning */}
      {shortageSubjects.length > 0 && (
        <div style={warningBanner}>
          <span style={warningIcon}>⚠️</span>
          <span style={warningText}>
            You are below {threshold}% attendance in {shortageSubjects.length} subject{shortageSubjects.length > 1 ? 's' : ''}.
            {' '}<button style={warningLink} onClick={() => navigate('/student/history')}>View details</button>
          </span>
        </div>
      )}

      {/* Hero card — renders immediately, values fill in when ready */}
      <div style={heroCard}>
        <p style={heroTitle}>Attendance Overview</p>
        <div style={heroStats}>
          <div style={heroStat}>
            <span style={heroVal}>
              {statsLoading ? <span style={skeletonVal}>—</span> : (overallPct !== null ? `${overallPct}%` : '—')}
            </span>
            <span style={heroLabel}>Overall Attendance</span>
          </div>
          <div style={heroDivider} />
          <div style={heroStat}>
            <span style={heroVal}>
              {statsLoading ? <span style={skeletonVal}>—</span> : mySubjects.length}
            </span>
            <span style={heroLabel}>Enrolled Subjects</span>
          </div>
          <div style={heroDivider} />
          <div style={heroStat}>
            <span style={heroVal}>
              {statsLoading ? <span style={skeletonVal}>—</span> : shortageSubjects.length}
            </span>
            <span style={{ ...heroLabel, color: (!statsLoading && shortageSubjects.length > 0) ? '#C47018' : '#9B9790' }}>
              Shortage Alerts
            </span>
          </div>
        </div>
      </div>

      {/* Module grid */}
      <span style={sectionLabel}>QUICK ACCESS</span>
      <div style={grid}>
        <div style={{ ...moduleCard, cursor: 'default' }}>
          <div style={iconTile}>📷</div>
          <p style={moduleTitle}>Mark Attendance</p>
          <p style={moduleSub}>Use the Android app to scan your iris and mark attendance.</p>
        </div>

        <div style={moduleCard} onClick={() => navigate('/student/schedule')}>
          <div style={iconTile}>🗓️</div>
          <p style={moduleTitle}>My Schedule</p>
          <p style={moduleSub}>View weekly schedule and upcoming lectures.</p>
        </div>

        <div style={moduleCard} onClick={() => navigate('/student/history')}>
          <div style={iconTile}>📋</div>
          <p style={moduleTitle}>Attendance History</p>
          <p style={moduleSub}>View all attendance records with status and confidence.</p>
        </div>

        <div style={moduleCard} onClick={() => navigate('/student/notifications')}>
          <div style={iconTile}>🔔</div>
          <p style={moduleTitle}>Notifications</p>
          <p style={moduleSub}>View announcements and alerts from teachers and admin.</p>
        </div>
      </div>

      {/* Per-subject attendance */}
      {!statsLoading && mySubjects.length > 0 && (
        <>
          <span style={{ ...sectionLabel, marginTop: 28 }}>MY SUBJECTS</span>
          <div style={subjectList}>
            {mySubjects.map(s => {
              const stats = subjectStats[s.subjectId];
              const pct = stats?.percentage ?? null;
              const below = stats?.belowThreshold;
              return (
                <div key={s.subjectId} style={subjectRow}>
                  <div style={subjectLeft}>
                    <p style={subjectName}>{s.name}</p>
                    <p style={subjectMeta}>{s.courseCode} · {s.semesterLabel}</p>
                  </div>
                  <div style={subjectRight}>
                    {pct !== null ? (
                      <>
                        <span style={{ ...pctBadge, background: below ? '#FAF0DC' : '#D4EBD8', color: below ? '#3D2500' : '#174520' }}>
                          {pct}%
                        </span>
                        {below && <span style={shortageTag}>Below {threshold}%</span>}
                      </>
                    ) : (
                      <span style={pctBadge}>No data</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {statsLoading && (
        <div style={subjectSkeletonWrap}>
          {[1, 2, 3].map(i => <div key={i} style={subjectSkeletonRow} />)}
        </div>
      )}
    </StudentLayout>
  );
}

const eyebrow = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '12px' };
const heading = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '28px', color: '#0B0D14', marginBottom: '4px' };
const sub = { fontSize: '13px', color: '#6B6760', marginBottom: '20px' };
const warningBanner = { background: '#FAF0DC', border: '1px solid #C47018', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' };
const warningIcon = { fontSize: '16px' };
const warningText = { fontSize: '13px', color: '#3D2500' };
const warningLink = { background: 'none', border: 'none', color: '#C47018', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: '13px', textDecoration: 'underline' };
const heroCard = { background: '#0B0D14', borderRadius: '22px', padding: '28px 32px', marginBottom: '28px' };
const heroTitle = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '16px', color: '#F5F3EF', marginBottom: '20px' };
const heroStats = { display: 'flex', alignItems: 'center', gap: '0' };
const heroStat = { display: 'flex', flexDirection: 'column', flex: 1 };
const heroVal = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '28px', color: '#F5F3EF' };
const heroLabel = { fontSize: '11px', color: '#9B9790', marginTop: '2px' };
const heroDivider = { width: '1px', height: '40px', background: '#2A2E40', margin: '0 24px' };
const skeletonVal = { color: '#3A3E50', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '28px' };
const sectionLabel = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '14px' };
const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '680px', marginBottom: '0' };
const moduleCard = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '20px', padding: '22px', textDecoration: 'none', display: 'block', cursor: 'pointer' };
const iconTile = { width: 38, height: 38, borderRadius: 11, background: '#0B0D14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '14px' };
const moduleTitle = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '14px', color: '#0B0D14', marginBottom: '4px' };
const moduleSub = { fontSize: '11px', color: '#9B9790' };
const subjectList = { display: 'flex', flexDirection: 'column', gap: '10px' };
const subjectRow = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '14px', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const subjectLeft = {};
const subjectName = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '14px', color: '#0B0D14', margin: 0 };
const subjectMeta = { fontSize: '12px', color: '#9B9790', margin: '2px 0 0' };
const subjectRight = { display: 'flex', alignItems: 'center', gap: '8px' };
const pctBadge = { background: '#E5E1DA', color: '#4A4845', borderRadius: '100px', padding: '4px 12px', fontSize: '13px', fontWeight: 600 };
const shortageTag = { background: '#FAF0DC', color: '#3D2500', borderRadius: '100px', padding: '3px 10px', fontSize: '11px' };
const subjectSkeletonWrap = { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '28px' };
const subjectSkeletonRow = { background: '#EDE9E3', borderRadius: '14px', height: '56px', animation: 'pulse 1.5s ease-in-out infinite' };
const muted = { color: '#9B9790', fontSize: '13px' };