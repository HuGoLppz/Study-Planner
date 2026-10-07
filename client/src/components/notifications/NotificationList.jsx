import { BellSimple, Checks } from '@phosphor-icons/react';
import { useState } from 'react';
import { useNotificationList, useReadAllNotifications, useUnreadCount } from '../../hooks/useNotifications.js';
import { Button } from '../ui/Button.jsx';
import { EmptyState, ErrorState, SkeletonList } from '../ui/Feedback.jsx';
import { Segmented } from '../ui/Tabs.jsx';
import { NotificationItem } from './NotificationItem.jsx';
import styles from './Notifications.module.css';

export function NotificationList({ onNavigate }) {
  const [filter, setFilter] = useState('all');
  const unreadOnly = filter === 'unread';
  const { data: unread = 0 } = useUnreadCount();
  const query = useNotificationList({ unread: unreadOnly });
  const readAll = useReadAllNotifications();
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className={styles.listWrap}>
      <div className={styles.toolbar}>
        <Segmented
          label="Filtrar avisos"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'unread', label: 'Sin leer', count: unread || null },
          ]}
        />
        <Button variant="ghost" size="sm" icon={Checks} onClick={() => readAll.mutate()} disabled={!unread} loading={readAll.isPending}>
          Marcar todo como leído
        </Button>
      </div>

      {query.isPending ? (
        <SkeletonList rows={4} label="Cargando avisos" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : items.length === 0 ? (
        <EmptyState icon={BellSimple} title={unreadOnly ? 'Lo tienes todo leído' : 'Aún no tienes avisos'}>
          {unreadOnly
            ? 'Cuando ocurra algo nuevo en tus salas, amistades o entregas aparecerá aquí.'
            : 'Aquí verás solicitudes de amistad, invitaciones a salas y recordatorios de entregas.'}
        </EmptyState>
      ) : (
        <>
          <ul className={styles.list}>
            {items.map((notification) => (
              <NotificationItem key={notification._id} notification={notification} onNavigate={onNavigate} />
            ))}
          </ul>
          {query.hasNextPage ? (
            <Button variant="secondary" onClick={() => query.fetchNextPage()} loading={query.isFetchingNextPage} className={styles.more}>
              Ver avisos anteriores
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
