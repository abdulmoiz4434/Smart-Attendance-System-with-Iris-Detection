import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationBadge from '../shared/NotificationBadge';

const NAV_ITEMS = [
    { label: 'Dashboard', path: '/student/dashboard' },
    { label: 'Schedule', path: '/student/schedule' },
    { label: 'History', path: '/student/history' },
    { label: 'Notifications', path: '/student/notifications' },
];

export default function StudentLayout({ children }) {
    const { userProfile, logout } = useAuth();
    const { unreadCount } = useNotifications();
    return (
        <div style={layout}>
            <aside style={sidebar}>
                <div style={sidebarTop}>
                    <span style={eyebrow}>STUDENT PORTAL</span>
                    <div style={avatarTile}>
                        {userProfile?.fullName?.split(' ').map(w => w[0]).join('').slice(0, 2)}
                    </div>
                    <p style={nameText}>{userProfile?.fullName}</p>
                    <p style={emailText}>{userProfile?.email}</p>
                </div>
                <nav style={nav}>
                    {NAV_ITEMS.map(item => (
                        <NavLink
                            to="/student/notifications"
                            style={({ isActive }) => ({ ...navLink, ...(isActive ? navLinkActive : {}) })}
                        >
                            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                Notifications
                                <NotificationBadge count={unreadCount} />
                            </span>
                        </NavLink>
                    ))}
                </nav>
                <button onClick={logout} style={logoutBtn}>Sign Out</button>
            </aside>
            <main style={main}>{children}</main>
        </div>
    );
}

const layout = { display: 'flex', minHeight: '100vh', background: '#F5F3EF' };
const sidebar = { width: '220px', minHeight: '100vh', background: '#FAF8F4', borderRight: '1px solid #E5E1DA', padding: '32px 20px', display: 'flex', flexDirection: 'column', flexShrink: 0 };
const sidebarTop = { marginBottom: '32px' };
const eyebrow = { fontSize: '9px', fontWeight: 500, color: '#9B9790', letterSpacing: '0.14em', textTransform: 'uppercase', display: 'block', marginBottom: '16px' };
const avatarTile = { width: 48, height: 48, borderRadius: 14, background: '#0B0D14', color: '#F5F3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '19px', marginBottom: '12px' };
const nameText = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '14px', color: '#0B0D14', marginBottom: '2px' };
const emailText = { fontSize: '12px', color: '#9B9790' };
const nav = { display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 };
const navLink = { display: 'block', padding: '10px 14px', borderRadius: '12px', fontSize: '14px', color: '#6B6760', textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" };
const navLinkActive = { background: '#EDE9E3', color: '#0B0D14', fontWeight: 500 };
const main = { flex: 1, padding: '40px', overflowY: 'auto' };
const logoutBtn = { background: 'none', border: '1px solid #E5E1DA', borderRadius: '12px', padding: '10px 14px', color: '#6B6760', cursor: 'pointer', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" };