import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import clsx from "clsx";
import { useConfirmStore } from "../../store/confirmStore.js";
import { Button, IconButton } from "./Button.jsx";

function Frame({
  open,
  onOpenChange,
  title,
  description,
  children,
  variant,
  size,
  hideTitle = false,
  headerExtra,
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content
          className={clsx(
            "overlay-panel",
            `overlay-${variant}`,
            size && `overlay-${size}`,
          )}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <span className="overlay-grabber" aria-hidden />
          <header
            className={clsx(
              "overlay-header",
              hideTitle && "overlay-header-bare",
            )}
          >
            <div className="overlay-headings">
              <Dialog.Title
                className={clsx(
                  "overlay-title",
                  hideTitle && "visually-hidden",
                )}
              >
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="overlay-description">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            {headerExtra}
            <Dialog.Close asChild>
              <IconButton icon={X} label="Cerrar" />
            </Dialog.Close>
          </header>
          <div className="overlay-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Modal centrado en escritorio; hoja inferior en móvil.
export function Modal({ size = "md", ...props }) {
  return <Frame variant="modal" size={size} {...props} />;
}

// Panel lateral en escritorio; pantalla completa deslizante en móvil.
export function Drawer(props) {
  return <Frame variant="drawer" {...props} />;
}

// Pie fijo con las acciones del formulario de un modal o panel.
export function OverlayFooter({ children }) {
  return <div className="overlay-footer">{children}</div>;
}

export function ConfirmHost() {
  const request = useConfirmStore((state) => state.request);
  const answer = useConfirmStore((state) => state.answer);

  return (
    <Modal
      open={Boolean(request)}
      onOpenChange={(open) => !open && answer(false)}
      title={request?.title ?? ""}
      description={request?.description}
      size="sm"
    >
      <OverlayFooter>
        <Button variant="secondary" onClick={() => answer(false)}>
          {request?.cancelLabel ?? "Cancelar"}
        </Button>
        <Button
          variant={request?.tone === "danger" ? "danger" : "primary"}
          onClick={() => answer(true)}
          autoFocus
        >
          {request?.confirmLabel ?? "Confirmar"}
        </Button>
      </OverlayFooter>
    </Modal>
  );
}
