import { useEffect, useState } from 'react';
import StudentLayout from '../../components/layout/StudentLayout';
import StatusPill from '../../components/shared/StatusPill';
import { listSubjects, listMyAttendance, getAllSubjectReports, listLectures } from '../../api/studentApi';
import { useAuth } from '../../context/AuthContext';

export default function HistoryPage() {
  const { userProfile } = useAuth();
  const [mySubjects, setMySubjects]   = useState([]);
  const [subjectMap, setSubjectMap]   = useState({});
  const [lectureMap, setLectureMap]   = useState({});
  const [records, setRecords]         = useState([]);
  const [subjectStats, setSubjectStats] = useState({});
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterStatus, setFilterStatus]   = useState('all');
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    if (!userProfile?.uid) return;
    loadData();
  }, [userProfile]);

  async function loadData() {
  setLoading(true);
  try {
    const subRes = await listSubjects();
    const enrolled = subRes.data.filter(s =>
      (s.enrolledStudentIds || []).includes(userProfile.uid)
    );
    setMySubjects(enrolled);
    const sMap = Object.fromEntries(enrolled.map(s => [s.subjectId, s]));
    setSubjectMap(sMap);

    // 3 parallel calls instead of 1 + N + N
    const [attRes, statsRes, ...lectureResults] = await Promise.all([
      listMyAttendance({ student_id: userProfile.uid }),
      getAllSubjectReports(userProfile.uid),
      ...enrolled.map(s => listLectures({ subject_id: s.subjectId })),
    ]);

    setRecords(attRes.data.sort((a, b) =>
      (b.markedAt ? new Date(b.markedAt) : 0) - (a.markedAt ? new Date(a.markedAt) : 0)
    ));

    const statsMap = Object.fromEntries(statsRes.data.map(s => [s.subjectId, s]));
    setSubjectStats(statsMap);

    const allLectures = lectureResults.flatMap(r => r.data);
    setLectureMap(Object.fromEntries(allLectures.map(l => [l.lectureId, l])));
  } finally {
    setLoading(false);
  }
}

  const filtered = records.filter(r => {
    if (filterSubject !== 'all' && r.subjectId !== filterSubject) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  return (
    <StudentLayout>
      <span style={eyebrow}>ATTENDANCE HISTORY</span>
      <h1 style={heading}>History</h1>

      {/* Per-subject summary */}
      {mySubjects.length > 0 && (
        <div style={summaryGrid}>
          {mySubjects.map(s => {
            const stats = subjectStats[s.subjectId];
            const pct   = stats?.percentage ?? null;
            const below = stats?.belowThreshold;
            return (
              <div key={s.subjectId} style={{ ...summaryCard, ...(below ? summaryCardWarning : {}) }}>
                <p style={summaryCode}>{s.courseCode}</p>
                <p style={summaryName}>{s.name}</p>
                <p style={{ ...summaryPct, color: below ? '#C47018' : '#2A6E35' }}>
                  {pct !== null ? `${pct}%` : '—'}
                </p>
                <p style={summarySub}>
                  {stats ? `${stats.approved}/${stats.total} lectures` : 'No data'}
                </p>
                {below && <p style={belowTag}>Below threshold</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div style={filters}>
        <select
          value={filterSubject}
          onChange={e => setFilterSubject(e.target.value)}
          style={filterSelect}
        >
          <option value="all">All Subjects</option>
          {mySubjects.map(s => (
            <option key={s.subjectId} value={s.subjectId}>{s.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={filterSelect}
        >
          <option value="all">All Statuses</option>
          {['approved', 'pending', 'rejected', 'manual'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Records table */}
      {loading ? (
        <p style={muted}>Loading…</p>
      ) : (
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                {['Subject', 'Lecture #', 'Date', 'Time', 'Status', 'Confidence'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec, i) => {
                const sub  = subjectMap[rec.subjectId];
                const lec  = lectureMap[rec.lectureId];
                const markedAt = rec.markedAt ? new Date(rec.markedAt) : null;
                return (
                  <tr key={rec.lectureId + '_' + rec.studentId + i} style={tr}>
                    <td style={td}>
                      <p style={{ margin: 0, fontWeight: 500 }}>{sub?.name || rec.subjectId}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#9B9790' }}>{sub?.courseCode}</p>
                    </td>
                    <td style={td}>{lec?.lectureNumber || '—'}</td>
                    <td style={td}>{lec?.scheduledDate || '—'}</td>
                    <td style={td}>
                      {markedAt ? markedAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td style={td}><StatusPill status={rec.status} /></td>
                    <td style={td}>
                      {rec.irisConfidence > 0
                        ? <span style={confText}>{(rec.irisConfidence * 100).toFixed(1)}%</span>
                        : <span style={muted}>—</span>}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...td, color: '#9B9790', textAlign: 'center', padding: 32 }}>
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </StudentLayout>
  );
}

const eyebrow       = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' };
const heading       = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '24px', color: '#0B0D14', marginBottom: '20px' };
const summaryGrid   = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' };
const summaryCard   = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '16px', padding: '16px' };
const summaryCardWarning = { borderColor: '#C47018', background: '#FFFBF5' };
const summaryCode   = { fontSize: '11px', color: '#9B9790', margin: '0 0 2px' };
const summaryName   = { fontSize: '13px', fontWeight: 600, color: '#0B0D14', margin: '0 0 8px' };
const summaryPct    = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '24px', margin: 0 };
const summarySub    = { fontSize: '11px', color: '#9B9790', margin: '2px 0 0' };
const belowTag      = { fontSize: '10px', color: '#C47018', fontWeight: 600, margin: '6px 0 0' };
const filters       = { display: 'flex', gap: '12px', marginBottom: '16px' };
const filterSelect  = { background: '#EDE9E3', border: 'none', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', color: '#0B0D14', outline: 'none', cursor: 'pointer' };
const tableWrap     = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '20px', overflow: 'auto' };
const table         = { width: '100%', borderCollapse: 'collapse', minWidth: 560 };
const th            = { padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9B9790', borderBottom: '1px solid #E5E1DA' };
const tr            = { borderBottom: '1px solid #E5E1DA' };
const td            = { padding: '14px 16px', fontSize: '13px', color: '#0B0D14', fontFamily: "'DM Sans', sans-serif" };
const confText      = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '13px', color: '#0B0D14' };
const muted         = { color: '#9B9790', fontSize: '12px' };