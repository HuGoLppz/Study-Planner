import { academicLine } from '../../utils/users.js';
import { Avatar } from '../ui/Avatar.jsx';
import styles from './Profile.module.css';

// Cabecera de perfil compartida por "mi perfil" y el perfil de otros estudiantes.
export function ProfileIdentity({ user, avatarSlot, actions, children }) {
  return (
    <header className={styles.identity}>
      <div className={styles.avatarWrap}>{avatarSlot ?? <Avatar user={user} size="xl" />}</div>
      <div className={styles.identityText}>
        <h1 className="page-title">{user.name}</h1>
        <p className={styles.handle}>@{user.handle}</p>
        {academicLine(user) ? <p className={styles.academic}>{academicLine(user)}</p> : null}
        {user.bio ? <p className={styles.bio}>{user.bio}</p> : null}
        {children}
      </div>
      {actions ? <div className={styles.identityActions}>{actions}</div> : null}
    </header>
  );
}
