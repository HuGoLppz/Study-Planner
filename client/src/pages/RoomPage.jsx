import { ArrowLeft, ChatsCircle, DotsThreeOutline, Paperclip, PencilSimple, Trash, UserPlus, UsersThree, ListChecks, Door } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChatPanel } from '../components/rooms/ChatPanel.jsx';
import { InviteDialog, MembersPanel } from '../components/rooms/MembersPanel.jsx';
import { RoomFiles } from '../components/rooms/RoomFiles.jsx';
import { RoomForm } from '../components/rooms/RoomForm.jsx';
import styles from '../components/rooms/Rooms.module.css';
import { RoomTasks } from '../components/rooms/RoomTasks.jsx';
import { AvatarStack } from '../components/ui/Avatar.jsx';
import { Button, IconButton } from '../components/ui/Button.jsx';
import { EmptyState, ErrorState, PageLoader } from '../components/ui/Feedback.jsx';
import { Menu } from '../components/ui/Menu.jsx';
import { Modal } from '../components/ui/Overlay.jsx';
import { Page } from '../components/ui/Page.jsx';
import { SubjectTag } from '../components/ui/SubjectTag.jsx';
import { TabPanel, Tabs } from '../components/ui/Tabs.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useRoomRealtime } from '../hooks/useRoomChat.js';
import { useAcceptRoomInvitation, useDeclineRoomInvitation, useDeleteRoom, useRoom } from '../hooks/useRooms.js';
import { useIsMobile } from '../hooks/useUi.js';
import { confirm } from '../store/confirmStore.js';
import { formatDateTime } from '../utils/dates.js';

const PANELS = ['tareas', 'archivos', 'personas'];

function PendingInvitation({ roomId, roomName }) {
  const accept = useAcceptRoomInvitation();
  const decline = useDeclineRoomInvitation();
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={Door}
      title={`Te han invitado a ${roomName}`}
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={() => accept.mutate(roomId)} loading={accept.isPending}>
            Unirme a la sala
          </Button>
          <Button variant="secondary" onClick={() => decline.mutate(roomId, { onSuccess: () => navigate('/salas') })}>
            Rechazar
          </Button>
        </div>
      }
    >
      Cuando te unas podrás ver el chat, las tareas y los archivos.
    </EmptyState>
  );
}

export default function RoomPage() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data: room, isPending, error, refetch } = useRoom(roomId);
  const deleteRoom = useDeleteRoom();
  const { typing, notifyTyping } = useRoomRealtime(room ? roomId : null, user._id);
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);

  const requested = params.get('panel');
  const sidePanel = PANELS.includes(requested) ? requested : 'tareas';
  const mobilePanel = PANELS.includes(requested) || requested === 'chat' ? requested : 'chat';
  const setPanel = (value) => setParams(value === 'chat' ? {} : { panel: value }, { replace: true });

  if (isPending) return <PageLoader label="Abriendo la sala" />;

  if (error) {
    return (
      <Page title="Sala" width="narrow">
        <Link to="/salas" className={styles.back}>
          <ArrowLeft size={16} aria-hidden /> Salas
        </Link>
        {error.code === 'ROOM_INVITATION_PENDING' ? (
          <PendingInvitation roomId={roomId} roomName={error.details?.room?.name ?? 'esta sala'} />
        ) : error.status === 404 ? (
          <EmptyState icon={ChatsCircle} title="Esta sala no existe o ya no formas parte de ella" action={<Button as={Link} to="/salas" variant="secondary">Ver tus salas</Button>} />
        ) : (
          <ErrorState error={error} onRetry={refetch} />
        )}
      </Page>
    );
  }

  const membership = room.members.find((member) => member.user._id === user._id);
  const isAdmin = membership?.role === 'admin';

  const handleDelete = async () => {
    const ok = await confirm({
      title: `¿Eliminar ${room.name}?`,
      description: 'Se borrarán el chat, las tareas y los archivos de la sala para todos sus participantes.',
      confirmLabel: 'Eliminar sala',
      tone: 'danger',
    });
    if (ok) deleteRoom.mutate(room._id, { onSuccess: () => navigate('/salas') });
  };

  const menuItems = [
    isAdmin ? { label: 'Editar sala', icon: PencilSimple, onSelect: () => setEditing(true) } : null,
    { label: 'Invitar amigos', icon: UserPlus, onSelect: () => setInviting(true) },
    isAdmin ? 'separator' : null,
    isAdmin ? { label: 'Eliminar sala', icon: Trash, tone: 'danger', onSelect: handleDelete } : null,
  ];

  const panels = {
    tareas: <RoomTasks room={room} currentUserId={user._id} isAdmin={isAdmin} />,
    archivos: <RoomFiles roomId={room._id} currentUserId={user._id} isAdmin={isAdmin} />,
    personas: <MembersPanel room={room} currentUserId={user._id} isAdmin={isAdmin} />,
  };
  const chat = <ChatPanel roomId={room._id} currentUserId={user._id} isAdmin={isAdmin} typing={typing} onTyping={notifyTyping} />;

  const tabs = [
    { value: 'tareas', label: 'Tareas', icon: ListChecks, count: room.tasks.filter((task) => task.status !== 'completed').length || null },
    { value: 'archivos', label: 'Archivos', icon: Paperclip, count: room.stats.files || null },
    { value: 'personas', label: 'Personas', icon: UsersThree, count: room.members.length },
  ];

  return (
    <Page title={room.name} width="full" className={styles.roomPage}>
      <header className={styles.roomHeader}>
        <Link to="/salas" className={styles.back} aria-label="Volver a salas">
          <ArrowLeft size={16} aria-hidden /> {!isMobile ? 'Salas' : null}
        </Link>
        <div className={styles.roomTitleBlock}>
          <h1 className={styles.roomTitle}>{room.name}</h1>
          <p className={styles.roomFacts}>
            <SubjectTag subject={room.subject} size="sm" fallback={null} />
            {room.scheduledAt ? <span>Sesión: {formatDateTime(room.scheduledAt)}</span> : null}
            {!isMobile && room.description ? <span className={styles.roomDescriptionInline}>{room.description}</span> : null}
          </p>
        </div>
        <div className={styles.roomActions}>
          {!isMobile ? <AvatarStack users={room.members.map((member) => member.user)} max={5} /> : null}
          {!isMobile ? (
            <Button variant="secondary" size="sm" icon={UserPlus} onClick={() => setInviting(true)}>
              Invitar
            </Button>
          ) : null}
          <Menu trigger={<IconButton icon={DotsThreeOutline} label="Opciones de la sala" />} items={menuItems} />
        </div>
      </header>

      {isMobile ? (
        <Tabs
          value={mobilePanel}
          onValueChange={setPanel}
          label="Secciones de la sala"
          className={styles.mobileTabs}
          listClassName={styles.mobileTabList}
          tabs={[{ value: 'chat', label: 'Chat', icon: ChatsCircle }, ...tabs]}
        >
          <TabPanel value="chat" className={styles.mobileChat}>
            {chat}
          </TabPanel>
          {PANELS.map((panel) => (
            <TabPanel key={panel} value={panel} className={styles.mobilePanel}>
              {panels[panel]}
            </TabPanel>
          ))}
        </Tabs>
      ) : (
        <div className={styles.roomGrid}>
          <section className={styles.chatColumn} aria-label="Chat de la sala">
            {chat}
          </section>
          <aside className={styles.sideColumn}>
            <Tabs value={sidePanel} onValueChange={setPanel} label="Paneles de la sala" tabs={tabs} listClassName={styles.sideTabs}>
              {PANELS.map((panel) => (
                <TabPanel key={panel} value={panel}>
                  {panels[panel]}
                </TabPanel>
              ))}
            </Tabs>
          </aside>
        </div>
      )}

      <Modal open={editing} onOpenChange={setEditing} title="Editar sala">
        {editing ? <RoomForm room={room} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} /> : null}
      </Modal>
      <InviteDialog room={room} open={inviting} onOpenChange={setInviting} />
    </Page>
  );
}
