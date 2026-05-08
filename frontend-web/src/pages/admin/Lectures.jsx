import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import StatusPill from '../../components/shared/StatusPill';
import Modal from '../../components/shared/Modal';
import FormField, { Input, Select } from '../../components/shared/FormField';
import { listLectures, createManualLecture, cancelLecture } from '../../api/adminApi';
import { listSubjects } from '../../api/adminApi';
import { getTodayISO } from '@smart-attendance/shared';

export default function LecturesPage() {
    const [lectures, setLectures] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [filterSubject, setFilterSubject] = useState('');
    const [filterDate, setFilterDate] = useState(getTodayISO());
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ subjectId: '', scheduledDate: '', startTime: '09:00', endTime: '10:30' });
    const [error, setError] = useState('');

    useEffect(() => {
        listSubjects().then(r => setSubjects(r.data));
    }, []);

    useEffect(() => { loadLectures(); }, [filterSubject, filterDate]);

    async function loadLectures() {
        const params = {};
        if (filterSubject) params.subject_id = filterSubject;
        if (filterDate) params.date = filterDate;
        const res = await listLectures(params);
        // Sort by date
        res.data.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.startTime.localeCompare(b.startTime));
        setLectures(res.data);
    }

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const subject = subjects.find(s => s.subjectId === form.subjectId);
            await createManualLecture({ ...form, teacherId: subject?.teacherId || '' });
            setShowCreate(false);
            setForm({ subjectId: '', scheduledDate: '', startTime: '09:00', endTime: '10:30' });
            loadLectures();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to create lecture');
        }
    };

    const handleCancel = async (id) => {
        if (!window.confirm('Cancel this lecture?')) return;
        await cancelLecture(id);
        loadLectures();
    };

    const subjectMap = Object.fromEntries(subjects.map(s => [s.subjectId, s]));

    return (
        <AdminLayout>
            <div style={pageHeader}>
                <div>
                    <span style={eyebrow}>LECTURE MANAGEMENT</span>
                    <h1 style={heading}>Lectures</h1>
                </div>
                <button style={primaryBtn} onClick={() => setShowCreate(true)}>+ Manual Lecture</button>
            </div>

            {/* Filters */}
            <div style={filters}>
                <Select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={{ width: 220 }}>
                    <option value="">All Subjects</option>
                    {subjects.map(s => <option key={s.subjectId} value={s.subjectId}>{s.name} ({s.courseCode})</option>)}
                </Select>
                <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ width: 180 }} />
                <button style={ghostBtn} onClick={() => setFilterDate('')}>Clear Date</button>
            </div>

            {/* Table */}
            <div style={tableWrap}>
                <table style={table}>
                    <thead>
                        <tr>
                            {['#', 'Subject', 'Date', 'Time', 'Status', 'Type', 'Actions'].map(h => (
                                <th key={h} style={th}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {lectures.map(lec => {
                            const sub = subjectMap[lec.subjectId];
                            return (
                                <tr key={lec.lectureId} style={tr}>
                                    <td style={td}>{lec.lectureNumber}</td>
                                    <td style={td}>
                                        <p style={{ margin: 0, fontWeight: 500 }}>{sub?.name || lec.subjectId}</p>
                                        <p style={{ margin: 0, fontSize: 11, color: '#9B9790' }}>{sub?.courseCode}</p>
                                    </td>
                                    <td style={td}>{lec.scheduledDate}</td>
                                    <td style={td}>{lec.startTime} – {lec.endTime}</td>
                                    <td style={td}><StatusPill status={lec.status} /></td>
                                    <td style={td}>{lec.isManual ? 'Manual' : 'Generated'}</td>
                                    <td style={td}>
                                        {lec.status === 'scheduled' && (
                                            <button style={dangerBtn} onClick={() => handleCancel(lec.lectureId)}>Cancel</button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {lectures.length === 0 && (
                            <tr><td colSpan={7} style={{ ...td, color: '#9B9790', textAlign: 'center', padding: 32 }}>No lectures found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Manual Lecture Modal */}
            <Modal open={showCreate} onClose={() => { setShowCreate(false); setError(''); }} title="Add Manual Lecture">
                <form onSubmit={handleCreate}>
                    {error && <div style={errBanner}>{error}</div>}
                    <FormField label="Subject">
                        <Select value={form.subjectId} onChange={e => setForm({ ...form, subjectId: e.target.value })} required>
                            <option value="">Select subject</option>
                            {subjects.map(s => <option key={s.subjectId} value={s.subjectId}>{s.name} ({s.courseCode})</option>)}
                        </Select>
                    </FormField>
                    <FormField label="Date">
                        <Input type="date" value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} required />
                    </FormField>
                    <div style={twoCol}>
                        <FormField label="Start Time">
                            <Input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} required />
                        </FormField>
                        <FormField label="End Time">
                            <Input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} required />
                        </FormField>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                        <button type="button" style={ghostBtn} onClick={() => setShowCreate(false)}>Cancel</button>
                        <button type="submit" style={primaryBtn}>Create Lecture</button>
                    </div>
                </form>
            </Modal>
        </AdminLayout>
    );
}

const pageHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' };
const eyebrow = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' };
const heading = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '24px', color: '#0B0D14' };
const filters = { display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' };
const tableWrap = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '20px', overflow: 'hidden' };
const table = { width: '100%', borderCollapse: 'collapse' };
const th = { padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9B9790', borderBottom: '1px solid #E5E1DA' };
const tr = { borderBottom: '1px solid #E5E1DA' };
const td = { padding: '14px 16px', fontSize: '13px', color: '#0B0D14' };
const twoCol = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' };
const primaryBtn = { background: '#0B0D14', color: '#F5F3EF', border: 'none', borderRadius: '12px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
const ghostBtn = { background: 'none', border: '1px solid #E5E1DA', borderRadius: '12px', padding: '8px 16px', fontSize: '12px', color: '#6B6760', cursor: 'pointer' };
const dangerBtn = { background: '#F5D8D8', border: 'none', borderRadius: '12px', padding: '8px 16px', fontSize: '12px', color: '#8A1E1E', cursor: 'pointer' };
const errBanner = { background: '#F5D8D8', color: '#8A1E1E', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' };