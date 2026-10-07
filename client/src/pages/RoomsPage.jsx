import { ChatsCircle, Plus } from '@phosphor-icons/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { RoomForm } from '../components/rooms/RoomForm.jsx';
import styles from '../components/rooms/Rooms.module.css';
import { AvatarStack } from '../components/ui/Avatar.jsx';
import { Button } from '../components/ui/Button.jsx';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/Feedback.jsx';
import { Modal } from '../components/ui/Overlay.jsx';
import { Page, PageHeader, Section } from '../components/ui/Page.jsx';
import { SubjectTag } from '../components/ui/SubjectTag.jsx';
import { useAcceptRoomInvitation, useDeclineRoomInvitation, useRoomInvitations, useRooms } from '../hooks/useRooms.js';
import { formatAgo, formatDateTime } from '../utils/dates.js';
import { plural } from '../utils/format.js';

function Invitations() {
  const invitations = useRoomInvitations();
  const accept = useAcceptRoomInvitation();
  const decline = useDeclineRoomInvitation();
  const navigate = useNavigate();
  const items = invitations.data ?? [];
  if (items.length === 0) return null;

  return (
    <Section title="Invitaciones" id="rooms-invitations" className={styles.invitations}>
      <ul className={styles.list}>
        {items.map(({ room, invitedBy, createdAt }) => (
          <li key={room._id} className={styles.invitation}>
            <div className={styles.roomMain}>
              <span className={styles.roomName}>{room.name}</span>
              <span className={styles.roomMeta}>
                <SubjectTag subject={room.subject} size="sm" fallback={null} />
                <span>
                  {invitedBy.name} te invitó {formatAgo(createdAt)}, {plural(room.memberCount, 'participante', 'participantes')}
                </span>
              </span>
            </div>
            <div className={styles.rowActions}>
              <Button
                size="sm"
                loading={accept.isPending && accept.variables === room._id}
                onClick={() => accept.mutate(room._id, { onSuccess: () => navigate(`/salas/${room._id}`) })}
              >
                Unirme
              </Button>
              <Button size="sm" variant="secondary" onClick={() => decline.mutate(room._id)}>
                Rechazar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export default function RoomsPage() {
  const rooms = useRooms();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const creating = params.get('nueva') === '1';
  const setCreating = (open) => setParams(open ? { nueva: '1' } : {}, { replace: true });

  return (
    <Page title="Salas">
      <PageHeader
        title="Salas"
        lead="Espacios para estudiar con tus amigos: chat, tareas repartidas y archivos compartidos."
        actions={
          <Button icon={Plus} onClick={() => setCreating(true)}>
            Nueva sala
          </Button>
        }
      />

      <Invitations />

      <Section title={rooms.data?.length ? 'Tus salas' : null} id="rooms-list">
        {rooms.isPending ? (
          <SkeletonList rows={3} label="Cargando salas" />
        ) : rooms.isError ? (
          <ErrorState error={rooms.error} onRetry={rooms.refetch} />
        ) : rooms.data.length === 0 ? (
          <EmptyState
            icon={ChatsCircle}
            title="Aún no estás en ninguna sala"
            action={
              <Button icon={Plus} onClick={() => setCreating(true)}>
                Crear una sala
              </Button>
            }
          >
            Crea una sala para preparar un examen o un trabajo en grupo e invita a tus amigos.
          </EmptyState>
        ) : (
          <ul className={styles.list}>
            {rooms.data.map((room) => (
              <li key={room._id}>
                <Link to={`/salas/${room._id}`} className={styles.roomRow}>
                  <div className={styles.roomMain}>
                    <span className={styles.roomName}>{room.name}</span>
                    <span className={styles.roomMeta}>
                      <SubjectTag subject={room.subject} size="sm" fallback={null} />
                      {room.scheduledAt ? <span>Sesión: {formatDateTime(room.scheduledAt)}</span> : null}
                    </span>
                    {room.description ? <span className={styles.roomDescription}>{room.description}</span> : null}
                  </div>
                  <AvatarStack users={room.members} max={4} total={room.memberCount} />
                  <dl className={styles.roomStats}>
                    <div>
                      <dt>Tareas abiertas</dt>
                      <dd>{room.openTasks}</dd>
                    </div>
                    <div>
                      <dt>Mensajes</dt>
                      <dd>{room.stats.messages}</dd>
                    </div>
                    <div>
                      <dt>Archivos</dt>
                      <dd>{room.stats.files}</dd>
                    </div>
                  </dl>
                  <span className={styles.activity}>Activa {formatAgo(room.lastActivityAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Modal open={creating} onOpenChange={setCreating} title="Nueva sala">
        {creating ? <RoomForm onDone={(room) => navigate(`/salas/${room._id}`)} onCancel={() => setCreating(false)} /> : null}
      </Modal>
    </Page>
  );
}
