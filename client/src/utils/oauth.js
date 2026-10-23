// Carga y uso de los scripts de Google y Apple para iniciar sesión. Ambos devuelven un id_token (JWT)
// que el servidor verifica: aquí no se decide nada de seguridad, solo se consigue el token.

const SCRIPTS = {
  google: "https://accounts.google.com/gsi/client",
  apple:
    "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/es_ES/appleid.auth.js",
};
const LABELS = { google: "Google", apple: "Apple" };

const loading = new Map();

function loadScript(provider) {
  if (!loading.has(provider)) {
    loading.set(
      provider,
      new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = SCRIPTS[provider];
        script.async = true;
        script.onload = resolve;
        script.onerror = () => {
          loading.delete(provider);
          script.remove();
          reject(
            new Error(
              `No se ha podido cargar el acceso con ${LABELS[provider]}. Comprueba tu conexión o los bloqueadores de contenido.`,
            ),
          );
        };
        document.head.append(script);
      }),
    );
  }
  return loading.get(provider);
}

// --------------------------------------------------------------------------- Google

// Google solo admite un initialize por página: la función que recibe el token se cambia por botón.
let googleClientId = null;
let googleHandler = null;
// Último dibujo de cada contenedor: si React lo monta dos veces (modo estricto), solo el último
// puede borrarlo.
const lastRender = new WeakMap();

// Dibuja el botón oficial de Google dentro de `element`. Devuelve una función que lo retira.
export async function renderGoogleButton(
  element,
  { clientId, text = "signin_with", onCredential },
) {
  await loadScript("google");
  const accounts = window.google?.accounts?.id;
  if (!accounts) throw new Error("El acceso con Google no está disponible.");

  const renderId = Symbol();
  lastRender.set(element, renderId);
  googleHandler = onCredential;
  if (googleClientId !== clientId) {
    googleClientId = clientId;
    accounts.initialize({
      client_id: clientId,
      callback: ({ credential }) => googleHandler?.(credential),
    });
  }
  const dark = document.documentElement.dataset.theme === "dark";
  accounts.renderButton(element, {
    type: "standard",
    theme: dark ? "filled_black" : "outline",
    size: "large",
    shape: "rectangular",
    text,
    logo_alignment: "left",
    locale: "es",
    // Google solo admite hasta 400 px de ancho.
    width: Math.min(400, Math.max(200, element.clientWidth || 320)),
  });
  return () => {
    if (lastRender.get(element) !== renderId) return;
    if (googleHandler === onCredential) googleHandler = null;
    element.replaceChildren();
  };
}

// --------------------------------------------------------------------------- Apple

// Abre la ventana de Apple y devuelve el id_token. Apple exige HTTPS y un dominio registrado.
export async function signInWithApple(clientId) {
  await loadScript("apple");
  const auth = window.AppleID?.auth;
  if (!auth) throw new Error("El acceso con Apple no está disponible.");

  auth.init({
    clientId,
    scope: "name email",
    redirectURI: window.location.origin,
    usePopup: true,
  });
  try {
    const result = await auth.signIn();
    return result.authorization.id_token;
  } catch (error) {
    if (error?.error === "popup_closed_by_user") return null;
    throw new Error("No se ha podido iniciar sesión con Apple.");
  }
}
