import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { queryClient } from '../../lib/queryClient.js';
import { AuthProvider } from '../../features/auth/index.js';
import { LocaleProvider } from '../../features/locale/index.js';
import { ThemeProvider } from '../../features/theme/index.js';
import { TenantProvider } from '../../features/tenant/index.js';

export function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LocaleProvider>
          <BrowserRouter>
            <AuthProvider>
              <TenantProvider>{children}</TenantProvider>
            </AuthProvider>
          </BrowserRouter>
        </LocaleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
