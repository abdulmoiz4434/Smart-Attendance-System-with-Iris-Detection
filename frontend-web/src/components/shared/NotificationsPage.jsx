import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationBadge from '../../components/shared/NotificationBadge';
import apiClient from '../../api/client';

// Role-specific compose form (admin and teacher only)
function ComposeForm({ onSent }) {
    const { userProfile } = useAuth();
    const [form, setForm] = useState({
        title: '', body: '', targetType: 'all', targetValue: '',
    });
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    const handleSend = async (e) => {
        e.preventDefault();
        setError('');
        if (form.targetType !== 'all' && !form.targetValue.trim()) {
            setError('Target value is required for this target type.');
            return;
        }
        setSending(true);
        try {
            await apiClient.post('/api/notifications', {
                ...form,
                createdBy: userProfile.uid,
            });
            setForm({ title: '', body: '', targetType: 'all', targetValue: '' });
            onSent?.();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to send notification');
        } finally {
            setSending(false);
        }
    };

    return (
        <div style={composeCard}>
            <p style={composeTitle}>Send Notification</p>
            {error && <div style={errBanner}>{error}</div>}
            <form onSubmit={handleSend}>
                <div style={twoCol}>
                    <div>
                        <label style={label}>Title</label>
                        <input
                            style={input} required
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                            placeholder="Notification title"
                        />
                    </div>
                    <div>
                        <label style={label}>Target</label>
                        <select
                            style={input}
                            value={form.targetType}
                            onChange={e => setForm({ ...form, targetType: e.target.value, targetValue: '' })}
                        >
                            <option value="all">Everyone</option>
                            <option value="role">By Role</option>
                            <option value="individual">Individual (UID)</option>
                        </select>
                    </div>
                </div>

                {form.targetType === 'role' && (
                    <div style={{ marginBottom: 12 }}>
                        <label style={label}>Role</label>
                        <select style={input} value={form.targetValue} onChange={e => setForm({ ...form, targetValue: e.target.value })}>
                            <option value="">Select role</option>
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                )}

                {form.targetType === 'individual' && (
                    <div style={{ marginBottom: 12 }}>
                        <label style={label}>User UID</label>
                        <input
                            style={input}
                            value={form.targetValue}
                            onChange={e => setForm({ ...form, targetValue: e.target.value })}
                            placeholder="Firebase UID"
                        />
                    </div>
                )}

                <div style={{ marginBottom: 12 }}>
                    <label style={label}>Message</label>
                    <textarea
                        style={{ ...input, minHeight: 80, resize: 'vertical' }}
                        required
                        value={form.body}
                        onChange={e => setForm({ ...form, body: e.target.value })}
                        placeholder="Write your message…"
                    />
                </div>

                <button type="submit" style={sendBtn} disabled={sending}>
                    {sending ? 'Sending…' : 'Send Notification'}
                </button>
            </form>
        </div>
    );
}

export default function NotificationsPage({ Layout }) {
    const { userProfile } = useAuth();
    const { notifications, unreadCount } = useNotifications();
    const canCompose = ['admin', 'teacher'].includes(userProfile?.role);

    const markRead = async (id) => {
        await apiClient.patch(`/api/notifications/${id}/read`);
    };

    const markAllRead = async () => {
        await apiClient.patch('/api/notifications/read-all');
    };

    return (
        <Layout>
            <div style={pageHeader}>
                <div>
                    <span style={eyebrow}>NOTIFICATIONS</span>
                    <h1 style={heading}>
                        Notifications {unreadCount > 0 && <NotificationBadge count={unreadCount} />}
                    </h1>
                </div>
                {unreadCount > 0 && (
                    <button style={ghostBtn} onClick={markAllRead}>Mark all read</button>
                )}
            </div>

            {canCompose && <ComposeForm onSent={() => {}} />}

            <div style={list}>
                {notifications.length === 0 && (
                    <div style={emptyCard}>
                        <p style={emptyIcon}>🔔</p>
                        <p style={emptyTitle}>No notifications yet</p>
                        <p style={emptyText}>You'll see announcements and alerts here.</p>
                    </div>
                )}
                {notifications.map(n => {
                    const isUnread = !(n.readBy || []).includes(userProfile?.uid);
                    const createdAt = n.createdAt?.toDate?.()
                        || (n.createdAt ? new Date(n.createdAt) : null);
                    return (
                        <div
                            key={n.id}
                            style={{ ...notifCard, ...(isUnread ? notifCardUnread : {}) }}
                            onClick={() => isUnread && markRead(n.id)}
                        >
                            {isUnread && <div style={unreadDot} />}
                            <div style={notifContent}>
                                <p style={notifTitle}>{n.title}</p>
                                <p style={notifBody}>{n.body}</p>
                                <div style={notifMeta}>
                                    <span style={notifTag}>{n.targetType}</span>
                                    {createdAt && (
                                        <span style={notifTime}>
                                            {createdAt.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                                            {' · '}
                                            {createdAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Layout>
    );
}

const pageHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' };
const eyebrow = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' };
const heading = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '24px', color: '#0B0D14', display: 'flex', alignItems: 'center', gap: 10 };
const composeCard = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '20px', padding: '24px', marginBottom: '24px' };
const composeTitle = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '15px', color: '#0B0D14', marginBottom: '16px' };
const twoCol = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' };
const label = { display: 'block', fontSize: '12px', fontWeight: 500, color: '#6B6760', marginBottom: '6px' };
const input = { width: '100%', background: '#EDE9E3', border: '1px solid transparent', borderRadius: '14px', padding: '11px 14px', fontSize: '14px', color: '#0B0D14', outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' };
const sendBtn = { background: '#0B0D14', color: '#F5F3EF', border: 'none', borderRadius: '12px', padding: '11px 22px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' };
const ghostBtn = { background: 'none', border: '1px solid #E5E1DA', borderRadius: '12px', padding: '9px 18px', fontSize: '13px', color: '#6B6760', cursor: 'pointer' };
const errBanner = { background: '#F5D8D8', color: '#8A1E1E', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' };
const list = { display: 'flex', flexDirection: 'column', gap: '10px' };
const emptyCard = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '20px', padding: '48px 32px', textAlign: 'center' };
const emptyIcon = { fontSize: '32px', marginBottom: '12px' };
const emptyTitle = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '16px', color: '#0B0D14', marginBottom: '6px' };
const emptyText = { fontSize: '13px', color: '#9B9790' };
const notifCard = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '16px', padding: '16px 20px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'flex-start', transition: 'border-color 0.15s' };
const notifCardUnread = { borderColor: '#0B0D14' };
const unreadDot = { width: 8, height: 8, borderRadius: '50%', background: '#0B0D14', marginTop: 6, flexShrink: 0 };
const notifContent = { flex: 1 };
const notifTitle = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '14px', color: '#0B0D14', margin: '0 0 4px' };
const notifBody = { fontSize: '13px', color: '#6B6760', margin: '0 0 8px', lineHeight: 1.5 };
const notifMeta = { display: 'flex', gap: '10px', alignItems: 'center' };
const notifTag = { background: '#EDE9E3', color: '#6B6760', borderRadius: '100px', padding: '2px 8px', fontSize: '10px', fontWeight: 500, textTransform: 'capitalize' };
const notifTime = { fontSize: '11px', color: '#9B9790' };