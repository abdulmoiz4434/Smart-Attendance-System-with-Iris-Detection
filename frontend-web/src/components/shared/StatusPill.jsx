const STATUS_STYLES = {
    scheduled: { bg: '#E5E1DA', color: '#4A4845' },
    ongoing: { bg: '#D4DCF0', color: '#0A2460' },
    completed: { bg: '#D4EBD8', color: '#174520' },
    cancelled: { bg: '#F5D8D8', color: '#8A1E1E' },
    pending: { bg: '#FAF0DC', color: '#3D2500' },
    approved: { bg: '#D4EBD8', color: '#174520' },
    rejected: { bg: '#F5D8D8', color: '#8A1E1E' },
    manual: { bg: '#EDE0F5', color: '#4A1E6B' },
    active: { bg: '#D4EBD8', color: '#174520' },
    inactive: { bg: '#F5D8D8', color: '#8A1E1E' },
};

export default function StatusPill({ status }) {
    const style = STATUS_STYLES[status] || { bg: '#E5E1DA', color: '#4A4845' };
    return (
        <span style={{
            background: style.bg,
            color: style.color,
            borderRadius: '100px',
            padding: '3px 10px',
            fontSize: '11px',
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
            display: 'inline-block',
            textTransform: 'capitalize',
        }}>
            {status}
        </span>
    );
}