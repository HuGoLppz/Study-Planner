import { LIMITS } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { sameId } from '../utils/ids.js';
import { normalizeText } from '../utils/text.js';
import { detachSubject } from './task.service.js';

function assertUniqueName(user, name, exceptId = null) {
  const target = normalizeText(name);
  const duplicate = user.subjects.some(
    (subject) => !sameId(subject._id, exceptId) && normalizeText(subject.name) === target,
  );
  if (duplicate) {
    throw ApiError.conflict('Ya tienes una asignatura con ese nombre', 'SUBJECT_DUPLICATE', {
      fields: { name: 'Ya tienes una asignatura con ese nombre' },
    });
  }
}

function findSubject(user, subjectId) {
  const subject = user.subjects.id(subjectId);
  if (!subject) throw ApiError.notFound('Esta asignatura no existe', 'SUBJECT_NOT_FOUND');
  return subject;
}

export async function createSubject(user, data) {
  if (user.subjects.length >= LIMITS.subjectsPerUser) {
    throw ApiError.conflict(`Has llegado al máximo de ${LIMITS.subjectsPerUser} asignaturas`, 'SUBJECT_LIMIT');
  }
  assertUniqueName(user, data.name);

  user.subjects.push(data);
  await user.save();
  return user.subjects.at(-1);
}

export async function updateSubject(user, subjectId, data) {
  const subject = findSubject(user, subjectId);
  if (data.name) assertUniqueName(user, data.name, subjectId);

  subject.set(data);
  await user.save();
  return subject;
}

export async function deleteSubject(user, subjectId) {
  const subject = findSubject(user, subjectId);
  subject.deleteOne();
  await user.save();
  await detachSubject(user._id, subjectId);
}
