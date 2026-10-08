import { Link } from "react-router-dom";
import { academicLine } from "../../utils/users.js";
import { Avatar } from "../ui/Avatar.jsx";

export function UserRow({ user, children, meta }) {
  return (
    <li className="friends-row">
      <Link to={`/u/${user.handle}`} className="friends-identity">
        <Avatar user={user} size="md" />
        <span className="friends-text">
          <span className="friends-name">{user.name}</span>
          <span className="friends-handle">
            @{user.handle}
            {academicLine(user) ? (
              <span className="friends-academic">{academicLine(user)}</span>
            ) : null}
          </span>
          {meta ? <span className="friends-meta">{meta}</span> : null}
        </span>
      </Link>
      {children ? <div className="friends-actions">{children}</div> : null}
    </li>
  );
}
