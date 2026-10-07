import { hashPassword, verifyPassword } from '../auth/password.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { generateUniqueHandle } from './handle.service.js';

export async function registerUser({ name, email, password, studies, course, bio }) {
  if (await User.exists({ email })) {
    throw ApiError.conflict('Ya existe una cuenta con ese correo', 'EMAIL_TAKEN', {
      fields: { email: 'Ya existe una cuenta con ese correo' },
    });
  }

  const [handle, passwordHash] = await Promise.all([generateUniqueHandle(name), hashPassword(password)]);
  return User.create({ name, email, passwordHash, handle, studies, course, bio });
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion');
  const valid = await verifyPassword(password, user?.passwordHash);

  if (!user || !valid) {
    throw ApiError.unauthorized('El correo o la contraseña no son correctos', 'INVALID_CREDENTIALS');
  }
  return user;
}

// Cambiar la contraseña invalida todas las sesiones abiertas (tokenVersion).
export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash +tokenVersion');
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw ApiError.unprocessable('La contraseña actual no es correcta', {
      currentPassword: 'La contraseña actual no es correcta',
    });
  }

  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion += 1;
  await user.save();
  return user;
}
