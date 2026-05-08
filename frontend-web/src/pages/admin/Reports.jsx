import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import StatusPill from '../../components/shared/StatusPill';
import { listSubjects } from '../../api/adminApi';
import apiClient from '../../api/client';

export default function ReportsPage() {
    const [subjects, setSubjects] = useState([]);
    const [selected, setSelected] = useState('');
    const [report, setReport] = useState(null);
    const [students, setStudents] = useState({});
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        listSubjects().then(r => setSubjects(r.data));
        apiClient.get('/api/admin/users', { params: { role: 'student' } }).then(r => {
            const map = {};
            r.data.forEach(u => { map[u.uid] = u; });
            setStudents(map);
        });
    }, []);

    const loadReport = async (subjectId) => {
        if (!subjectId) return;
        setLoading(true);
        setReport(null);
        try {
            const res = await apiClient.get(`/api/reports/subject/${subjectId}`);
            setReport(res.data);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = async () => {
        setExporting(true);
        try {
            const params = selected ? { subject_id: selected } : {};
            const res = await apiClient.get('/api/reports/export/csv', {
                params,
                responseType: 'blob',
            });
            const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `attendance_export_${selected || 'all'}.csv`;
            link.click();
            URL.revokeObjectURL(url);
        } finally {
            setExporting(false);
        }
    };

    const subjectMap = Object.fromEntries(subjects.map(s => [s.subjectId, s]));
    const currentSubject = selected ? subjectMap[selected] : null;

    return (
        <AdminLayout>
            <div style={pageHeader}>
                <div>
                    <span style={eyebrow}>REPORTS</span>
                    <h1 style={heading}>Attendance Reports</h1>
                </div>
                <button style={exportBtn} onClick={handleExportCSV} disabled={exporting}>
                    {exporting ? 'Exporting…' : '⬇ Export CSV'}
                </button>
            </div>

            {/* Subject picker */}
            <div style={pickerRow}>
                <select
                    style={filterSelect}
                    value={selected}
                    onChange={e => { setSelected(e.target.value); loadReport(e.target.value); }}
                >
                    <option value="">Select a subject…</option>
                    {subjects.map(s => (
                        <option key={s.subjectId} value={s.subjectId}>
                            {s.name} — {s.courseCode} ({s.semesterLabel})
                        </option>
                    ))}
                </select>
            </div>

            {loading && <p style={muted}>Loading report…</p>}

            {report && (
                <>
                    {/* Summary strip */}
                    <div style={statsStrip}>
                        {[
                            { label: 'Total Lectures', value: report.totalLectures },
                            { label: 'Students', value: report.students.length },
                            { label: 'Threshold', value: `${report.threshold}%` },
                            { label: 'Below Threshold', value: report.students.filter(s => s.belowThreshold).length },
                        ].map((s, i, arr) => (
                            <div key={s.label} style={{ ...statCell, ...(i < arr.length - 1 ? { borderRight: '1px solid #E5E1DA' } : {}) }}>
                                <span style={statVal}>{s.value}</span>
                                <span style={statLabel}>{s.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Student table */}
                    <div style={tableWrap}>
                        <table style={table}>
                            <thead>
                                <tr>
                                    {['Student', 'Reg. ID', 'Attended', 'Total', 'Percentage', 'Status'].map(h => (
                                        <th key={h} style={th}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {report.students.map(row => {
                                    const student = students[row.studentId];
                                    return (
                                        <tr key={row.studentId} style={tr}>
                                            <td style={td}>{student?.fullName || row.studentId}</td>
                                            <td style={{ ...td, color: '#9B9790' }}>{student?.roleData?.registrationId || '—'}</td>
                                            <td style={td}>{row.approved}</td>
                                            <td style={td}>{row.totalLectures}</td>
                                            <td style={td}>
                                                <span style={{
                                                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                                                    fontWeight: 700, fontSize: '14px',
                                                    color: row.belowThreshold ? '#C47018' : '#2A6E35',
                                                }}>
                                                    {row.percentage}%
                                                </span>
                                            </td>
                                            <td style={td}>
                                                {row.belowThreshold
                                                    ? <StatusPill status="pending" />
                                                    : <StatusPill status="approved" />}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {report.students.length === 0 && (
                                    <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#9B9790', padding: 32 }}>No students enrolled.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {!selected && !loading && (
                <div style={emptyCard}>
                    <p style={emptyIcon}>📊</p>
                    <p style={emptyTitle}>Select a subject to view its report</p>
                    <p style={emptyText}>You can also export all attendance records as CSV using the button above.</p>
                </div>
            )}
        </AdminLayout>
    );
}

const pageHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' };
const eyebrow = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' };
const heading = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '24px', color: '#0B0D14' };
const exportBtn = { background: '#EDE9E3', color: '#0B0D14', border: 'none', borderRadius: '12px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
const pickerRow = { marginBottom: '24px' };
const filterSelect = { background: '#EDE9E3', border: 'none', borderRadius: '12px', padding: '11px 16px', fontSize: '14px', color: '#0B0D14', outline: 'none', cursor: 'pointer', minWidth: 340 };
const statsStrip = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '18px', display: 'flex', marginBottom: '20px', overflow: 'hidden' };
const statCell = { flex: 1, padding: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center' };
const statVal = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '24px', color: '#0B0D14' };
const statLabel = { fontSize: '11px', color: '#9B9790', marginTop: '2px' };
const tableWrap = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '20px', overflow: 'auto' };
const table = { width: '100%', borderCollapse: 'collapse', minWidth: 560 };
const th = { padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9B9790', borderBottom: '1px solid #E5E1DA' };
const tr = { borderBottom: '1px solid #E5E1DA' };
const td = { padding: '14px 16px', fontSize: '13px', color: '#0B0D14', fontFamily: "'DM Sans', sans-serif" };
const emptyCard = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '20px', padding: '48px 32px', textAlign: 'center' };
const emptyIcon = { fontSize: '32px', marginBottom: '12px' };
const emptyTitle = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '16px', color: '#0B0D14', marginBottom: '6px' };
const emptyText = { fontSize: '13px', color: '#9B9790' };
const muted = { color: '#9B9790', fontSize: '13px' };