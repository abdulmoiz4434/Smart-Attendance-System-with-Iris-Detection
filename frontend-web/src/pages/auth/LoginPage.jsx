import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import '../../styles/tokens.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userProfile } = useAuth();

  // Already logged in — redirect
  if (userProfile) {
    const routes = { admin: '/admin/dashboard', teacher: '/teacher/dashboard', student: '/student/dashboard' };
    navigate(routes[userProfile.role] || '/');
  }

  const inactiveReason = searchParams.get('reason') === 'inactive';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // AuthContext onAuthStateChanged will fire, verify token, and set userProfile
      // Navigation happens from RootRedirect once profile is loaded
    } catch (err) {
      setError(getFirebaseErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { setError('Enter your email first.'); return; }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError('');
    } catch {
      setError('Could not send reset email. Check the address and try again.');
    }
  };

  return (
    <div style={styles.screen}>
      <div style={styles.card}>
        {/* Eyebrow */}
        <span style={styles.eyebrow}>SMART ATTENDANCE</span>

        <h1 style={styles.heading}>Welcome back</h1>
        <p style={styles.sub}>Sign in to your account</p>

        {inactiveReason && (
          <div style={styles.errorBanner}>Your account has been deactivated. Contact your admin.</div>
        )}
        {error && <div style={styles.errorBanner}>{error}</div>}
        {resetSent && <div style={styles.successBanner}>Reset email sent! Check your inbox.</div>}

        <form onSubmit={handleLogin} style={styles.form}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />

          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <button
            type="button"
            onClick={handleForgotPassword}
            style={styles.forgotBtn}
          >
            Forgot password?
          </button>

          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

function getFirebaseErrorMessage(code) {
  const map = {
    'auth/user-not-found': 'No account with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/invalid-credential': 'Invalid credentials.',
  };
  return map[code] || 'Sign-in failed. Please try again.';
}

const styles = {
  screen: {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--surface-variant)',
    borderRadius: 'var(--radius-card)',
    padding: '40px 36px',
    width: '100%',
    maxWidth: '420px',
  },
  eyebrow: {
    display: 'inline-block',
    background: 'var(--surface)',
    borderRadius: '100px',
    padding: '4px 12px',
    fontSize: '9px',
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 500,
    letterSpacing: '0.14em',
    color: 'var(--text-muted)',
    marginBottom: '20px',
    textTransform: 'uppercase',
  },
  heading: {
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontWeight: 600,
    fontSize: '28px',
    color: 'var(--text-primary)',
    marginBottom: '6px',
  },
  sub: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginBottom: '28px',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: '2px',
    marginTop: '10px',
  },
  input: {
    background: 'var(--surface)',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-input)',
    padding: '12px 14px',
    fontSize: '14px',
    color: 'var(--text-primary)',
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'border-color 0.15s',
  },
  forgotBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '12px',
    cursor: 'pointer',
    alignSelf: 'flex-end',
    marginTop: '4px',
    padding: 0,
  },
  submitBtn: {
    marginTop: '20px',
    background: 'var(--text-primary)',
    color: 'var(--text-on-dark)',
    border: 'none',
    borderRadius: 'var(--radius-input)',
    padding: '14px',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    cursor: 'pointer',
  },
  errorBanner: {
    background: '#F5D8D8',
    color: '#8A1E1E',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    marginBottom: '16px',
  },
  successBanner: {
    background: '#D4EBD8',
    color: '#174520',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '13px',
    marginBottom: '16px',
  },
};