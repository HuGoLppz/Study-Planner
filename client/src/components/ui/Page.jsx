import clsx from 'clsx';
import { useDocumentTitle } from '../../hooks/useUi.js';
import styles from './Page.module.css';

// Contenedor de página: fija el título de la pestaña y el ancho de lectura.
export function Page({ title, width = 'wide', className, children }) {
  useDocumentTitle(title);
  return <div className={clsx(styles.page, styles[width], className)}>{children}</div>;
}

export function PageHeader({ title, lead, actions, children }) {
  return (
    <header className={styles.header}>
      <div className={styles.headings}>
        <h1 className="page-title">{title}</h1>
        {lead ? <p className={styles.lead}>{lead}</p> : null}
        {children}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}

export function Section({ title, action, children, className, id, description }) {
  return (
    <section className={clsx(styles.section, className)} aria-labelledby={id ? `${id}-title` : undefined}>
      {title ? (
        <header className={styles.sectionHeader}>
          <div>
            <h2 id={id ? `${id}-title` : undefined} className="section-title">
              {title}
            </h2>
            {description ? <p className={styles.sectionDescription}>{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}
