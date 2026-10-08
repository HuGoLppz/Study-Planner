import { academicLine } from "../../utils/users.js";
import { Avatar } from "../ui/Avatar.jsx";

// Cabecera de perfil compartida por "mi perfil" y el perfil de otros estudiantes.
export function ProfileIdentity({ user, avatarSlot, actions, children }) {
  return (
    <header className="profile-identity">
      <div className="profile-avatar-wrap">
        {avatarSlot ?? <Avatar user={user} size="xl" />}
      </div>
      <div className="profile-identity-text">
        <h1 className="page-title">{user.name}</h1>
        <p className="profile-handle">@{user.handle}</p>
        {academicLine(user) ? (
          <p className="profile-academic">{academicLine(user)}</p>
        ) : null}
        {user.bio ? <p className="profile-bio">{user.bio}</p> : null}
        {children}
      </div>
      {actions ? (
        <div className="profile-identity-actions">{actions}</div>
      ) : null}
    </header>
  );
}
