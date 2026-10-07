import * as Dialog from '@radix-ui/react-dialog';
import { X } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useConfirmStore } from '../../store/confirmStore.js';
import { Button, IconButton } from './Button.jsx';
import styles from './Overlay.module.css';

function Frame({ open, onOpenChange, title, description, children, variant, size, hideTitle = false, headerExtra }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={clsx(styles.panel, styles[variant], size && styles[size])}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <span className={styles.grabber} aria-hidden />
          <header className={clsx(styles.header, hideTitle && styles.headerBare)}>
            <div className={styles.headings}>
              <Dialog.Title className={clsx(styles.title, hideTitle && 'visually-hidden')}>{title}</Dialog.Title>
              {description ? <Dialog.Description className={styles.description}>{description}</Dialog.Description> : null}
            </div>
            {headerExtra}
            <Dialog.Close asChild>
              <IconButton icon={X} label="Cerrar" />
            </Dialog.Close>
          </header>
          <div className={styles.body}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Modal centrado en escritorio; hoja inferior en móvil.
export function Modal({ size = 'md', ...props }) {
  return <Frame variant="modal" size={size} {...props} />;
}

// Panel lateral en escritorio; pantalla completa deslizante en móvil.
export function Drawer(props) {
  return <Frame variant="drawer" {...props} />;
}

// Pie fijo con las acciones del formulario de un modal o panel.
export function OverlayFooter({ children }) {
  return <div className={styles.footer}>{children}</div>;
}

export function ConfirmHost() {
  const request = useConfirmStore((state) => state.request);
  const answer = useConfirmStore((state) => state.answer);

  return (
    <Modal
      open={Boolean(request)}
      onOpenChange={(open) => !open && answer(false)}
      title={request?.title ?? ''}
      description={request?.description}
      size="sm"
    >
      <OverlayFooter>
        <Button variant="secondary" onClick={() => answer(false)}>
          {request?.cancelLabel ?? 'Cancelar'}
        </Button>
        <Button variant={request?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => answer(true)} autoFocus>
          {request?.confirmLabel ?? 'Confirmar'}
        </Button>
      </OverlayFooter>
    </Modal>
  );
}
