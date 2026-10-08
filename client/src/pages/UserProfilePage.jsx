import { LockSimple, UserCircle } from "@phosphor-icons/react";
import { Link, Navigate, useParams } from "react-router-dom";
import { RelationshipAction } from "../components/friends/RelationshipAction.jsx";
import { AcademicSummary } from "../components/profile/AcademicSummary.jsx";
import { ProfileIdentity } from "../components/profile/ProfileIdentity.jsx";
import { Button } from "../components/ui/Button.jsx";
import { SkeletonBody } from "../components/ui/AppSkeleton.jsx";
import { EmptyState, ErrorState } from "../components/ui/Feedback.jsx";
import { Page } from "../components/ui/Page.jsx";
import { useProfile } from "../hooks/useFriends.js";
import { plural } from "../utils/format.js";
import { firstName } from "../utils/users.js";

const RESTRICTED_COPY = {
  private: "Este perfil es privado.",
  friends: "Este perfil solo lo pueden ver sus amigos.",
};

export default function UserProfilePage() {
  const { handle } = useParams();
  const {
    data: profile,
    isPending,
    error,
    refetch,
  } = useProfile(handle?.toLowerCase());

  if (isPending) {
    return (
      <Page title="Perfil" width="medium">
        <SkeletonBody variant="profile" />
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Perfil" width="medium">
        {error.status === 404 || error.status === 422 ? (
          <EmptyState
            icon={UserCircle}
            title="No hay nadie con ese identificador"
            action={
              <Button as={Link} to="/amigos?tab=buscar" variant="secondary">
                Buscar estudiantes
              </Button>
            }
          >
            Comprueba que @{handle} esté bien escrito.
          </EmptyState>
        ) : (
          <ErrorState error={error} onRetry={refetch} />
        )}
      </Page>
    );
  }

  if (profile.relationship?.status === "self")
    return <Navigate to="/perfil" replace />;

  return (
    <Page title={profile.name} width="medium">
      <ProfileIdentity
        user={profile}
        actions={
          <RelationshipAction
            user={profile}
            relationship={profile.relationship}
            size="md"
          />
        }
      >
        {!profile.restricted && profile.friendsCount != null ? (
          <p className="profile-academic">
            {plural(profile.friendsCount, "amigo", "amigos")}
          </p>
        ) : null}
      </ProfileIdentity>

      {profile.restricted ? (
        <EmptyState
          icon={LockSimple}
          title={
            RESTRICTED_COPY[profile.visibility] ?? "Este perfil no es visible."
          }
        >
          {profile.visibility === "friends" &&
          profile.relationship?.status !== "friends"
            ? `Envía una solicitud de amistad a ${firstName(profile.name)} para ver sus asignaturas y su progreso.`
            : "Solo se muestran su nombre y su identificador."}
        </EmptyState>
      ) : (
        <AcademicSummary subjects={profile.subjects} stats={profile.stats} />
      )}
      {!profile.restricted && !profile.stats ? (
        <p className={`muted small profile-private-note`}>
          {firstName(profile.name)} no comparte sus notas.
        </p>
      ) : null}
    </Page>
  );
}
