import { NotificationList } from "../components/notifications/NotificationList.jsx";
import { Page, PageHeader } from "../components/ui/Page.jsx";

export default function NotificationsPage() {
  return (
    <Page title="Avisos" width="narrow">
      <PageHeader
        title="Avisos"
        lead="Solicitudes de amistad, invitaciones a salas, tareas asignadas y entregas que se acercan."
      />
      <NotificationList />
    </Page>
  );
}
