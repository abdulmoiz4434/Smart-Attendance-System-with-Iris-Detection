import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, onSnapshot as onDocSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import TeacherLayout from '../../components/layout/TeacherLayout';
import StatusPill from '../../components/shared/StatusPill';
import Modal from '../../components/shared/Modal';
import FormField, { Select } from '../../components/shared/FormField';
import {
    openAttendance, closeAttendance, checkClose,
    approveRecord, rejectRecord, approveAll,
    manualMark, listSubjects,
} from '../../api/teacherApi';
import apiClient from '../../api/client';

export default function LectureDetail() {
    const { lectureId } = useParams();
    const { userProfile } = useAuth();
    const config = useConfig();
    const navigate = useNavigate();

    const [lecture, setLecture] = useState(null);
    const [subject, setSubject] = useState(null);
    const [attendance, setAttendance] = useState([]);
    const [students, setStudents] = useState({});   // uid → user profile
    const [enrolledStudents, setEnrolledStudents] = useState([]);
    const [toggling, setToggling] = useState(false);
    const [approvingAll, setApprovingAll] = useState(false);
    const [showManual, setShowManual] = useState(false);
    const [manualStudentId, setManualStudentId] = useState('');
    const [manualNote, setManualNote] = useState('');
    const [filter, setFilter] = useState('all');    // all | pending | approved | rejected | manual

    // Real-time lecture doc
    useEffect(() => {
        const unsub = onDocSnapshot(doc(db, 'lectures', lectureId), snap => {
            if (snap.exists()) {
                setLecture(snap.data());
                if (snap.data().attendanceOpen) checkClose(lectureId).catch(() => { });
            }
        });
        return unsub;
    }, [lectureId]);

    // Load subject and enrolled students
    useEffect(() => {
        if (!lecture) return;
        listSubjects().then(r => {
            const s = r.data.find(s => s.subjectId === lecture.subjectId);
            setSubject(s || null);
            if (s?.enrolledStudentIds?.length) {
                apiClient.get('/api/admin/users', { params: { role: 'student' } }).then(ur => {
                    const map = {};
                    ur.data.forEach(u => { map[u.uid] = u; });
                    setStudents(map);
                    setEnrolledStudents(s.enrolledStudentIds.map(uid => ({ uid, ...map[uid] })));
                });
            }
        });
    }, [lecture?.subjectId]);

    // Real-time attendance for this lecture
    useEffect(() => {
        const q = query(
            collection(db, 'attendance'),
            where('lectureId', '==', lectureId),
        );
        const unsub = onSnapshot(q, snap => {
            const data = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
            data.sort((a, b) => (b.markedAt?.seconds || 0) - (a.markedAt?.seconds || 0));
            setAttendance(data);
        });
        return unsub;
    }, [lectureId]);

    const handleToggle = async () => {
        setToggling(true);
        try {
            lecture.attendanceOpen
                ? await closeAttendance(lectureId)
                : await openAttendance(lectureId);
        } finally {
            setToggling(false);
        }
    };

    const handleApproveAll = async () => {
        setApprovingAll(true);
        try { await approveAll(lectureId); }
        finally { setApprovingAll(false); }
    };

    const handleManualMark = async () => {
        if (!manualStudentId) return;
        await manualMark({
            lectureId,
            subjectId: lecture.subjectId,
            studentId: manualStudentId,
            markedBy: userProfile.uid,
            note: manualNote,
        });
        setShowManual(false);
        setManualStudentId('');
        setManualNote('');
    };

    const filteredAttendance = filter === 'all'
        ? attendance
        : attendance.filter(a => a.status === filter);

    // Build a Set of student UIDs who have an attendance record
    const markedUids = new Set(attendance.map(a => a.studentId));
    const absentStudents = enrolledStudents.filter(s => !markedUids.has(s.uid));
    const pendingCount = attendance.filter(a => a.status === 'pending').length;

    if (!lecture) return <TeacherLayout><p style={muted}>Loading lecture…</p></TeacherLayout>;

    return (
        <TeacherLayout>
            {/* Back */}
            <button style={backBtn} onClick={() => navigate('/teacher/dashboard')}>← Dashboard</button>

            {/* Header */}
            <div style={pageHeader}>
                <div>
                    <span style={eyebrow}>LECTURE DETAIL</span>
                    <h1 style={heading}>{subject?.name || lecture.subjectId}</h1>
                    <p style={lecMeta}>
                        {subject?.courseCode} · {lecture.scheduledDate} · {lecture.startTime} – {lecture.endTime} · Lecture #{lecture.lectureNumber}
                    </p>
                </div>
                <div style={headerActions}>
                    <StatusPill status={lecture.status} />
                    {lecture.status !== 'cancelled' && lecture.status !== 'completed' && (
                        <button
                            style={lecture.attendanceOpen ? closeBtn : openBtn}
                            onClick={handleToggle}
                            disabled={toggling}
                        >
                            {toggling ? '…' : lecture.attendanceOpen ? 'Close Window' : 'Open Window'}
                        </button>
                    )}
                </div>
            </div>

            {/* Stats strip */}
            <div style={statsStrip}>
                {[
                    { label: 'Enrolled', value: enrolledStudents.length },
                    { label: 'Submitted', value: attendance.length },
                    { label: 'Pending', value: pendingCount },
                    { label: 'Approved', value: attendance.filter(a => a.status === 'approved').length },
                    { label: 'Absent', value: absentStudents.length },
                ].map((s, i, arr) => (
                    <div key={s.label} style={{ ...statCell, ...(i < arr.length - 1 ? { borderRight: '1px solid #E5E1DA' } : {}) }}>
                        <span style={statVal}>{s.value}</span>
                        <span style={statLabel}>{s.label}</span>
                    </div>
                ))}
            </div>

            {/* Action bar */}
            <div style={actionBar}>
                <div style={filterTabs}>
                    {['all', 'pending', 'approved', 'rejected', 'manual'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{ ...filterTab, ...(filter === f ? filterTabActive : {}) }}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                            {f === 'pending' && pendingCount > 0 && (
                                <span style={badge}>{pendingCount}</span>
                            )}
                        </button>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {pendingCount > 0 && (
                        <button style={approveAllBtn} onClick={handleApproveAll} disabled={approvingAll}>
                            {approvingAll ? 'Approving…' : `Approve All (${pendingCount})`}
                        </button>
                    )}
                    {config?.manualMarkingEnabled && (
                        <button style={ghostBtn} onClick={() => setShowManual(true)}>+ Manual Mark</button>
                    )}
                </div>
            </div>

            {/* Attendance records */}
            <div style={tableWrap}>
                <table style={table}>
                    <thead>
                        <tr>
                            {['Student', 'Reg. ID', 'Submitted At', 'Confidence', 'Status', 'Actions'].map(h => (
                                <th key={h} style={th}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAttendance.map(rec => {
                            const student = students[rec.studentId];
                            const markedAt = rec.markedAt?.toDate?.() || (rec.markedAt ? new Date(rec.markedAt) : null);
                            return (
                                <tr key={rec.docId} style={tr}>
                                    <td style={td}>{student?.fullName || rec.studentId}</td>
                                    <td style={{ ...td, color: '#9B9790' }}>{student?.roleData?.registrationId || '—'}</td>
                                    <td style={td}>{markedAt ? markedAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                    <td style={td}>
                                        {rec.irisConfidence > 0
                                            ? <span style={confidenceText}>{(rec.irisConfidence * 100).toFixed(1)}%</span>
                                            : <span style={{ color: '#9B9790' }}>—</span>}
                                    </td>
                                    <td style={td}><StatusPill status={rec.status} /></td>
                                    <td style={td}>
                                        {rec.status === 'pending' && (
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button style={approveBtn} onClick={() => approveRecord(rec.docId)}>Approve</button>
                                                <button style={rejectBtn} onClick={() => rejectRecord(rec.docId)}>Reject</button>
                                            </div>
                                        )}
                                        {rec.status === 'rejected' && lecture.attendanceOpen && (
                                            <span style={muted}>Awaiting retry</span>
                                        )}
                                        {rec.note && (
                                            <span style={noteText} title={rec.note}>📝 Note</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredAttendance.length === 0 && (
                            <tr><td colSpan={6} style={{ ...td, color: '#9B9790', textAlign: 'center', padding: 32 }}>
                                No {filter === 'all' ? '' : filter} records
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Absent students (only show when window is open or completed) */}
            {absentStudents.length > 0 && lecture.status !== 'cancelled' && (
                <>
                    <span style={{ ...eyebrow, marginTop: 28, marginBottom: 14, display: 'block' }}>ABSENT / NOT SUBMITTED</span>
                    <div style={absentList}>
                        {absentStudents.map(s => (
                            <div key={s.uid} style={absentRow}>
                                <div>
                                    <p style={absentName}>{s.fullName || s.uid}</p>
                                    <p style={absentReg}>{s.roleData?.registrationId || s.email}</p>
                                </div>
                                {config?.manualMarkingEnabled && (
                                    <button
                                        style={ghostBtn}
                                        onClick={() => { setManualStudentId(s.uid); setShowManual(true); }}
                                    >
                                        Mark
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Manual Mark Modal */}
            <Modal open={showManual} onClose={() => setShowManual(false)} title="Manual Attendance">
                <FormField label="Student">
                    <Select value={manualStudentId} onChange={e => setManualStudentId(e.target.value)} required>
                        <option value="">Select student</option>
                        {enrolledStudents.map(s => (
                            <option key={s.uid} value={s.uid}>
                                {s.fullName} — {s.roleData?.registrationId || s.email}
                            </option>
                        ))}
                    </Select>
                </FormField>
                <FormField label="Note (optional)">
                    <input
                        style={noteInput}
                        value={manualNote}
                        onChange={e => setManualNote(e.target.value)}
                        placeholder="Reason for manual entry"
                    />
                </FormField>
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button style={ghostBtn} onClick={() => setShowManual(false)}>Cancel</button>
                    <button style={openBtn} onClick={handleManualMark} disabled={!manualStudentId}>
                        Mark Attendance
                    </button>
                </div>
            </Modal>
        </TeacherLayout>
    );
}

const backBtn = { background: 'none', border: 'none', color: '#6B6760', fontSize: '13px', cursor: 'pointer', padding: '0 0 20px', fontFamily: "'DM Sans', sans-serif" };
const eyebrow = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase' };
const heading = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '24px', color: '#0B0D14', marginBottom: '4px' };
const lecMeta = { fontSize: '13px', color: '#6B6760' };
const pageHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: 16, flexWrap: 'wrap' };
const headerActions = { display: 'flex', gap: '10px', alignItems: 'center' };
const statsStrip = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '18px', display: 'flex', marginBottom: '24px', overflow: 'hidden' };
const statCell = { flex: 1, padding: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center' };
const statVal = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '24px', color: '#0B0D14' };
const statLabel = { fontSize: '11px', color: '#9B9790', marginTop: '2px' };
const actionBar = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: 12, flexWrap: 'wrap' };
const filterTabs = { display: 'flex', gap: '6px' };
const filterTab = { background: 'none', border: '1px solid #E5E1DA', borderRadius: '100px', padding: '6px 14px', fontSize: '12px', color: '#6B6760', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const filterTabActive = { background: '#0B0D14', color: '#F5F3EF', borderColor: '#0B0D14' };
const badge = { background: '#B03030', color: '#fff', borderRadius: '100px', padding: '0 6px', fontSize: '10px', fontWeight: 700 };
const approveAllBtn = { background: '#D4EBD8', color: '#174520', border: 'none', borderRadius: '10px', padding: '9px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' };
const tableWrap = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '20px', overflow: 'auto', marginBottom: '24px' };
const table = { width: '100%', borderCollapse: 'collapse', minWidth: 640 };
const th = { padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9B9790', borderBottom: '1px solid #E5E1DA' };
const tr = { borderBottom: '1px solid #E5E1DA' };
const td = { padding: '14px 16px', fontSize: '13px', color: '#0B0D14', fontFamily: "'DM Sans', sans-serif" };
const confidenceText = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '13px', color: '#0B0D14' };
const openBtn = { background: '#0B0D14', color: '#F5F3EF', border: 'none', borderRadius: '10px', padding: '9px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' };
const closeBtn = { background: '#F5D8D8', color: '#8A1E1E', border: 'none', borderRadius: '10px', padding: '9px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' };
const approveBtn = { background: '#D4EBD8', color: '#174520', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' };
const rejectBtn = { background: '#F5D8D8', color: '#8A1E1E', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' };
const ghostBtn = { background: 'none', border: '1px solid #E5E1DA', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', color: '#6B6760', cursor: 'pointer' };
const noteText = { fontSize: '11px', color: '#9B9790', cursor: 'help' };
const absentList = { display: 'flex', flexDirection: 'column', gap: '8px' };
const absentRow = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '12px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const absentName = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '13px', color: '#0B0D14', margin: 0 };
const absentReg = { fontSize: '12px', color: '#9B9790', margin: '2px 0 0' };
const noteInput = { width: '100%', background: '#EDE9E3', border: '1px solid transparent', borderRadius: '14px', padding: '11px 14px', fontSize: '14px', color: '#0B0D14', outline: 'none', boxSizing: 'border-box' };
const muted = { color: '#9B9790', fontSize: '12px' };