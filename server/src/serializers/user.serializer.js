// Qué se expone de un usuario según quién mira. Los resúmenes solo llevan lo que cualquier
// usuario autenticado puede ver (nombre, identificador y foto).

const avatarOf = (user) =>
  user?.avatar?.updatedAt ? { updatedAt: user.avatar.updatedAt } : null;

export function serializeUserSummary(user) {
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name,
    handle: user.handle,
    avatar: avatarOf(user),
  };
}

export function serializeSelf(user) {
  return {
    ...serializeUserSummary(user),
    email: user.email,
    studies: user.studies,
    course: user.course,
    bio: user.bio,
    privacy: {
      profileVisibility: user.privacy?.profileVisibility ?? "friends",
      searchable: user.privacy?.searchable ?? true,
      showGrades: user.privacy?.showGrades ?? false,
    },
    preferences: {
      theme: user.preferences?.theme ?? "system",
      pomodoro: user.preferences?.pomodoro,
    },
    subjects: (user.subjects ?? []).map(serializeSubject),
    createdAt: user.createdAt,
  };
}

export function serializeSubject(subject) {
  return {
    _id: subject._id,
    name: subject.name,
    description: subject.description,
    color: subject.color,
    createdAt: subject.createdAt,
    updatedAt: subject.updatedAt,
  };
}
