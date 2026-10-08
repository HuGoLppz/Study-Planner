import {
  ChatCircleDots,
  DotsThree,
  PaperPlaneRight,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  useDeleteMessage,
  useEditMessage,
  useRoomMessages,
  useSendMessage,
} from "../../hooks/useRoomChat.js";
import { confirm } from "../../store/confirmStore.js";
import { formatDaySeparator, formatTime, sameDay } from "../../utils/dates.js";
import { Avatar } from "../ui/Avatar.jsx";
import { Button, IconButton } from "../ui/Button.jsx";
import { EmptyState, ErrorState, Skeleton } from "../ui/Feedback.jsx";
import { Menu } from "../ui/Menu.jsx";

const MAX_LENGTH = 2000;
const GROUP_WINDOW = 5 * 60 * 1000;

function Composer({ onSend, onTyping, disabled }) {
  const [value, setValue] = useState("");
  const ref = useRef(null);

  // Altura automática hasta 6 líneas.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    // scrollHeight no incluye los bordes: se suman para que no aparezca una barra de scroll.
    const borders = element.offsetHeight - element.clientHeight;
    element.style.height = `${Math.min(element.scrollHeight + borders, 160)}px`;
    element.style.overflowY =
      element.scrollHeight + borders > 160 ? "auto" : "hidden";
  }, [value]);

  const submit = () => {
    const body = value.trim();
    if (!body || disabled) return;
    setValue("");
    onSend(body, () => setValue(body));
  };

  return (
    <form
      className="chat-composer"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor="chat-input" className="visually-hidden">
        Escribe un mensaje
      </label>
      <textarea
        id="chat-input"
        ref={ref}
        rows={1}
        maxLength={MAX_LENGTH}
        value={value}
        placeholder="Escribe un mensaje"
        className="chat-input"
        onChange={(event) => {
          setValue(event.target.value);
          onTyping();
        }}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            submit();
          }
        }}
      />
      {value.length > MAX_LENGTH - 200 ? (
        <span className="chat-counter">{MAX_LENGTH - value.length}</span>
      ) : null}
      <IconButton
        icon={PaperPlaneRight}
        label="Enviar"
        variant="primary"
        weight="fill"
        type="submit"
        className="chat-send"
        disabled={!value.trim()}
      />
    </form>
  );
}

function Message({ message, own, grouped, canModerate, roomId }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const edit = useEditMessage(roomId);
  const remove = useDeleteMessage(roomId);

  const save = () => {
    const body = draft.trim();
    if (!body || body === message.body) return setEditing(false);
    edit.mutate(
      { messageId: message._id, body },
      { onSuccess: () => setEditing(false) },
    );
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "¿Eliminar este mensaje?",
      description: "Desaparecerá para toda la sala.",
      confirmLabel: "Eliminar",
      tone: "danger",
    });
    if (ok) remove.mutate(message._id);
  };

  const actions = [
    own
      ? {
          label: "Editar",
          icon: PencilSimple,
          onSelect: () => setEditing(true),
        }
      : null,
    own || canModerate
      ? {
          label: "Eliminar",
          icon: Trash,
          tone: "danger",
          onSelect: handleDelete,
        }
      : null,
  ].filter(Boolean);

  return (
    <li
      className={clsx(
        "chat-message",
        own && "chat-own",
        grouped && "chat-grouped",
      )}
    >
      {!own ? (
        <span className="chat-avatar-slot">
          {!grouped ? <Avatar user={message.author} size="sm" /> : null}
        </span>
      ) : null}
      <div className="chat-bubble-wrap">
        {!own && !grouped ? (
          <span className="chat-author">
            {message.author?.name ?? "Antiguo participante"}
          </span>
        ) : null}
        {editing ? (
          <div className="chat-edit-box">
            <textarea
              className="chat-input"
              value={draft}
              maxLength={MAX_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  save();
                }
                if (event.key === "Escape") setEditing(false);
              }}
              autoFocus
              aria-label="Editar mensaje"
            />
            <div className="chat-edit-actions">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={save} loading={edit.isPending}>
                Guardar
              </Button>
            </div>
          </div>
        ) : (
          <div className="chat-bubble-row">
            <p className="chat-bubble">{message.body}</p>
            {actions.length ? (
              <Menu
                align={own ? "end" : "start"}
                trigger={
                  <button
                    type="button"
                    className="chat-message-menu"
                    aria-label="Opciones del mensaje"
                  >
                    <DotsThree size={18} weight="bold" aria-hidden />
                  </button>
                }
                items={actions}
              />
            ) : null}
          </div>
        )}
        <span className="chat-time">
          <time dateTime={message.createdAt}>
            {formatTime(message.createdAt)}
          </time>
          {message.editedAt ? " (editado)" : ""}
        </span>
      </div>
    </li>
  );
}

export function ChatPanel({
  roomId,
  currentUserId,
  isAdmin,
  typing,
  onTyping,
}) {
  const {
    messages,
    isPending,
    isError,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useRoomMessages(roomId);
  const send = useSendMessage(roomId);
  const scroller = useRef(null);
  const nearBottom = useRef(true);
  const previousHeight = useRef(null);
  const lastId = messages.at(-1)?._id;

  // Al cargar o al llegar un mensaje nuevo, baja solo si ya estabas abajo (o si lo has enviado tú).
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    if (previousHeight.current != null) {
      element.scrollTop += element.scrollHeight - previousHeight.current;
      previousHeight.current = null;
      return;
    }
    const mine = messages.at(-1)?.author?._id === currentUserId;
    if (nearBottom.current || mine) element.scrollTop = element.scrollHeight;
  }, [lastId, messages, currentUserId]);

  useEffect(() => {
    nearBottom.current = true;
  }, [roomId]);

  const loadOlder = () => {
    previousHeight.current = scroller.current?.scrollHeight ?? null;
    fetchNextPage();
  };

  return (
    <div className="chat">
      <div
        ref={scroller}
        className="chat-scroller"
        onScroll={(event) => {
          const element = event.currentTarget;
          nearBottom.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            120;
        }}
        aria-live="polite"
        aria-relevant="additions"
      >
        {isPending ? (
          <div className="chat-loading">
            <Skeleton width="55%" height={36} radius={14} />
            <Skeleton
              width="40%"
              height={36}
              radius={14}
              style={{ marginLeft: "auto" }}
            />
            <Skeleton width="62%" height={36} radius={14} />
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} compact />
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <EmptyState
              icon={ChatCircleDots}
              title="Aún no hay mensajes"
              compact
            >
              Saluda a la sala o propón cómo repartir el trabajo.
            </EmptyState>
          </div>
        ) : (
          <>
            {hasNextPage ? (
              <Button
                variant="ghost"
                size="sm"
                className="chat-older"
                onClick={loadOlder}
                loading={isFetchingNextPage}
              >
                Cargar mensajes anteriores
              </Button>
            ) : (
              <p className="chat-start">Principio de la conversación</p>
            )}
            <ol className="chat-messages">
              {messages.map((message, index) => {
                const previous = messages[index - 1];
                const newDay =
                  !previous || !sameDay(previous.createdAt, message.createdAt);
                const grouped =
                  !newDay &&
                  previous.author?._id === message.author?._id &&
                  new Date(message.createdAt) - new Date(previous.createdAt) <
                    GROUP_WINDOW;
                return (
                  <Fragment key={message._id}>
                    {newDay ? (
                      <li className="chat-day-separator">
                        <span>{formatDaySeparator(message.createdAt)}</span>
                      </li>
                    ) : null}
                    <Message
                      message={message}
                      own={message.author?._id === currentUserId}
                      grouped={grouped}
                      canModerate={isAdmin}
                      roomId={roomId}
                    />
                  </Fragment>
                );
              })}
            </ol>
          </>
        )}
      </div>
      <p className="chat-typing" aria-live="polite">
        {typing.length === 1
          ? `${typing[0].name} está escribiendo…`
          : typing.length > 1
            ? "Varias personas están escribiendo…"
            : ""}
      </p>
      <Composer
        disabled={isPending}
        onTyping={onTyping}
        onSend={(body, restore) => send.mutate(body, { onError: restore })}
      />
    </div>
  );
}
