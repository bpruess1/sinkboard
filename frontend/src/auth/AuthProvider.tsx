import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { User } from '@sink-board/shared';
import { cognitoConfig } from './cognito-config';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  getIdToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseJwtPayload(token: string): Record<string, unknown> {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(json) as Record<string, unknown>;
}

/**
 * Auth callback page component for /auth/callback route.
 * Extracts the authorization code from the URL, exchanges it for tokens
 * via the Cognito token endpoint, and dispatches a custom event with the
 * ID token so AuthProviderWithCallback can pick it up.
 */
export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasExchanged = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code || hasExchanged.current) return;
    hasExchanged.current = true;

    const exchangeCode = async () => {
      try {
        const body = new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: cognitoConfig.redirectUri,
          client_id: cognitoConfig.clientId,
        });

        const response = await fetch(`${cognitoConfig.domain}/oauth2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });

        if (!response.ok) {
          throw new Error('Token exchange failed');
        }

        const data = (await response.json()) as {
          id_token: string;
          access_token: string;
          refresh_token?: string;
        };

        window.dispatchEvent(
          new CustomEvent('auth-tokens', { detail: { idToken: data.id_token } })
        );
        navigate('/', { replace: true });
      } catch (err) {
        console.error('Auth callback error:', err);
        navigate('/login', { replace: true });
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: 'var(--text-primary)',
        background: 'var(--ocean-abyss)',
        fontSize: '1.1rem',
      }}
    >
      Signing in...
    </div>
  );
}

/**
 * Main auth provider. Listens for the 'auth-tokens' custom event
 * dispatched by AuthCallback to store tokens in memory.
 */
export function AuthProviderWithCallback({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const idTokenRef = useRef<string | null>(null);

  const setTokens = useCallback((idToken: string) => {
    idTokenRef.current = idToken;
    const payload = parseJwtPayload(idToken);
    setUser({
      userId: payload.sub as string,
      email: payload.email as string,
      displayName: (payload.name as string) || (payload.email as string),
      score: 0,
      createdAt: new Date().toISOString(),
    });
    setIsAuthenticated(true);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ idToken: string }>).detail;
      setTokens(detail.idToken);
    };
    window.addEventListener('auth-tokens', handler);
    return () => window.removeEventListener('auth-tokens', handler);
  }, [setTokens]);

  const login = useCallback(() => {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: cognitoConfig.clientId,
      redirect_uri: cognitoConfig.redirectUri,
      scope: 'openid email profile',
    });
    window.location.href = `${cognitoConfig.domain}/oauth2/authorize?${params.toString()}`;
  }, []);

  const logout = useCallback(() => {
    idTokenRef.current = null;
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const getIdToken = useCallback(() => {
    return idTokenRef.current;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isLoading, login, logout, getIdToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
