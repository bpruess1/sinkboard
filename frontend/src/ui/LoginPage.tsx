import { useAuth } from '../auth/AuthProvider';

const pageStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(180deg, #0D2137 0%, #050A12 100%)',
};

const cardStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '48px 40px',
  background: 'rgba(13, 33, 55, 0.8)',
  border: '1px solid rgba(79, 195, 247, 0.15)',
  borderRadius: 16,
  backdropFilter: 'blur(12px)',
  maxWidth: 380,
  width: '90%',
};

const titleStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: 'var(--ocean-surface)',
  margin: '0 0 8px',
};

const taglineStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text-primary)',
  opacity: 0.6,
  margin: '0 0 36px',
};

const buttonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  padding: '12px 28px',
  background: 'var(--ocean-shallow)',
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: '0.3px',
  boxShadow: '0 4px 16px rgba(2, 136, 209, 0.3)',
};

export function LoginPage() {
  const { login } = useAuth();

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Sink Board</h1>
        <p style={taglineStyle}>Keep your treasures afloat</p>
        <button onClick={login} style={buttonStyle}>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
