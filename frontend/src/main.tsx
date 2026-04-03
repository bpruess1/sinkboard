import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProviderWithCallback, useAuth } from './auth/AuthProvider';
import { configureApiClient } from './api/client';
import App from './App';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

/**
 * Bridges auth context into the imperative API client.
 * Rendered inside AuthProvider so useAuth() is available.
 */
function ApiClientConfigurator() {
  const { getIdToken, logout } = useAuth();
  configureApiClient(getIdToken, logout);
  return null;
}

function Root() {
  return (
    <StrictMode>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProviderWithCallback>
            <ApiClientConfigurator />
            <App />
          </AuthProviderWithCallback>
        </QueryClientProvider>
      </BrowserRouter>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
