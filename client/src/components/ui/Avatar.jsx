import clsx from "clsx";
import { useState } from "react";
import { avatarUrl, initials } from "../../utils/users.js";

const SIZES = { xs: 24, sm: 32, md: 40, lg: 64, xl: 112 };
const FILLS = [
  "yellow",
  "pink",
  "green",
  "orange",
  "blue",
  "lilac",
  "mint",
  "coral",
];

// Color estable por usuario para las iniciales.
function fillFor(id = "") {
  let hash = 0;
  for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FILLS[hash % FILLS.length];
}

export function Avatar({ user, size = "md", className, src }) {
  const url = src ?? avatarUrl(user);
  const [failedUrl, setFailedUrl] = useState(null);
  const failed = failedUrl === url;
  const setFailed = () => setFailedUrl(url);
  const px = SIZES[size];

  return (
    <span
      className={clsx("avatar", className)}
      style={{
        width: px,
        height: px,
        fontSize: Math.round(px * 0.4),
        "--avatar-fill": `var(--hl-${fillFor(user?._id)})`,
      }}
      aria-hidden
    >
      {url && !failed ? (
        <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        initials(user?.name ?? "")
      )}
    </span>
  );
}

export function AvatarStack({ users = [], max = 4, size = "sm", total }) {
  const shown = users.slice(0, max);
  const rest = (total ?? users.length) - shown.length;
  return (
    <span className="avatar-stack">
      {shown.map((user) => (
        <Avatar
          key={user._id}
          user={user}
          size={size}
          className="avatar-stacked"
        />
      ))}
      {rest > 0 ? (
        <span
          className={clsx("avatar", "avatar-stacked", "avatar-more")}
          style={{ width: SIZES[size], height: SIZES[size] }}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
