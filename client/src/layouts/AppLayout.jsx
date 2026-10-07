import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { NotificationsDrawer } from '../components/notifications/NotificationsDrawer.jsx';
import { MiniTimer } from '../components/pomodoro/MiniTimer.jsx';
import { TaskDrawer } from '../components/tasks/TaskDrawer.jsx';
import { ErrorBoundary } from '../components/ui/ErrorBoundary.jsx';
import { PageLoader } from '../components/ui/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useRealtimeNotifications } from '../hooks/useNotifications.js';
import { usePomodoroEngine } from '../hooks/usePomodoro.js';
import { useIsMobile } from '../hooks/useUi.js';
import { connectSocket } from '../services/socket.js';
import styles from './AppLayout.module.css';
import { BottomBar, MobileTopBar, QuickAddButton } from './MobileBars.jsx';
import { Rail } from './Rail.jsx';

// Pantallas que en móvil necesitan toda la altura (chat): sin barra inferior.
const IMMERSIVE = [/^\/salas\/[^/]+$/];

export function AppLayout() {
  const { status } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();
  const authenticated = status === 'authenticated';
  const immersive = isMobile && IMMERSIVE.some((pattern) => pattern.test(location.pathname));

  useEffect(() => {
    if (authenticated) connectSocket();
  }, [authenticated]);
  useRealtimeNotifications(authenticated);
  usePomodoroEngine(authenticated);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className={styles.app} data-immersive={immersive || undefined}>
      <a href="#contenido" className={styles.skip}>
        Saltar al contenido
      </a>
      {!isMobile ? <Rail /> : !immersive ? <MobileTopBar /> : null}

      <main id="contenido" className={styles.sheet} tabIndex={-1}>
        <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      {isMobile && !immersive ? (
        <>
          <MiniTimer floating />
          <QuickAddButton />
          <BottomBar />
        </>
      ) : null}

      <TaskDrawer />
      <NotificationsDrawer />
    </div>
  );
}
