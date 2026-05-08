export default function FormField({ label, error, children }) {
    return (
        <div style={{ marginBottom: '16px' }}>
            {label && <label style={labelStyle}>{label}</label>}
            {children}
            {error && <p style={errorStyle}>{error}</p>}
        </div>
    );
}

export function Input({ style, ...props }) {
    return (
        <input
            style={{ ...inputStyle, ...style }}
            {...props}
        />
    );
}

export function Select({ children, style, ...props }) {
    return (
        <select style={{ ...inputStyle, ...style }} {...props}>
            {children}
        </select>
    );
}

const labelStyle = {
    display: 'block', fontSize: '12px', fontWeight: 500,
    color: '#6B6760', marginBottom: '6px',
    fontFamily: "'DM Sans', sans-serif",
};
const inputStyle = {
    width: '100%', background: '#EDE9E3', border: '1px solid transparent',
    borderRadius: '14px', padding: '11px 14px', fontSize: '14px',
    color: '#0B0D14', outline: 'none', fontFamily: "'DM Sans', sans-serif",
    boxSizing: 'border-box',
};
const errorStyle = {
    color: '#B03030', fontSize: '12px', marginTop: '4px',
};