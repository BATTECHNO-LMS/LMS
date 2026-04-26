import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { queryClient } from '../../lib/queryClient.js';
import { AuthProvider } from '../../features/auth/index.js';
import { LocaleProvider } from '../../features/locale/index.js';
import { TenantProvider } from '../../features/tenant/index.js';
import { ErrorBoundary } from '../../components/ErrorBoundary.jsx';
import { LEGACY_THEME_STORAGE_KEY, removeStorageItem } from '../../utils/storage.js';

function LightOnlyRoot({ children }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.colorScheme = 'light';
    removeStorageItem(LEGACY_THEME_STORAGE_KEY);
  }, []);
  return children;
}

export function AppProviders({ children }) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LightOnlyRoot>
          <LocaleProvider>
            <BrowserRouter>
              <AuthProvider>
                <TenantProvider>{children}</TenantProvider>
              </AuthProvider>
            </BrowserRouter>
          </LocaleProvider>
        </LightOnlyRoot>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
