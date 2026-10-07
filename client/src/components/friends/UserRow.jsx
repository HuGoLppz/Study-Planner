import { Link } from 'react-router-dom';
import { academicLine } from '../../utils/users.js';
import { Avatar } from '../ui/Avatar.jsx';
import styles from './Friends.module.css';

export function UserRow({ user, children, meta }) {
  return (
    <li className={styles.row}>
      <Link to={`/u/${user.handle}`} className={styles.identity}>
        <Avatar user={user} size="md" />
        <span className={styles.text}>
          <span className={styles.name}>{user.name}</span>
          <span className={styles.handle}>
            @{user.handle}
            {academicLine(user) ? <span className={styles.academic}>{academicLine(user)}</span> : null}
          </span>
          {meta ? <span className={styles.meta}>{meta}</span> : null}
        </span>
      </Link>
      {children ? <div className={styles.actions}>{children}</div> : null}
    </li>
  );
}
