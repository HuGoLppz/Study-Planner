import { Bell } from '@phosphor-icons/react';
import { Link, NavLink } from 'react-router-dom';
import { MiniTimer } from '../components/pomodoro/MiniTimer.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Logo } from '../components/ui/Logo.jsx';
import { Tooltip } from '../components/ui/Menu.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useUnreadCount } from '../hooks/useNotifications.js';
import { useMediaQuery } from '../hooks/useUi.js';
import { useUiStore } from '../store/uiStore.js';
import { NAV_GROUPS } from './navigation.js';
import styles from './Rail.module.css';

// Rail lateral. La sección activa es una pestaña de separador unida a la hoja de contenido.
export function Rail() {
  const { user } = useAuth();
  const compact = useMediaQuery('(max-width: 1099px)');
  const { data: unread = 0 } = useUnreadCount();
  const openNotifications = useUiStore((state) => state.setNotificationsOpen);

  return (
    <nav className={styles.rail} aria-label="Principal">
      <Link to="/" className={styles.brand}>
        <Logo compact={compact} />
      </Link>

      <div className={styles.groups}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className={styles.group}>
            <p className={styles.groupLabel}>{group.label}</p>
            <ul>
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <Tooltip content={label} disabled={!compact}>
                    <NavLink to={to} end={end} className={styles.link}>
                      {({ isActive }) => (
                        <>
                          <Icon size={22} weight={isActive ? 'fill' : 'regular'} aria-hidden />
                          <span className={styles.linkLabel}>{label}</span>
                        </>
                      )}
                    </NavLink>
                  </Tooltip>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <MiniTimer compact={compact} />
        <Tooltip content="Avisos" disabled={!compact}>
          <button type="button" className={styles.link} onClick={() => openNotifications(true)}>
            <span className={styles.bell}>
              <Bell size={22} aria-hidden />
              {unread > 0 ? <span className={styles.unread}>{unread > 99 ? '99+' : unread}</span> : null}
            </span>
            <span className={styles.linkLabel}>Avisos</span>
            <span className="visually-hidden">{unread > 0 ? `, ${unread} sin leer` : ''}</span>
          </button>
        </Tooltip>
        <Tooltip content="Tu perfil" disabled={!compact}>
          <NavLink to="/perfil" className={styles.profile}>
            <Avatar user={user} size="sm" />
            <span className={styles.profileText}>
              <span className="truncate">{user?.name}</span>
              <span className={styles.handle}>@{user?.handle}</span>
            </span>
          </NavLink>
        </Tooltip>
      </div>
    </nav>
  );
}
