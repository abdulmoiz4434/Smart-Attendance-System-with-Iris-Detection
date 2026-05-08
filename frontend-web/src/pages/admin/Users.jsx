import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import StatusPill from '../../components/shared/StatusPill';
import Modal from '../../components/shared/Modal';
import FormField, { Input, Select } from '../../components/shared/FormField';
import { listUsers, createUser, updateUser, deactivateUser, resetIris } from '../../api/adminApi';
import { useAuth } from '../../context/AuthContext';

const ROLES = ['student', 'teacher', 'admin'];

export default function UsersPage() {
    const { userProfile } = useAuth();
    const [users, setUsers] = useState([]);
    const [filter, setFilter] = useState('all');
    const [showCreate, setShowCreate] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [form, setForm] = useState(defaultForm());

    useEffect(() => { loadUsers(); }, [filter]);

    async function loadUsers() {
        setLoading(true);
        const res = await listUsers(filter === 'all' ? null : filter);
        setUsers(res.data);
        setLoading(false);
    }

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await createUser({ ...form, createdBy: userProfile.uid });
            setShowCreate(false);
            setForm(defaultForm());
            loadUsers();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to create user');
        }
    };

    const handleDeactivate = async (uid) => {
        if (!window.confirm('Deactivate this user?')) return;
        await deactivateUser(uid);
        loadUsers();
    };

    const handleResetIris = async (uid) => {
        if (!window.confirm('Reset iris enrollment for this student?')) return;
        await resetIris(uid);
        alert('Iris reset. Student must re-enroll on next login.');
    };

    const filtered = filter === 'all' ? users : users.filter(u => u.role === filter);

    return (
        <AdminLayout>
            <div style={pageHeader}>
                <div>
                    <span style={eyebrow}>USER MANAGEMENT</span>
                    <h1 style={heading}>Users</h1>
                </div>
                <button style={primaryBtn} onClick={() => setShowCreate(true)}>+ Add User</button>
            </div>

            {/* Role filter tabs */}
            <div style={tabs}>
                {['all', ...ROLES].map(r => (
                    <button
                        key={r}
                        onClick={() => setFilter(r)}
                        style={{ ...tab, ...(filter === r ? tabActive : {}) }}
                    >
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                ))}
            </div>

            {/* Table */}
            {loading ? <p style={muted}>Loading...</p> : (
                <div style={tableWrap}>
                    <table style={table}>
                        <thead>
                            <tr>
                                {['Name', 'Email', 'Role', 'Status', 'CNIC', 'Actions'].map(h => (
                                    <th key={h} style={th}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(user => (
                                <tr key={user.uid} style={tr}>
                                    <td style={td}>{user.fullName}</td>
                                    <td style={td}>{user.email}</td>
                                    <td style={td}><StatusPill status={user.role} /></td>
                                    <td style={td}><StatusPill status={user.status} /></td>
                                    <td style={td}>{user.cnic}</td>
                                    <td style={td}>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {user.status === 'active' && (
                                                <button style={dangerBtn} onClick={() => handleDeactivate(user.uid)}>
                                                    Deactivate
                                                </button>
                                            )}
                                            {user.role === 'student' && (
                                                <button style={ghostBtn} onClick={() => handleResetIris(user.uid)}>
                                                    Reset Iris
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={6} style={{ ...td, color: '#9B9790', textAlign: 'center', padding: 32 }}>No users found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create User Modal */}
            <Modal open={showCreate} onClose={() => { setShowCreate(false); setError(''); }} title="Create New User" width={560}>
                <form onSubmit={handleCreate}>
                    {error && <div style={errBanner}>{error}</div>}

                    <div style={twoCol}>
                        <FormField label="Full Name">
                            <Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required placeholder="Muhammad Ali" />
                        </FormField>
                        <FormField label="Role">
                            <Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </Select>
                        </FormField>
                    </div>

                    <FormField label="Email">
                        <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="user@example.com" />
                    </FormField>

                    <FormField label="Temporary Password">
                        <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required placeholder="Min 8 characters" minLength={8} />
                    </FormField>

                    <div style={twoCol}>
                        <FormField label="CNIC (13 digits, no dashes)">
                            <Input value={form.cnic} onChange={e => setForm({ ...form, cnic: e.target.value })} required placeholder="3310012345678" maxLength={13} />
                        </FormField>
                        <FormField label="Date of Birth">
                            <Input type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} required />
                        </FormField>
                    </div>

                    <FormField label="Phone (optional)">
                        <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="03001234567" />
                    </FormField>

                    {/* Student-specific */}
                    {form.role === 'student' && <>
                        <div style={twoCol}>
                            <FormField label="Registration ID">
                                <Input value={form.registrationId} onChange={e => setForm({ ...form, registrationId: e.target.value })} required placeholder="BS-CS-F24-045" />
                            </FormField>
                            <FormField label="Program">
                                <Input value={form.program} onChange={e => setForm({ ...form, program: e.target.value })} required placeholder="BS Computer Science" />
                            </FormField>
                        </div>
                        <FormField label="Father's Name">
                            <Input value={form.fatherName} onChange={e => setForm({ ...form, fatherName: e.target.value })} placeholder="Muhammad Akram" />
                        </FormField>
                    </>}

                    {/* Teacher-specific */}
                    {form.role === 'teacher' && <>
                        <div style={twoCol}>
                            <FormField label="Employee ID">
                                <Input value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} required placeholder="EMP-001" />
                            </FormField>
                            <FormField label="Department">
                                <Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} required placeholder="Computer Science" />
                            </FormField>
                        </div>
                    </>}

                    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                        <button type="button" style={ghostBtn} onClick={() => setShowCreate(false)}>Cancel</button>
                        <button type="submit" style={primaryBtn}>Create User</button>
                    </div>
                </form>
            </Modal>
        </AdminLayout>
    );
}

function defaultForm() {
    return { fullName: '', email: '', password: '', role: 'student', cnic: '', dateOfBirth: '', phone: '', registrationId: '', program: '', fatherName: '', employeeId: '', department: '' };
}

const pageHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' };
const eyebrow = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' };
const heading = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '24px', color: '#0B0D14' };
const tabs = { display: 'flex', gap: '8px', marginBottom: '20px' };
const tab = { background: 'none', border: '1px solid #E5E1DA', borderRadius: '100px', padding: '6px 16px', fontSize: '13px', color: '#6B6760', cursor: 'pointer' };
const tabActive = { background: '#0B0D14', color: '#F5F3EF', borderColor: '#0B0D14' };
const tableWrap = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '20px', overflow: 'hidden' };
const table = { width: '100%', borderCollapse: 'collapse' };
const th = { padding: '14px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 500, color: '#9B9790', borderBottom: '1px solid #E5E1DA', fontFamily: "'DM Sans', sans-serif" };
const tr = { borderBottom: '1px solid #E5E1DA' };
const td = { padding: '14px 16px', fontSize: '13px', color: '#0B0D14', fontFamily: "'DM Sans', sans-serif" };
const primaryBtn = { background: '#0B0D14', color: '#F5F3EF', border: 'none', borderRadius: '12px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" };
const ghostBtn = { background: 'none', border: '1px solid #E5E1DA', borderRadius: '12px', padding: '8px 16px', fontSize: '12px', color: '#6B6760', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" };
const dangerBtn = { background: '#F5D8D8', border: 'none', borderRadius: '12px', padding: '8px 16px', fontSize: '12px', color: '#8A1E1E', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" };
const twoCol = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' };
const errBanner = { background: '#F5D8D8', color: '#8A1E1E', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' };
const muted = { color: '#9B9790', fontSize: '13px' };