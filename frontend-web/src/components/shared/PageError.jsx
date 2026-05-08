export default function PageError({ message, onRetry }) {
    return (
        <div style={wrap}>
            <p style={icon}>⚠️</p>
            <p style={title}>Something went wrong</p>
            <p style={body}>{message || 'An unexpected error occurred.'}</p>
            {onRetry && (
                <button style={retryBtn} onClick={onRetry}>Try Again</button>
            )}
        </div>
    );
}

const wrap = { background: '#FAF8F4', border: '1px solid #E5E1DA', borderRadius: '20px', padding: '48px 32px', textAlign: 'center', maxWidth: 400, margin: '40px auto' };
const icon = { fontSize: '28px', marginBottom: '12px' };
const title = { fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '16px', color: '#0B0D14', marginBottom: '6px' };
const body = { fontSize: '13px', color: '#6B6760', marginBottom: '20px' };
const retryBtn = { background: '#0B0D14', color: '#F5F3EF', border: 'none', borderRadius: '12px', padding: '10px 24px', fontSize: '13px', cursor: 'pointer' };