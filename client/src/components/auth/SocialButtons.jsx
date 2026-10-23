import { AppleLogo } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useOAuthProviders } from "../../hooks/useOAuth.js";
import { renderGoogleButton, signInWithApple } from "../../utils/oauth.js";
import { Button } from "../ui/Button.jsx";

// Botón oficial de Google. `onCredential` recibe el id_token; `onError`, un fallo al cargar el script.
export function GoogleButton({ clientId, text, onCredential, onError }) {
  const ref = useRef(null);
  const latest = useRef({ onCredential, onError });
  latest.current = { onCredential, onError };

  useEffect(() => {
    let cancelled = false;
    let cleanup = null;
    renderGoogleButton(ref.current, {
      clientId,
      text,
      onCredential: (credential) => latest.current.onCredential(credential),
    })
      .then((remove) => {
        if (cancelled) remove();
        else cleanup = remove;
      })
      .catch((error) => {
        if (!cancelled) latest.current.onError?.(error);
      });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [clientId, text]);

  return <div ref={ref} className="auth-social-google" />;
}

export function AppleButton({
  clientId,
  label,
  onCredential,
  onError,
  variant = "secondary",
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={variant}
      size="lg"
      block
      icon={AppleLogo}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const credential = await signInWithApple(clientId);
          if (credential) await onCredential(credential);
        } catch (error) {
          onError?.(error);
        } finally {
          setBusy(false);
        }
      }}
    >
      {label}
    </Button>
  );
}

// Accesos con Google y Apple bajo el formulario de entrada. No sale nada si el servidor no tiene
// ningún proveedor configurado.
export function SocialLogin({ onCredential, onError }) {
  const { data } = useOAuthProviders();
  const providers = data ?? [];
  if (providers.length === 0) return null;

  return (
    <div className="auth-social">
      <p className="auth-social-divider">o entra con</p>
      {providers.map(({ provider, clientId }) =>
        provider === "google" ? (
          <GoogleButton
            key={provider}
            clientId={clientId}
            text="signin_with"
            onCredential={(credential) => onCredential(provider, credential)}
            onError={onError}
          />
        ) : (
          <AppleButton
            key={provider}
            clientId={clientId}
            label="Entrar con Apple"
            onCredential={(credential) => onCredential(provider, credential)}
            onError={onError}
          />
        ),
      )}
    </div>
  );
}
