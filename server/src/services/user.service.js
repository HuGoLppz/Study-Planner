import path from 'node:path';
import { USER_SUMMARY_FIELDS } from '../config/constants.js';
import { User } from '../models/User.js';
import { serializeUserSummary } from '../serializers/user.serializer.js';
import { AVATAR_EXTENSION, AVATAR_MIME, toAvatarImage } from '../uploads/images.js';
import { fileExists, paths, removeFile, storeAvatar } from '../uploads/storage.js';
import { ApiError } from '../utils/ApiError.js';
import { sameId } from '../utils/ids.js';
import { escapeRegex, tokenize } from '../utils/text.js';
import { countFriends, relationshipMap } from './friend.service.js';
import { computeAcademicStats } from './grade.service.js';

export async function updateProfile(user, data) {
  if (data.handle && data.handle !== user.handle) {
    const taken = await User.exists({ handle: data.handle, _id: { $ne: user._id } });
    if (taken) {
      throw ApiError.conflict('Ese identificador ya está en uso', 'HANDLE_TAKEN', {
        fields: { handle: 'Ese identificador ya está en uso' },
      });
    }
  }
  user.set(data);
  return user.save();
}

export async function updatePrivacy(user, data) {
  user.set({ privacy: { ...user.privacy.toObject(), ...data } });
  return user.save();
}

export async function updatePreferences(user, data) {
  if (data.theme) user.preferences.theme = data.theme;
  return user.save();
}

// Búsqueda por identificador (@handle) o por nombre.
// El identificador exacto encuentra a cualquiera; el resto respeta "aparecer en búsquedas".
export async function searchUsers(viewer, { q, limit }) {
  const raw = q.trim();
  const handleQuery = raw.replace(/^@/, '').toLowerCase();
  const conditions = [];

  if (/^[a-z0-9._]{2,30}$/.test(handleQuery)) {
    conditions.push({ handle: handleQuery });
    conditions.push({ handle: { $regex: `^${escapeRegex(handleQuery)}` }, 'privacy.searchable': true });
  }

  const tokens = tokenize(raw);
  if (!raw.startsWith('@') && tokens.length > 0) {
    conditions.push({
      'privacy.searchable': true,
      searchTokens: { $all: tokens.map((token) => new RegExp(`^${escapeRegex(token)}`)) },
    });
  }
  if (conditions.length === 0) return [];

  const users = await User.find({ _id: { $ne: viewer._id }, $or: conditions })
    .select(`${USER_SUMMARY_FIELDS} studies course`)
    .limit(limit);

  const relationships = await relationshipMap(viewer._id, users.map((user) => user._id));

  return users
    .sort((a, b) => {
      if (a.handle === handleQuery) return -1;
      if (b.handle === handleQuery) return 1;
      return a.name.localeCompare(b.name, 'es');
    })
    .map((user) => ({
      ...serializeUserSummary(user),
      studies: user.studies,
      course: user.course,
      relationship: relationships.get(String(user._id)),
    }));
}

// Perfil visto por otra persona. La privacidad decide qué partes se incluyen.
export async function getProfile(viewer, handle) {
  const user = await User.findOne({ handle });
  if (!user) throw ApiError.notFound('No hay ningún estudiante con ese identificador', 'USER_NOT_FOUND');

  const isSelf = sameId(viewer._id, user._id);
  const relationship = isSelf
    ? { status: 'self' }
    : (await relationshipMap(viewer._id, [user._id])).get(String(user._id));

  const { profileVisibility, showGrades } = user.privacy;
  const canView =
    isSelf || profileVisibility === 'public' || (profileVisibility === 'friends' && relationship.status === 'friends');

  const profile = {
    ...serializeUserSummary(user),
    relationship,
    visibility: profileVisibility,
    restricted: !canView,
  };
  if (!canView) return profile;

  Object.assign(profile, {
    studies: user.studies,
    course: user.course,
    bio: user.bio,
    memberSince: user.createdAt,
    subjects: user.subjects.map((subject) => ({ _id: subject._id, name: subject.name, color: subject.color })),
    friendsCount: await countFriends(user._id),
  });

  if (isSelf || showGrades) {
    const stats = await computeAcademicStats(user);
    profile.stats = {
      average: stats.average,
      totals: stats.totals,
      bySubject: stats.bySubject
        .filter((row) => row.subject)
        .map(({ subject, average, progress, graded }) => ({ subject, average, progress, graded })),
    };
  }
  return profile;
}

// La foto se guarda ya optimizada (WebP 256×256 sin metadatos); el original nunca toca el disco.
export async function setAvatar(user, file) {
  const image = await toAvatarImage(file.buffer);
  const fileName = await storeAvatar(image, AVATAR_EXTENSION);
  const previous = user.avatar?.fileName;
  user.avatar = { fileName, mimeType: AVATAR_MIME, updatedAt: new Date() };

  try {
    await user.save();
  } catch (error) {
    await removeFile(path.join(paths.avatars(), fileName));
    throw error;
  }
  if (previous) await removeFile(path.join(paths.avatars(), previous));
  return user;
}

export async function removeAvatar(user) {
  const previous = user.avatar?.fileName;
  user.avatar = undefined;
  await user.save();
  if (previous) await removeFile(path.join(paths.avatars(), previous));
  return user;
}

export async function getAvatarFile(userId) {
  const user = await User.findById(userId).select('avatar');
  const fileName = user?.avatar?.fileName;
  if (!fileName) throw ApiError.notFound('Este estudiante no tiene foto');

  const filePath = path.join(paths.avatars(), path.basename(fileName));
  if (!(await fileExists(filePath))) throw ApiError.notFound('La foto ya no está disponible');
  return { filePath, mimeType: user.avatar.mimeType };
}
