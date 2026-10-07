import { Bell, DotsThreeOutline, Plus } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Avatar } from '../components/ui/Avatar.jsx';
import { LogoMark } from '../components/ui/Logo.jsx';
import { Modal } from '../components/ui/Overlay.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useUnreadCount } from '../hooks/useNotifications.js';
import { useUiStore } from '../store/uiStore.js';
import styles from './MobileBars.module.css';
import { MOBILE_TABS, MORE_ITEMS, QUICK_ADD_PATHS } from './navigation.js';

export function MobileTopBar() {
  const { user } = useAuth();
  const { data: unread = 0 } = useUnreadCount();

  return (
    <header className={styles.topBar}>
      <Link to="/" className={styles.brand} aria-label="Ir a Hoy">
        <LogoMark size={30} />
        <span className={styles.brandWord}>Study Planner</span>
      </Link>
      <div className={styles.topActions}>
        <Link to="/avisos" className={styles.topButton} aria-label={unread ? `Avisos, ${unread} sin leer` : 'Avisos'}>
          <Bell size={24} aria-hidden />
          {unread > 0 ? <span className={styles.badge}>{unread > 99 ? '99+' : unread}</span> : null}
        </Link>
        <Link to="/perfil" className={styles.topButton} aria-label="Tu perfil">
          <Avatar user={user} size="sm" />
        </Link>
      </div>
    </header>
  );
}

export function BottomBar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const moreActive = MORE_ITEMS.some((item) => location.pathname.startsWith(item.to));

  return (
    <>
      <nav className={styles.bottomBar} aria-label="Principal">
        {MOBILE_TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={styles.tab}>
            {({ isActive }) => (
              <>
                <span className={styles.tabIcon}>
                  <Icon size={24} weight={isActive ? 'fill' : 'regular'} aria-hidden />
                </span>
                <span className={styles.tabLabel}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          className={clsx(styles.tab, moreActive && 'active')}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
        >
          <span className={styles.tabIcon}>
            <DotsThreeOutline size={24} weight={moreActive ? 'fill' : 'regular'} aria-hidden />
          </span>
          <span className={styles.tabLabel}>Más</span>
        </button>
      </nav>

      <Modal open={moreOpen} onOpenChange={setMoreOpen} title="Más secciones">
        <ul className={styles.moreGrid}>
          {MORE_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} className={styles.moreLink} onClick={() => setMoreOpen(false)}>
                <Icon size={26} weight="duotone" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

export function QuickAddButton() {
  const location = useLocation();
  const createTask = useUiStore((state) => state.createTask);
  if (!QUICK_ADD_PATHS.includes(location.pathname)) return null;

  return (
    <button type="button" className={styles.fab} onClick={() => createTask()} aria-label="Nueva tarea">
      <Plus size={26} weight="bold" aria-hidden />
    </button>
  );
}
