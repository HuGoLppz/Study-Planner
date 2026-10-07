import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ErrorState, PageLoader } from '../components/ui/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function RequireAuth() {
  const { status, isError, retry } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader label="Comprobando tu sesión" />;
  if (status === 'anonymous') {
    if (isError) {
      return (
        <div style={{ padding: 32 }}>
          <ErrorState title="No hay conexión con el servidor" onRetry={retry} />
        </div>
      );
    }
    return <Navigate to="/entrar" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

export function GuestOnly() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageLoader label="Comprobando tu sesión" />;
  if (status === 'authenticated') return <Navigate to={location.state?.from?.pathname ?? '/'} replace />;
  return <Outlet />;
}
