import { Crown, DotsThree, SignOut, UserMinus, UserPlus, X } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFriends } from '../../hooks/useFriends.js';
import { useCancelRoomInvitation, useInviteToRoom, useLeaveRoom, useRemoveMember, useSetMemberRole } from '../../hooks/useRooms.js';
import { confirm } from '../../store/confirmStore.js';
import { formatLongDate } from '../../utils/dates.js';
import { firstName } from '../../utils/users.js';
import { Avatar } from '../ui/Avatar.jsx';
import { Button, IconButton } from '../ui/Button.jsx';
import { EmptyState } from '../ui/Feedback.jsx';
import { Menu } from '../ui/Menu.jsx';
import { Modal, OverlayFooter } from '../ui/Overlay.jsx';
import styles from './Rooms.module.css';

export function InviteDialog({ room, open, onOpenChange }) {
  const friends = useFriends();
  const invite = useInviteToRoom();
  const [selected, setSelected] = useState(() => new Set());

  const taken = useMemo(
    () => new Set([...room.members.map((member) => member.user._id), ...room.invitations.map((invitation) => invitation.user._id)]),
    [room],
  );
  const available = (friends.data ?? []).filter((friend) => !taken.has(friend._id));

  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = () =>
    invite.mutate(
      { id: room._id, userIds: [...selected] },
      {
        onSuccess: () => {
          setSelected(new Set());
          onOpenChange(false);
        },
      },
    );

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Invitar a la sala" description="Solo puedes invitar a tus amigos.">
      {friends.isPending ? null : available.length === 0 ? (
        <EmptyState icon={UserPlus} title={friends.data?.length ? 'Todos tus amigos ya están aquí' : 'Aún no tienes amigos añadidos'} compact>
          {friends.data?.length ? 'Ya forman parte de la sala o tienen una invitación pendiente.' : 'Añade amigos desde la sección Amigos para poder invitarles.'}
        </EmptyState>
      ) : (
        <ul className={styles.inviteList}>
          {available.map((friend) => (
            <li key={friend._id}>
              <label className={styles.inviteRow}>
                <input type="checkbox" checked={selected.has(friend._id)} onChange={() => toggle(friend._id)} />
                <Avatar user={friend} size="sm" />
                <span className={styles.memberText}>
                  <span className="truncate">{friend.name}</span>
                  <span className={styles.memberHandle}>@{friend.handle}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <OverlayFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={selected.size === 0} loading={invite.isPending}>
          {selected.size > 1 ? `Invitar a ${selected.size}` : 'Invitar'}
        </Button>
      </OverlayFooter>
    </Modal>
  );
}

export function MembersPanel({ room, currentUserId, isAdmin }) {
  const navigate = useNavigate();
  const setRole = useSetMemberRole();
  const removeMember = useRemoveMember();
  const cancelInvitation = useCancelRoomInvitation();
  const leave = useLeaveRoom();
  const [inviting, setInviting] = useState(false);

  const handleRemove = async (member) => {
    const ok = await confirm({
      title: `¿Quitar a ${firstName(member.user.name)} de la sala?`,
      description: 'Sus tareas de la sala quedarán sin asignar. Podrás volver a invitarle.',
      confirmLabel: 'Quitar de la sala',
      tone: 'danger',
    });
    if (ok) removeMember.mutate({ id: room._id, userId: member.user._id });
  };

  const handleLeave = async () => {
    const ok = await confirm({
      title: '¿Salir de la sala?',
      description: 'Dejarás de ver el chat, las tareas y los archivos. Alguien tendrá que invitarte para volver.',
      confirmLabel: 'Salir de la sala',
      tone: 'danger',
    });
    if (ok) leave.mutate({ id: room._id, userId: currentUserId }, { onSuccess: () => navigate('/salas') });
  };

  return (
    <div className={styles.panelBody}>
      <p className={styles.createdBy}>
        Creada por {room.createdBy?._id === currentUserId ? 'ti' : room.createdBy?.name ?? 'un antiguo participante'} el {formatLongDate(room.createdAt).toLowerCase()}.
      </p>

      <div className={styles.panelToolbar}>
        <h3 className={styles.panelHeading}>Participantes ({room.members.length})</h3>
        <Button size="sm" variant="secondary" icon={UserPlus} onClick={() => setInviting(true)}>
          Invitar
        </Button>
      </div>

      <ul className={styles.memberList}>
        {room.members.map((member) => {
          const self = member.user._id === currentUserId;
          const admin = member.role === 'admin';
          return (
            <li key={member.user._id} className={styles.memberRow}>
              <Avatar user={member.user} size="sm" />
              <span className={styles.memberText}>
                <span className="truncate">
                  {member.user.name}
                  {self ? ' (tú)' : ''}
                </span>
                <span className={styles.memberHandle}>{admin ? 'Administración' : `@${member.user.handle}`}</span>
              </span>
              {admin ? <Crown size={18} weight="fill" className={styles.crown} aria-label="Administración" /> : null}
              {isAdmin && !self ? (
                <Menu
                  trigger={
                    <button type="button" className={styles.memberMenu} aria-label={`Opciones para ${member.user.name}`}>
                      <DotsThree size={20} weight="bold" aria-hidden />
                    </button>
                  }
                  items={[
                    {
                      label: admin ? 'Quitar permisos de administración' : 'Dar permisos de administración',
                      icon: Crown,
                      onSelect: () => setRole.mutate({ id: room._id, userId: member.user._id, role: admin ? 'member' : 'admin' }),
                    },
                    { label: 'Quitar de la sala', icon: UserMinus, tone: 'danger', onSelect: () => handleRemove(member) },
                  ]}
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      {room.invitations.length ? (
        <>
          <h3 className={styles.panelHeading}>Invitaciones pendientes</h3>
          <ul className={styles.memberList}>
            {room.invitations.map((invitation) => (
              <li key={invitation.user._id} className={styles.memberRow}>
                <Avatar user={invitation.user} size="sm" />
                <span className={styles.memberText}>
                  <span className="truncate">{invitation.user.name}</span>
                  <span className={styles.memberHandle}>Sin responder</span>
                </span>
                {isAdmin ? (
                  <IconButton
                    icon={X}
                    size="sm"
                    label={`Retirar la invitación a ${invitation.user.name}`}
                    onClick={() => cancelInvitation.mutate({ id: room._id, userId: invitation.user._id })}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <Button variant="dangerGhost" icon={SignOut} onClick={handleLeave} loading={leave.isPending} className={styles.leave}>
        Salir de la sala
      </Button>

      <InviteDialog room={room} open={inviting} onOpenChange={setInviting} />
    </div>
  );
}
