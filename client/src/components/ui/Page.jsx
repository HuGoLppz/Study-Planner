import clsx from "clsx";
import { useDocumentTitle } from "../../hooks/useUi.js";

// Contenedor de página: fija el título de la pestaña y el ancho de lectura.
export function Page({ title, width = "wide", className, children }) {
  useDocumentTitle(title);
  return (
    <div className={clsx("page", `page-${width}`, className)}>{children}</div>
  );
}

export function PageHeader({ title, lead, actions, children }) {
  return (
    <header className="page-header">
      <div className="page-headings">
        <h1 className="page-title">{title}</h1>
        {lead ? <p className="page-lead">{lead}</p> : null}
        {children}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Section({
  title,
  action,
  children,
  className,
  id,
  description,
}) {
  return (
    <section
      className={clsx("page-section", className)}
      aria-labelledby={id ? `${id}-title` : undefined}
    >
      {title ? (
        <header className="page-section-header">
          <div>
            <h2 id={id ? `${id}-title` : undefined} className="section-title">
              {title}
            </h2>
            {description ? (
              <p className="page-section-description">{description}</p>
            ) : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}
