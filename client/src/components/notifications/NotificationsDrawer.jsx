import { useUiStore } from '../../store/uiStore.js';
import { Drawer } from '../ui/Overlay.jsx';
import { NotificationList } from './NotificationList.jsx';

export function NotificationsDrawer() {
  const open = useUiStore((state) => state.notificationsOpen);
  const setOpen = useUiStore((state) => state.setNotificationsOpen);

  return (
    <Drawer open={open} onOpenChange={setOpen} title="Avisos">
      {open ? <NotificationList onNavigate={() => setOpen(false)} /> : null}
    </Drawer>
  );
}
