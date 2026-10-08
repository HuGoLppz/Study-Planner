import { Bell } from "@phosphor-icons/react";
import { Link, NavLink } from "react-router-dom";
import { MiniTimer } from "../components/pomodoro/MiniTimer.jsx";
import { Avatar } from "../components/ui/Avatar.jsx";
import { Logo } from "../components/ui/Logo.jsx";
import { Tooltip } from "../components/ui/Menu.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useUnreadCount } from "../hooks/useNotifications.js";
import { useMediaQuery } from "../hooks/useUi.js";
import { useUiStore } from "../store/uiStore.js";
import { NAV_GROUPS } from "./navigation.js";

// Rail lateral. La sección activa es una pestaña de separador unida a la hoja de contenido.
export function Rail() {
  const { user } = useAuth();
  const compact = useMediaQuery("(max-width: 1099px)");
  const { data: unread = 0 } = useUnreadCount();
  const openNotifications = useUiStore((state) => state.setNotificationsOpen);

  return (
    <nav className="rail" aria-label="Principal">
      <Link to="/" className="rail-brand">
        <Logo compact={compact} />
      </Link>

      <div className="rail-groups">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="rail-group-label">{group.label}</p>
            <ul>
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <Tooltip content={label} disabled={!compact}>
                    <NavLink to={to} end={end} className="rail-link">
                      {({ isActive }) => (
                        <>
                          <Icon
                            size={22}
                            weight={isActive ? "fill" : "regular"}
                            aria-hidden
                          />
                          <span className="rail-link-label">{label}</span>
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

      <div className="rail-footer">
        <MiniTimer compact={compact} />
        <Tooltip content="Avisos" disabled={!compact}>
          <button
            type="button"
            className="rail-link"
            onClick={() => openNotifications(true)}
          >
            <span className="rail-bell">
              <Bell size={22} aria-hidden />
              {unread > 0 ? (
                <span className="rail-unread">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </span>
            <span className="rail-link-label">Avisos</span>
            <span className="visually-hidden">
              {unread > 0 ? `, ${unread} sin leer` : ""}
            </span>
          </button>
        </Tooltip>
        <Tooltip content="Tu perfil" disabled={!compact}>
          <NavLink to="/perfil" className="rail-profile">
            <Avatar user={user} size="sm" />
            <span className="rail-profile-text">
              <span className="truncate">{user?.name}</span>
              <span className="rail-handle">@{user?.handle}</span>
            </span>
          </NavLink>
        </Tooltip>
      </div>
    </nav>
  );
}
