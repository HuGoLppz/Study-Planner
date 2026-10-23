import { createRemoteJWKSet, jwtVerify } from "jose";
import { OAUTH_PROVIDERS } from "../config/constants.js";
import { env } from "../config/env.js";
import { sql } from "../database/db.js";
import { loadUser } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";

// Inicio de sesión y vinculación con Google y Apple mediante su id_token (JWT firmado). El servidor
// comprueba la firma con las claves públicas del proveedor, el emisor, la audiencia (nuestro ID de
// cliente) y la caducidad: no se confía en nada que mande el navegador salvo el token. Con el
// sujeto (sub) del token se identifica a la persona; el correo solo se guarda para mostrarlo.

export const PROVIDERS = {
  google: {
    label: "Google",
    jwks: "https://www.googleapis.com/oauth2/v3/certs",
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  },
  apple: {
    label: "Apple",
    jwks: "https://appleid.apple.com/auth/keys",
    issuer: "https://appleid.apple.com",
  },
};

// Verificador de un proveedor. Las claves se descargan una vez y se guardan en caché (jose).
export function createVerifier({ jwks, issuer, clientId }) {
  const keys = createRemoteJWKSet(new URL(jwks));
  return async (credential) => {
    try {
      const { payload } = await jwtVerify(credential, keys, {
        issuer,
        audience: clientId,
        clockTolerance: 5,
      });
      if (typeof payload.sub !== "string" || !payload.sub) throw new Error();
      return {
        subject: payload.sub,
        email:
          typeof payload.email === "string"
            ? payload.email.toLowerCase().slice(0, 254)
            : null,
      };
    } catch {
      throw ApiError.unauthorized(
        "No se ha podido verificar la cuenta. Vuelve a intentarlo.",
        "OAUTH_INVALID_TOKEN",
      );
    }
  };
}

const verifiers = new Map();
function verifierFor(provider) {
  const config = env.oauth[provider];
  if (!OAUTH_PROVIDERS.includes(provider) || !config) {
    throw ApiError.notFound(
      "Este método de acceso no está disponible",
      "OAUTH_DISABLED",
    );
  }
  if (!verifiers.has(provider)) {
    verifiers.set(
      provider,
      createVerifier({ ...PROVIDERS[provider], clientId: config.clientId }),
    );
  }
  return verifiers.get(provider);
}

// Proveedores activados y lo que el navegador necesita para mostrar sus botones.
export function publicProviders() {
  return OAUTH_PROVIDERS.filter((provider) => env.oauth[provider]).map(
    (provider) => ({ provider, clientId: env.oauth[provider].clientId }),
  );
}

export async function loginWithProvider(provider, credential) {
  const { subject } = await verifierFor(provider)(credential);
  const row = await sql(
    "SELECT usuario_id FROM Cuentas_Externas WHERE proveedor = ? AND sujeto = ?",
  ).get(provider, subject);
  if (!row) {
    throw ApiError.unauthorized(
      `Esta cuenta de ${PROVIDERS[provider].label} no está vinculada a ninguna cuenta. Entra con tu correo y vincúlala desde tu perfil.`,
      "OAUTH_NOT_LINKED",
    );
  }
  return loadUser(row.usuario_id);
}

export async function linkAccount(userId, provider, credential) {
  const { subject, email } = await verifierFor(provider)(credential);
  const label = PROVIDERS[provider].label;

  const owner = await sql(
    "SELECT usuario_id FROM Cuentas_Externas WHERE proveedor = ? AND sujeto = ?",
  ).get(provider, subject);
  if (owner) {
    throw ApiError.conflict(
      owner.usuario_id === userId
        ? `Tu cuenta de ${label} ya está vinculada`
        : `Esa cuenta de ${label} ya está vinculada a otro usuario`,
      "OAUTH_ALREADY_LINKED",
    );
  }
  if (
    await sql(
      "SELECT 1 FROM Cuentas_Externas WHERE usuario_id = ? AND proveedor = ?",
    ).get(userId, provider)
  ) {
    throw ApiError.conflict(
      `Ya tienes una cuenta de ${label} vinculada. Desvincúlala antes de añadir otra.`,
      "OAUTH_PROVIDER_IN_USE",
    );
  }

  // Dos vinculaciones a la vez chocan con los índices únicos: se responde igual que arriba.
  try {
    const row = await sql(
      `INSERT INTO Cuentas_Externas (usuario_id, proveedor, sujeto, email)
       VALUES (?, ?, ?, ?) RETURNING fecha_vinculacion`,
    ).get(userId, provider, subject, email);
    return { provider, email, linkedAt: row.fecha_vinculacion };
  } catch (error) {
    if (error.code === "23505") {
      throw ApiError.conflict(
        `Esa cuenta de ${label} ya está vinculada`,
        "OAUTH_ALREADY_LINKED",
      );
    }
    throw error;
  }
}

export async function unlinkAccount(userId, provider) {
  const { changes } = await sql(
    "DELETE FROM Cuentas_Externas WHERE usuario_id = ? AND proveedor = ?",
  ).run(userId, provider);
  if (!changes) {
    throw ApiError.notFound(
      "No hay ninguna cuenta vinculada de ese proveedor",
      "OAUTH_NOT_LINKED",
    );
  }
}

export async function listLinks(userId) {
  const rows = await sql(
    `SELECT proveedor, email, fecha_vinculacion
       FROM Cuentas_Externas WHERE usuario_id = ? ORDER BY proveedor`,
  ).all(userId);
  return rows.map((row) => ({
    provider: row.proveedor,
    email: row.email,
    linkedAt: row.fecha_vinculacion,
  }));
}
