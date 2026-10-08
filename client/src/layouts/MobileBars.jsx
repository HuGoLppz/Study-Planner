import { Bell, DotsThreeOutline, Plus } from "@phosphor-icons/react";
import clsx from "clsx";
import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Avatar } from "../components/ui/Avatar.jsx";
import { LogoMark } from "../components/ui/Logo.jsx";
import { Modal } from "../components/ui/Overlay.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useUnreadCount } from "../hooks/useNotifications.js";
import { useUiStore } from "../store/uiStore.js";
import { MOBILE_TABS, MORE_ITEMS, QUICK_ADD_PATHS } from "./navigation.js";

export function MobileTopBar() {
  const { user } = useAuth();
  const { data: unread = 0 } = useUnreadCount();

  return (
    <header className="mobile-top-bar">
      <Link to="/" className="mobile-brand" aria-label="Ir a Hoy">
        <LogoMark size={30} />
        <span className="mobile-brand-word">Study Planner</span>
      </Link>
      <div className="mobile-top-actions">
        <Link
          to="/avisos"
          className="mobile-top-button"
          aria-label={unread ? `Avisos, ${unread} sin leer` : "Avisos"}
        >
          <Bell size={24} aria-hidden />
          {unread > 0 ? (
            <span className="mobile-badge">{unread > 99 ? "99+" : unread}</span>
          ) : null}
        </Link>
        <Link to="/perfil" className="mobile-top-button" aria-label="Tu perfil">
          <Avatar user={user} size="sm" />
        </Link>
      </div>
    </header>
  );
}

export function BottomBar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const moreActive = MORE_ITEMS.some((item) =>
    location.pathname.startsWith(item.to),
  );

  return (
    <>
      <nav className="mobile-bottom-bar" aria-label="Principal">
        {MOBILE_TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="mobile-tab">
            {({ isActive }) => (
              <>
                <span className="mobile-tab-icon">
                  <Icon
                    size={24}
                    weight={isActive ? "fill" : "regular"}
                    aria-hidden
                  />
                </span>
                <span className="mobile-tab-label">{label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          className={clsx("mobile-tab", moreActive && "active")}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
        >
          <span className="mobile-tab-icon">
            <DotsThreeOutline
              size={24}
              weight={moreActive ? "fill" : "regular"}
              aria-hidden
            />
          </span>
          <span className="mobile-tab-label">Más</span>
        </button>
      </nav>

      <Modal open={moreOpen} onOpenChange={setMoreOpen} title="Más secciones">
        <ul className="mobile-more-grid">
          {MORE_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className="mobile-more-link"
                onClick={() => setMoreOpen(false)}
              >
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
    <button
      type="button"
      className="mobile-fab"
      onClick={() => createTask()}
      aria-label="Nueva tarea"
    >
      <Plus size={26} weight="bold" aria-hidden />
    </button>
  );
}
