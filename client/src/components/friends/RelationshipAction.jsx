import {
  CaretDown,
  Check,
  UserMinus,
  UserPlus,
  X,
} from "@phosphor-icons/react";
import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useRemoveFriend,
  useSendFriendRequest,
} from "../../hooks/useFriends.js";
import { confirm } from "../../store/confirmStore.js";
import { firstName } from "../../utils/users.js";
import { Button } from "../ui/Button.jsx";
import { Menu } from "../ui/Menu.jsx";

// Acción principal según la relación con ese estudiante.
export function RelationshipAction({ user, relationship, size = "sm" }) {
  const send = useSendFriendRequest();
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();
  const remove = useRemoveFriend();
  const status = relationship?.status ?? "none";

  if (status === "self") return null;

  if (status === "friends") {
    return (
      <Menu
        trigger={
          <Button variant="secondary" size={size} icon={Check}>
            Amigos{" "}
            <CaretDown size={12} aria-hidden style={{ display: "inline" }} />
          </Button>
        }
        items={[
          {
            label: "Eliminar de amigos",
            icon: UserMinus,
            tone: "danger",
            onSelect: async () => {
              const ok = await confirm({
                title: `¿Eliminar a ${firstName(user.name)} de tus amigos?`,
                description:
                  "Podréis volver a añadiros más adelante. Las salas que compartís no cambian.",
                confirmLabel: "Eliminar",
                tone: "danger",
              });
              if (ok) remove.mutate(user._id);
            },
          },
        ]}
      />
    );
  }

  if (status === "request_sent") {
    return (
      <Button
        variant="secondary"
        size={size}
        icon={X}
        onClick={() => decline.mutate(relationship.requestId)}
        loading={decline.isPending}
      >
        Retirar solicitud
      </Button>
    );
  }

  if (status === "request_received") {
    return (
      <>
        <Button
          size={size}
          onClick={() => accept.mutate(relationship.requestId)}
          loading={accept.isPending}
        >
          Aceptar
        </Button>
        <Button
          variant="secondary"
          size={size}
          onClick={() => decline.mutate(relationship.requestId)}
          loading={decline.isPending}
        >
          Rechazar
        </Button>
      </>
    );
  }

  return (
    <Button
      size={size}
      icon={UserPlus}
      onClick={() => send.mutate(user._id)}
      loading={send.isPending}
    >
      Añadir amigo
    </Button>
  );
}
