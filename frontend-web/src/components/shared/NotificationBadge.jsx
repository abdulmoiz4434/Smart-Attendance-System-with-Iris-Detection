export default function NotificationBadge({ count }) {
    if (!count || count === 0) return null;
    return (
        <span style={{
            background: '#B03030',
            color: '#fff',
            borderRadius: '100px',
            padding: '1px 7px',
            fontSize: '10px',
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
            display: 'inline-block',
            minWidth: '18px',
            textAlign: 'center',
        }}>
            {count > 99 ? '99+' : count}
        </span>
    );
}