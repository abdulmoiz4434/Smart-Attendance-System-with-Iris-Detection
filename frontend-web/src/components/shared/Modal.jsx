export default function Modal({ open, onClose, title, children, width = 520 }) {
    if (!open) return null;
    return (
        <div style={overlay} onClick={onClose}>
            <div style={{ ...box, width }} onClick={e => e.stopPropagation()}>
                <div style={header}>
                    <span style={titleStyle}>{title}</span>
                    <button onClick={onClose} style={closeBtn}>✕</button>
                </div>
                <div style={{ padding: '24px' }}>{children}</div>
            </div>
        </div>
    );
}

const overlay = {
    position: 'fixed', inset: 0, background: 'rgba(11,13,20,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '20px',
};
const box = {
    background: '#FAF8F4', borderRadius: '20px',
    border: '1px solid #E5E1DA', maxHeight: '90vh',
    overflow: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
};
const header = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px 0',
};
const titleStyle = {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 600, fontSize: '16px', color: '#0B0D14',
};
const closeBtn = {
    background: 'none', border: 'none', fontSize: '16px',
    color: '#9B9790', cursor: 'pointer', padding: '4px',
};