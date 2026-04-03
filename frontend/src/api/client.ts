import { cognitoConfig } from '../auth/cognito-config';

type GetIdToken = () => string | null;
type OnUnauthorized = () => void;

let _getIdToken: GetIdToken = () => null;
let _onUnauthorized: OnUnauthorized = () => {};

export function configureApiClient(getIdToken: GetIdToken, onUnauthorized: OnUnauthorized) {
  _getIdToken = getIdToken;
  _onUnauthorized = onUnauthorized;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = _getIdToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${cognitoConfig.apiUrl}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string> | undefined),
    },
  });

  if (response.status === 401) {
    _onUnauthorized();
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}
