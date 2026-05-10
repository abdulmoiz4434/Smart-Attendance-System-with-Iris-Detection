import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import Modal from '../../components/shared/Modal';
import FormField, { Input, Select } from '../../components/shared/FormField';
import { listSubjects, createSubject, enrollStudents, generateLectures } from '../../api/adminApi';
import { listUsers } from '../../api/adminApi';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function defaultForm() {
    return {
        name: '', courseCode: '', semesterLabel: '', semesterStart: '',
        semesterEnd: '', teacherId: '', department: '', creditHours: 3,
        enrolledStudentIds: [], schedule: [],
    };
}

export default function SubjectsPage() {
    const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [students, setStudents] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showEnroll, setShowEnroll] = useState(null); // subject object
    const [form, setForm] = useState(defaultForm());
    const [scheduleSlot, setScheduleSlot] = useState({ day: 'Monday', startTime: '09:00', endTime: '10:30' });
    const [enrollSearch, setEnrollSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        loadSubjects();
        listUsers('teacher').then(r => setTeachers(r.data));
        listUsers('student').then(r => setStudents(r.data));
    }, []);

    async function loadSubjects() {
        const res = await listSubjects();
        setSubjects(res.data);
    }

    const addSlot = () => {
        setForm(f => ({ ...f, schedule: [...f.schedule, { ...scheduleSlot }] }));
    };
    const removeSlot = (i) => {
        setForm(f => ({ ...f, schedule: f.schedule.filter((_, idx) => idx !== i) }));
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        if (form.schedule.length === 0) { setError('Add at least one schedule slot.'); return; }
        try {
            const res = await createSubject(form);
            const subjectId = res.data.subjectId;
            await generateLectures(subjectId);
            setShowCreate(false);
            setForm(defaultForm());
            loadSubjects();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to create subject');
        }
    };

    const openEnroll = (subject) => {
        setShowEnroll(subject);
        setSelectedIds([...(subject.enrolledStudentIds || [])]);
        setEnrollSearch('');
    };

    const handleEnroll = async () => {
        await enrollStudents(showEnroll.subjectId, selectedIds);
        setShowEnroll(null);
        loadSubjects();
    };

    const filteredStudents = students.filter(s =>
        s.fullName.toLowerCase().includes(enrollSearch.toLowerCase()) ||
        (s.roleData?.registrationId || '').toLowerCase().includes(enrollSearch.toLowerCase())
    );

    const toggleStudent = (uid) => {
        setSelectedIds(ids => ids.includes(uid) ? ids.filter(i => i !== uid) : [...ids, uid]);
    };

    return (
        <AdminLayout>
            <div style={pageHeader}>
                <div>
                    <span style={eyebrow}>SUBJECT MANAGEMENT</span>
                    <h1 style={heading}>Subjects</h1>
                </div>
                <button style={primaryBtn} onClick={() => setShowCreate(true)}>+ Add Subject</button>
            </div>

            {/* Subject cards */}
            <div style={subjectGrid}>
                {subjects.map(s => (
                    <div key={s.subjectId} style={subjectCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={courseCode}>{s.courseCode}</span>
                            <span style={semLabel}>{s.semesterLabel}</span>
                        </div>
                        <p style={subjectName}>{s.name}</p>
                        <p style={subjectMeta}>{s.department} · {s.creditHours} credits</p>
                        <p style={{ ...subjectMeta, marginTop: 4 }}>
                            {(s.enrolledStudentIds || []).length} students enrolled
                        </p>
                        <div style={cardActions}>
                            <button style={ghostBtn} onClick={() => openEnroll(s)}>Manage Enrollment</button>
                        </div>
                    </div>
                ))}
                {subjects.length === 0 && <p style={muted}>No subjects yet. Create one to get started.</p>}
            </div>

            {/* Create Subject Modal */}
            <Modal open={showCreate} onClose={() => { setShowCreate(false); setError(''); }} title="Create Subject" width={600}>
                <form onSubmit={handleCreate}>
                    {error && <div style={errBanner}>{error}</div>}

                    <div style={twoCol}>
                        <FormField label="Subject Name">
                            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Data Structures" />
                        </FormField>
                        <FormField label="Course Code">
                            <Input value={form.courseCode} onChange={e => setForm({ ...form, courseCode: e.target.value })} required placeholder="CS-301" />
                        </FormField>
                    </div>

                    <div style={twoCol}>
                        <FormField label="Semester Label">
                            <Input value={form.semesterLabel} onChange={e => setForm({ ...form, semesterLabel: e.target.value })} required placeholder="Fall 2024" />
                        </FormField>
                        <FormField label="Department">
                            <Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} required placeholder="Computer Science" />
                        </FormField>
                    </div>

                    <div style={twoCol}>
                        <FormField label="Semester Start">
                            <Input type="date" value={form.semesterStart} onChange={e => setForm({ ...form, semesterStart: e.target.value })} required />
                        </FormField>
                        <FormField label="Semester End">
                            <Input type="date" value={form.semesterEnd} onChange={e => setForm({ ...form, semesterEnd: e.target.value })} required />
                        </FormField>
                    </div>

                    <div style={twoCol}>
                        <FormField label="Teacher">
                            <Select value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })} required>
                                <option value="">Select teacher</option>
                                {teachers.map(t => <option key={t.uid} value={t.uid}>{t.fullName}</option>)}
                            </Select>
                        </FormField>
                        <FormField label="Credit Hours">
                            <Input type="number" value={form.creditHours} onChange={e => setForm({ ...form, creditHours: +e.target.value })} min={1} max={6} required />
                        </FormField>
                    </div>

                    {/* Schedule builder */}
                    <p style={sectionLabel}>Weekly Schedule</p>
                    <div style={{ ...twoCol, gridTemplateColumns: '1fr 1fr 1fr auto', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}>
                        <FormField label="Day">
                            <Select value={scheduleSlot.day} onChange={e => setScheduleSlot({ ...scheduleSlot, day: e.target.value })}>
                                {DAYS.map(d => <option key={d}>{d}</option>)}
                            </Select>
                        </FormField>
                        <FormField label="Start">
                            <Input type="time" value={scheduleSlot.startTime} onChange={e => setScheduleSlot({ ...scheduleSlot, startTime: e.target.value })} />
                        </FormField>
                        <FormField label="End">
                            <Input type="time" value={scheduleSlot.endTime} onChange={e => setScheduleSlot({ ...scheduleSlot, endTime: e.target.value })} />
                        </FormField>
                        <button type="button" style={{ ...ghostBtn, marginBottom: 16 }} onClick={addSlot}>Add</button>
                    </div>

                    {form.schedule.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            {form.schedule.map((slot, i) => (
                                <div key={i} style={slotRow}>
                                    <span>{slot.day} · {slot.startTime} – {slot.endTime}</span>
                                    <button type="button" style={removeBtn} onClick={() => removeSlot(i)}>✕</button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                        <button type="button" style={ghostBtn} onClick={() => setShowCreate(false)}>Cancel</button>
                        <button type="submit" style={primaryBtn}>Create Subject</button>
                    </div>
                </form>
            </Modal>

            {/* Enroll Students Modal */}
            <Modal open={!!showEnroll} onClose={() => setShowEnroll(null)} title={`Enroll Students — ${showEnroll?.name}`} width={520}>
                <Input
                    placeholder="Search by name or registration ID…"
                    value={enrollSearch}
                    onChange={e => setEnrollSearch(e.target.value)}
                    style={{ marginBottom: 16 }}
                />
                <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #E5E1DA', borderRadius: 14 }}>
                    {filteredStudents.map(s => (
                        <label key={s.uid} style={enrollRow}>
                            <input
                                type="checkbox"
                                checked={selectedIds.includes(s.uid)}
                                onChange={() => toggleStudent(s.uid)}
                                style={{ marginRight: 10 }}
                            />
                            <div>
                                <p style={{ fontSize: 14, color: '#0B0D14', margin: 0 }}>{s.fullName}</p>
                                <p style={{ fontSize: 12, color: '#9B9790', margin: 0 }}>{s.roleData?.registrationId || s.email}</p>
                            </div>
                        </label>
                    ))}
                </div>
                <p style={{ fontSize: 12, color: '#9B9790', margin: '12px 0' }}>{selectedIds.length} selected</p>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button style={ghostBtn} onClick={() => setShowEnroll(null)}>Cancel</button>
                    <button style={primaryBtn} onClick={handleEnroll}>Save Enrollment</button>
                </div>
            </Modal>
        </AdminLayout>
    );
}

const pageHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' };
const eyebrow = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' };
const heading = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '24px', color: '#0B0D14' };
const subjectGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 };
const subjectCard = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: 20, padding: 22 };
const courseCode = { fontSize: 11, fontWeight: 500, color: '#9B9790', background: '#EDE9E3', borderRadius: 100, padding: '2px 10px' };
const semLabel = { fontSize: 11, color: '#9B9790' };
const subjectName = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 15, color: '#0B0D14', margin: '8px 0 2px' };
const subjectMeta = { fontSize: 12, color: '#6B6760' };
const cardActions = { marginTop: 16, display: 'flex', gap: 8 };
const twoCol = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' };
const sectionLabel = { fontSize: 12, fontWeight: 500, color: '#6B6760', marginBottom: 8 };
const slotRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#EDE9E3', borderRadius: 10, padding: '8px 12px', marginBottom: 6, fontSize: 13 };
const removeBtn = { background: 'none', border: 'none', color: '#9B9790', cursor: 'pointer', fontSize: 14 };
const enrollRow = { display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #E5E1DA', cursor: 'pointer' };
const primaryBtn = { background: '#0B0D14', color: '#F5F3EF', border: 'none', borderRadius: '12px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" };
const ghostBtn = { background: 'none', border: '1px solid #E5E1DA', borderRadius: '12px', padding: '8px 16px', fontSize: '12px', color: '#6B6760', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" };
const errBanner = { background: '#F5D8D8', color: '#8A1E1E', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' };
const muted = { color: '#9B9790', fontSize: '13px' };