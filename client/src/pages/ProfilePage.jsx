import { PencilSimple, SignOut } from "@phosphor-icons/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AcademicSummary } from "../components/profile/AcademicSummary.jsx";
import { ProfileIdentity } from "../components/profile/ProfileIdentity.jsx";
import {
  AvatarEditor,
  PasswordForm,
  PrivacySettings,
  ProfileForm,
  ThemeSettings,
} from "../components/profile/ProfileSettings.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Skeleton } from "../components/ui/Feedback.jsx";
import { Modal } from "../components/ui/Overlay.jsx";
import { Page, Section } from "../components/ui/Page.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useGradeStats } from "../hooks/useGrades.js";
import { formatLongDate } from "../utils/dates.js";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const stats = useGradeStats();
  const [editing, setEditing] = useState(false);
  const [leaving, setLeaving] = useState(false);

  return (
    <Page title="Tu perfil" width="medium">
      <ProfileIdentity
        user={user}
        avatarSlot={<AvatarEditor user={user} />}
        actions={
          <Button
            variant="secondary"
            icon={PencilSimple}
            onClick={() => setEditing(true)}
          >
            Editar perfil
          </Button>
        }
      />

      {stats.isPending ? (
        <Skeleton height={180} radius={12} />
      ) : (
        <AcademicSummary
          subjects={user.subjects}
          stats={stats.data}
          subjectsAction={
            <Link to="/asignaturas" className="small">
              Gestionar
            </Link>
          }
        />
      )}

      <div className="profile-settings">
        <Section title="Privacidad" id="profile-privacy">
          <PrivacySettings user={user} />
        </Section>
        <div className="profile-stack">
          <Section title="Apariencia" id="profile-theme">
            <ThemeSettings user={user} />
          </Section>
          <Section title="Contraseña" id="profile-password">
            <PasswordForm />
          </Section>
        </div>
      </div>

      <Section title="Cuenta" id="profile-account" className="profile-logout">
        <p className="muted small">
          Correo: {user.email}. Te uniste el{" "}
          {formatLongDate(user.createdAt).toLowerCase()}.
        </p>
        <Button
          variant="dangerGhost"
          icon={SignOut}
          loading={leaving}
          onClick={async () => {
            setLeaving(true);
            await logout();
          }}
          style={{ marginTop: 12 }}
        >
          Cerrar sesión
        </Button>
      </Section>

      <Modal open={editing} onOpenChange={setEditing} title="Editar perfil">
        {editing ? (
          <ProfileForm
            user={user}
            onDone={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        ) : null}
      </Modal>
    </Page>
  );
}
