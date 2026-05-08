export default function LoadingSpinner({ message = 'Loading…' }) {
    return (
        <div style={wrap}>
            <div style={spinner} />
            <p style={text}>{message}</p>
        </div>
    );
}

const wrap = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 32px' };
const spinner = {
    width: 32, height: 32,
    border: '3px solid #E5E1DA',
    borderTop: '3px solid #0B0D14',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: 16,
};
const text = { fontSize: '13px', color: '#9B9790' };

// Add this to your global CSS (tokens.css):
// @keyframes spin { to { transform: rotate(360deg); } }