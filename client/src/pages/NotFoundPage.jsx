import { MapTrifold } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button.jsx";
import { EmptyState } from "../components/ui/Feedback.jsx";
import { Page } from "../components/ui/Page.jsx";

export default function NotFoundPage() {
  return (
    <Page title="Página no encontrada" width="narrow">
      <EmptyState
        icon={MapTrifold}
        title="Esta página no existe"
        action={
          <Button as={Link} to="/">
            Volver a Hoy
          </Button>
        }
      >
        Puede que el enlace esté mal escrito o que la página se haya movido.
      </EmptyState>
    </Page>
  );
}
