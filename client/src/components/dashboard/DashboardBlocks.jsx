import { ChatsCircle, Exam, Timer, UsersThree } from "@phosphor-icons/react";
import { Link, useNavigate } from "react-router-dom";
import { useUiStore } from "../../store/uiStore.js";
import { formatAgo, formatDueShort } from "../../utils/dates.js";
import { formatMinutes, plural } from "../../utils/format.js";
import { describeNotification } from "../../utils/notifications.js";
import { AverageBars } from "../charts/AverageBars.jsx";
import { ProgressMeter } from "../charts/ProgressMeter.jsx";
import { AvatarStack } from "../ui/Avatar.jsx";
import { Button } from "../ui/Button.jsx";
import { EmptyState } from "../ui/Feedback.jsx";
import { Section } from "../ui/Page.jsx";
import { SubjectTag } from "../ui/SubjectTag.jsx";

const MoreLink = ({ to, children }) => (
  <Link to={to} className="dashboard-more-link">
    {children}
  </Link>
);

export function GradesBlock({ grades }) {
  return (
    <Section
      title="Notas"
      id="dash-grades"
      action={
        grades.average != null ? (
          <MoreLink to="/notas">Ver notas</MoreLink>
        ) : null
      }
    >
      {grades.average == null ? (
        <EmptyState icon={Exam} title="Aún no hay notas" compact>
          Cuando completes una tarea y le pongas nota, aquí verás tu media por
          asignatura.
        </EmptyState>
      ) : (
        <>
          <AverageBars rows={grades.bySubject} overall={grades.average} />
          {grades.ungraded > 0 ? (
            <p className="dashboard-note">
              {plural(
                grades.ungraded,
                "tarea completada sigue",
                "tareas completadas siguen",
              )}{" "}
              sin nota.{" "}
              <Link to="/notas">
                {grades.ungraded === 1 ? "Ponle nota" : "Ponles nota"}
              </Link>
            </p>
          ) : null}
        </>
      )}
    </Section>
  );
}

export function ProgressBlock({ progress }) {
  return (
    <Section title="Progreso" id="dash-progress">
      <ProgressMeter
        completed={progress.completed}
        pending={progress.pending}
        overdue={progress.overdue}
      />
    </Section>
  );
}

export function FocusBlock({ pomodoro }) {
  const { focusSeconds, completedFocus } = pomodoro.totals;
  return (
    <Section title="Concentración hoy" id="dash-focus">
      <div className="dashboard-focus">
        <p className="dashboard-focus-text">
          {focusSeconds > 0
            ? `${formatMinutes(focusSeconds)} de estudio en ${plural(completedFocus, "bloque completo", "bloques completos")}.`
            : "Aún no has hecho ningún bloque de estudio hoy."}
        </p>
        <Button
          as={Link}
          to="/pomodoro"
          variant="secondary"
          size="sm"
          icon={Timer}
        >
          {focusSeconds > 0 ? "Seguir estudiando" : "Empezar un bloque"}
        </Button>
      </div>
    </Section>
  );
}

export function EventsBlock({ events, now }) {
  const navigate = useNavigate();
  if (events.length === 0) return null;
  return (
    <Section
      title="En tus salas"
      id="dash-events"
      description="Sesiones programadas y tareas que te han asignado."
    >
      <ul className="dashboard-events">
        {events.map((event) => (
          <li key={event._id}>
            <button
              type="button"
              className="dashboard-event"
              onClick={() => navigate(`/salas/${event.roomId}`)}
            >
              <span className="dashboard-event-when">
                {formatDueShort(event.date, now)}
              </span>
              <span className="dashboard-event-body">
                <span className="dashboard-event-title">
                  {event.kind === "session"
                    ? `Sesión de estudio: ${event.title}`
                    : event.title}
                </span>
                <span className="dashboard-event-room">
                  {event.kind === "session"
                    ? "Sala programada"
                    : `Asignada en ${event.roomName}`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function RoomsBlock({ rooms }) {
  return (
    <Section
      title="Salas"
      id="dash-rooms"
      action={
        rooms.total > 0 ? <MoreLink to="/salas">Ver salas</MoreLink> : null
      }
    >
      {rooms.invitations > 0 ? (
        <Link to="/salas" className="dashboard-callout">
          {rooms.invitations === 1
            ? "Tienes una invitación pendiente"
            : `Tienes ${rooms.invitations} invitaciones pendientes`}
        </Link>
      ) : null}
      {rooms.items.length === 0 ? (
        <EmptyState
          icon={ChatsCircle}
          title="Sin salas todavía"
          compact
          action={
            <Button as={Link} to="/salas?nueva=1" size="sm" variant="secondary">
              Crear una sala
            </Button>
          }
        >
          Prepara exámenes con tus amigos: chat, tareas repartidas y archivos en
          un mismo sitio.
        </EmptyState>
      ) : (
        <ul className="dashboard-compact-list">
          {rooms.items.map((room) => (
            <li key={room._id}>
              <Link to={`/salas/${room._id}`} className="dashboard-compact-row">
                <span className="dashboard-compact-title">{room.name}</span>
                <span className="dashboard-compact-meta">
                  <SubjectTag
                    subject={room.subject}
                    size="sm"
                    fallback={null}
                  />
                  <span>
                    {room.myOpenTasks
                      ? plural(room.myOpenTasks, "tarea tuya", "tareas tuyas")
                      : `activa ${formatAgo(room.lastActivityAt)}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function FriendsBlock({ friends }) {
  return (
    <Section
      title="Amigos"
      id="dash-friends"
      action={
        friends.total > 0 ? <MoreLink to="/amigos">Ver amigos</MoreLink> : null
      }
    >
      {friends.total === 0 ? (
        <EmptyState
          icon={UsersThree}
          title="Aún no tienes amigos añadidos"
          compact
          action={
            <Button
              as={Link}
              to="/amigos?tab=buscar"
              size="sm"
              variant="secondary"
            >
              Buscar estudiantes
            </Button>
          }
        >
          Encuentra a tus compañeros por su nombre o su identificador.
        </EmptyState>
      ) : (
        <Link to="/amigos" className="dashboard-friends">
          <AvatarStack users={friends.items} max={6} total={friends.total} />
          <span>{plural(friends.total, "amigo", "amigos")}</span>
        </Link>
      )}
    </Section>
  );
}

export function NotificationsBlock({ notifications }) {
  const openNotifications = useUiStore((state) => state.setNotificationsOpen);
  const items = notifications.items.slice(0, 3);
  return (
    <Section
      title="Avisos"
      id="dash-notifications"
      action={
        items.length ? (
          <button
            type="button"
            className="dashboard-more-link"
            onClick={() => openNotifications(true)}
          >
            {notifications.unread
              ? `${notifications.unread} sin leer`
              : "Ver todos"}
          </button>
        ) : null
      }
    >
      {items.length === 0 ? (
        <p className="dashboard-note">
          No tienes avisos. Aquí aparecerán solicitudes, invitaciones y
          recordatorios.
        </p>
      ) : (
        <ul className="dashboard-compact-list">
          {items.map((notification) => (
            <li
              key={notification._id}
              className="dashboard-notification"
              data-unread={!notification.read || undefined}
            >
              <span>{describeNotification(notification).text}</span>
              <span className="dashboard-compact-meta">
                {formatAgo(notification.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
