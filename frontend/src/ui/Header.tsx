import { useAuth } from '../auth/AuthProvider';

interface HeaderProps {
  userName: string;
  score: number;
}

const headerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  height: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  background: 'rgba(5, 10, 18, 0.85)',
  borderBottom: '1px solid rgba(79, 195, 247, 0.15)',
  zIndex: 20,
  backdropFilter: 'blur(8px)',
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: 'var(--ocean-surface)',
  letterSpacing: '0.5px',
};

const scoreStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 16,
  fontWeight: 700,
  color: 'var(--gold-accent)',
};

const userSectionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const logoutBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: 4,
  color: 'var(--text-primary)',
  padding: '4px 10px',
  fontSize: 12,
};

export function Header({ userName, score }: HeaderProps) {
  const { logout } = useAuth();

  return (
    <header style={headerStyle}>
      <span style={titleStyle}>Sink Board</span>
      <div style={userSectionStyle}>
        <span style={scoreStyle}>{score} pts</span>
        {userName && (
          <span style={{ fontSize: 13, color: 'var(--text-primary)', opacity: 0.8 }}>
            {userName}
          </span>
        )}
        <button onClick={logout} style={logoutBtnStyle}>
          Logout
        </button>
      </div>
    </header>
  );
}
