import sharp from 'sharp';
import { ApiError } from '../utils/ApiError.js';

// La foto de perfil se muestra como mucho a 112 px (224 px en pantallas de alta densidad).
export const AVATAR_SIZE = 256;
export const AVATAR_MIME = 'image/webp';
export const AVATAR_EXTENSION = '.webp';

// Evita imágenes trampa que ocupan poco comprimidas y muchísimo al descomprimirse.
const MAX_INPUT_PIXELS = 50_000_000;

// Recorta en cuadrado centrando lo más relevante, respeta la orientación de la cámara y guarda
// en WebP sin metadatos (EXIF, GPS, perfil de cámara). Resultado típico: 5–20 KB.
export async function toAvatarImage(buffer) {
  try {
    return await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: sharp.strategy.attention })
      .webp({ quality: 72, effort: 5, smartSubsample: true })
      .toBuffer();
  } catch {
    throw ApiError.unprocessable('No se ha podido procesar la imagen. Prueba con otra foto.', {
      avatar: 'La imagen está dañada o es demasiado grande',
    }, 'IMAGE_UNREADABLE');
  }
}
