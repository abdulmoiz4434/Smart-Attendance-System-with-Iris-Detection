import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import StatusPill from '../../components/shared/StatusPill';
import Modal from '../../components/shared/Modal';
import FormField, { Input } from '../../components/shared/FormField';
import { listLectures, createManualLecture, cancelLecture, listSubjects } from '../../api/adminApi';
import { getTodayISO } from '@smart-attendance/shared';

function isPastScheduled(lec) {
    const today = new Date().toISOString().slice(0, 10);
    return lec.status === 'scheduled' && lec.scheduledDate < today;
}

export default function LecturesPage() {
    const [subjects, setSubjects] = useState([]);
    const [panels, setPanels] = useState({});
    const [showCreate, setShowCreate] = useState(false);
    const [createSubjectId, setCreateSubjectId] = useState('');
    const [form, setForm] = useState({ scheduledDate: getTodayISO(), startTime: '09:00', endTime: '10:30' });
    const [error, setError] = useState('');

    useEffect(() => {
        listSubjects().then(r => {
            const sorted = [...r.data].sort((a, b) => a.name.localeCompare(b.name));
            setSubjects(sorted);
        });
    }, []);

    async function togglePanel(subjectId) {
        const current = panels[subjectId];

        if (current?.open) {
            setPanels(prev => ({ ...prev, [subjectId]: { ...prev[subjectId], open: false } }));
            return;
        }

        if (current?.lectures) {
            setPanels(prev => ({ ...prev, [subjectId]: { ...prev[subjectId], open: true } }));
            return;
        }

        setPanels(prev => ({ ...prev, [subjectId]: { open: true, loading: true, lectures: null, dateFilter: '' } }));
        try {
            const res = await listLectures({ subject_id: subjectId });
            const sorted = [...res.data].sort((a, b) =>
                a.scheduledDate.localeCompare(b.scheduledDate) || a.startTime.localeCompare(b.startTime)
            );
            setPanels(prev => ({ ...prev, [subjectId]: { ...prev[subjectId], loading: false, lectures: sorted } }));
        } catch {
            setPanels(prev => ({ ...prev, [subjectId]: { ...prev[subjectId], loading: false, lectures: [] } }));
        }
    }

    async function refreshPanel(subjectId) {
        setPanels(prev => ({ ...prev, [subjectId]: { ...prev[subjectId], loading: true } }));
        try {
            const res = await listLectures({ subject_id: subjectId });
            const sorted = [...res.data].sort((a, b) =>
                a.scheduledDate.localeCompare(b.scheduledDate) || a.startTime.localeCompare(b.startTime)
            );
            setPanels(prev => ({ ...prev, [subjectId]: { ...prev[subjectId], loading: false, lectures: sorted } }));
        } catch {
            setPanels(prev => ({ ...prev, [subjectId]: { ...prev[subjectId], loading: false } }));
        }
    }

    function setDateFilter(subjectId, val) {
        setPanels(prev => ({ ...prev, [subjectId]: { ...prev[subjectId], dateFilter: val } }));
    }

    const openCreateFor = (subjectId) => {
        setCreateSubjectId(subjectId);
        setForm({ scheduledDate: getTodayISO(), startTime: '09:00', endTime: '10:30' });
        setError('');
        setShowCreate(true);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        const subject = subjects.find(s => s.subjectId === createSubjectId);
        try {
            await createManualLecture({
                subjectId: createSubjectId,
                teacherId: subject?.teacherId || '',
                ...form,
            });
            setShowCreate(false);
            refreshPanel(createSubjectId);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to create lecture');
        }
    };

    const handleCancel = async (lectureId, subjectId) => {
        if (!window.confirm('Cancel this lecture?')) return;
        await cancelLecture(lectureId);
        refreshPanel(subjectId);
    };

    return (
        <AdminLayout>
            <div style={pageHeader}>
                <div>
                    <span style={eyebrow}>LECTURE MANAGEMENT</span>
                    <h1 style={heading}>Lectures</h1>
                    <p style={subheading}>Click a subject to view and manage its lectures.</p>
                </div>
            </div>

            {subjects.length === 0 && (
                <p style={muted}>No subjects found. Create a subject first.</p>
            )}

            <div style={subjectList}>
                {subjects.map(sub => {
                    const panel = panels[sub.subjectId];
                    const isOpen = panel?.open ?? false;
                    const isLoading = panel?.loading ?? false;
                    const lectures = panel?.lectures ?? [];
                    const dateFilter = panel?.dateFilter ?? '';

                    const filtered = dateFilter
                        ? lectures.filter(l => l.scheduledDate === dateFilter)
                        : lectures;

                    const today = getTodayISO();
                    const scheduledCount = lectures.filter(l => l.status === 'scheduled' && l.scheduledDate >= today).length;
                    const completedCount = lectures.filter(l => l.status === 'completed').length;
                    const ongoingCount = lectures.filter(l => l.status === 'ongoing').length;
                    const pastCount = lectures.filter(l => isPastScheduled(l)).length;

                    return (
                        <div key={sub.subjectId} style={{ ...subjectCard, ...(isOpen ? subjectCardOpen : {}) }}>
                            {/* Subject header row */}
                            <div style={subjectRow} onClick={() => togglePanel(sub.subjectId)}>
                                <div style={subjectLeft}>
                                    <div style={subjectInitials}>
                                        <span style={subjectInitialsText}>{sub.name.slice(0, 2).toUpperCase()}</span>
                                    </div>
                                    <div>
                                        <p style={subjectName}>{sub.name}</p>
                                        <p style={subjectMeta}>{sub.courseCode} · {sub.semesterLabel} · {sub.department}</p>
                                    </div>
                                </div>
                                <div style={subjectRight}>
                                    {isOpen && !isLoading && (
                                        <div style={statChips}>
                                            {scheduledCount > 0 && <span style={{ ...chip, ...chipScheduled }}>{scheduledCount} upcoming</span>}
                                            {ongoingCount > 0 && <span style={{ ...chip, ...chipOngoing }}>{ongoingCount} ongoing</span>}
                                            {completedCount > 0 && <span style={{ ...chip, ...chipCompleted }}>{completedCount} completed</span>}
                                            {pastCount > 0 && <span style={{ ...chip, ...chipPast }}>⚠ {pastCount} unrecorded</span>}
                                        </div>
                                    )}
                                    <span style={chevron}>{isOpen ? '▲' : '▼'}</span>
                                </div>
                            </div>

                            {/* Expanded panel */}
                            {isOpen && (
                                <div style={panelBody}>
                                    {/* Panel toolbar */}
                                    <div style={panelToolbar}>
                                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                            <Input
                                                type="date"
                                                value={dateFilter}
                                                onChange={e => setDateFilter(sub.subjectId, e.target.value)}
                                                style={{ width: 160 }}
                                            />
                                            {dateFilter && (
                                                <button style={ghostBtn} onClick={() => setDateFilter(sub.subjectId, '')}>
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                        <button style={primaryBtn} onClick={() => openCreateFor(sub.subjectId)}>
                                            + Manual Lecture
                                        </button>
                                    </div>

                                    {isLoading ? (
                                        <p style={muted}>Loading lectures…</p>
                                    ) : filtered.length === 0 ? (
                                        <div style={emptyPanel}>
                                            <p style={muted}>{dateFilter ? 'No lectures on this date.' : 'No lectures generated yet.'}</p>
                                        </div>
                                    ) : (
                                        <div style={tableWrap}>
                                            <table style={table}>
                                                <thead>
                                                    <tr>
                                                        {['#', 'Date', 'Time', 'Status', 'Type', 'Actions'].map(h => (
                                                            <th key={h} style={th}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filtered.map(lec => {
                                                        const past = isPastScheduled(lec);
                                                        return (
                                                            <tr key={lec.lectureId} style={{ ...tr, ...(past ? trPast : {}) }}>
                                                                <td style={{ ...td, ...(past ? tdMuted : {}) }}>{lec.lectureNumber}</td>
                                                                <td style={{ ...td, ...(past ? tdMuted : {}) }}>{lec.scheduledDate}</td>
                                                                <td style={{ ...td, ...(past ? tdMuted : {}) }}>{lec.startTime} – {lec.endTime}</td>
                                                                <td style={td}>
                                                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                                                        <StatusPill status={lec.status} />
                                                                        {past && <span style={pastBadge}>⚠ Past — No Record</span>}
                                                                    </div>
                                                                </td>
                                                                <td style={{ ...td, color: '#9B9790' }}>{lec.isManual ? 'Manual' : 'Generated'}</td>
                                                                <td style={td}>
                                                                    {lec.status === 'scheduled' && (
                                                                        <button
                                                                            style={dangerBtn}
                                                                            onClick={() => handleCancel(lec.lectureId, sub.subjectId)}
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Create Manual Lecture Modal */}
            <Modal
                open={showCreate}
                onClose={() => { setShowCreate(false); setError(''); }}
                title={`Manual Lecture — ${subjects.find(s => s.subjectId === createSubjectId)?.name || ''}`}
            >
                <form onSubmit={handleCreate}>
                    {error && <div style={errBanner}>{error}</div>}
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
const heading = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '24px', color: '#0B0D14', margin: 0 };
const subheading = { fontSize: '13px', color: '#9B9790', margin: '4px 0 0' };
const subjectList = { display: 'flex', flexDirection: 'column', gap: '12px' };
const subjectCard = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '20px', overflow: 'hidden', transition: 'border-color 0.15s' };
const subjectCardOpen = { borderColor: '#0B0D14' };
const subjectRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', cursor: 'pointer', gap: 12 };
const subjectLeft = { display: 'flex', alignItems: 'center', gap: '14px' };
const subjectInitials = { width: 40, height: 40, borderRadius: 12, background: '#0B0D14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const subjectInitialsText = { fontSize: '13px', fontWeight: 700, color: '#F5F3EF' };
const subjectName = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '15px', color: '#0B0D14', margin: 0 };
const subjectMeta = { fontSize: '12px', color: '#9B9790', margin: '2px 0 0' };
const subjectRight = { display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 };
const statChips = { display: 'flex', gap: '6px', flexWrap: 'wrap' };
const chip = { borderRadius: '100px', padding: '3px 10px', fontSize: '11px', fontWeight: 500 };
const chipScheduled = { background: '#E5E1DA', color: '#4A4845' };
const chipOngoing = { background: '#D4DCF0', color: '#0A2460' };
const chipCompleted = { background: '#D4EBD8', color: '#174520' };
const chipPast = { background: '#FDE8CC', color: '#7A3A00' };
const chevron = { fontSize: '11px', color: '#9B9790', userSelect: 'none' };
const panelBody = { borderTop: '1px solid #E5E1DA', padding: '18px 22px' };
const panelToolbar = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: 12, flexWrap: 'wrap' };
const emptyPanel = { padding: '24px 0', textAlign: 'center' };
const tableWrap = { background: '#fff', border: '1px solid #E5E1DA', borderRadius: '14px', overflow: 'hidden' };
const table = { width: '100%', borderCollapse: 'collapse' };
const th = { padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9B9790', borderBottom: '1px solid #E5E1DA' };
const tr = { borderBottom: '1px solid #E5E1DA' };
const trPast = { background: '#FAF6F0' };
const td = { padding: '12px 14px', fontSize: '13px', color: '#0B0D14' };
const tdMuted = { color: '#9B9790' };
const pastBadge = { borderRadius: '100px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, background: '#FDE8CC', color: '#7A3A00' };
const twoCol = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' };
const primaryBtn = { background: '#0B0D14', color: '#F5F3EF', border: 'none', borderRadius: '12px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
const ghostBtn = { background: 'none', border: '1px solid #E5E1DA', borderRadius: '12px', padding: '8px 16px', fontSize: '12px', color: '#6B6760', cursor: 'pointer' };
const dangerBtn = { background: '#F5D8D8', border: 'none', borderRadius: '10px', padding: '6px 14px', fontSize: '12px', color: '#8A1E1E', cursor: 'pointer' };
const errBanner = { background: '#F5D8D8', color: '#8A1E1E', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' };
const muted = { color: '#9B9790', fontSize: '13px' };