import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ErrorBoundary } from './components/ui/ErrorBoundary.jsx';
import { TooltipProvider } from './components/ui/Menu.jsx';
import { ConfirmHost } from './components/ui/Overlay.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { useTheme } from './hooks/useTheme.js';
import { useIsMobile } from './hooks/useUi.js';
import { AppRoutes } from './router.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: true,
      // Solo se reintenta lo que puede ser transitorio (red o 5xx), nunca un 4xx.
      retry: (failureCount, error) => (error?.status === 0 || error?.status >= 500) && failureCount < 2,
    },
  },
});

function ThemeSync() {
  const { user } = useAuth();
  useTheme(user?.preferences?.theme);
  return null;
}

function Toasts() {
  const isMobile = useIsMobile();
  return (
    <Toaster
      position={isMobile ? 'top-center' : 'bottom-right'}
      offset={isMobile ? 12 : 24}
      toastOptions={{ classNames: { toast: 'sp-toast' } }}
    />
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ThemeSync />
          <TooltipProvider>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
            <ConfirmHost />
            <Toasts />
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
