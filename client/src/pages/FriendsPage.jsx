import { MagnifyingGlass, UserPlus, UsersThree } from "@phosphor-icons/react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RelationshipAction } from "../components/friends/RelationshipAction.jsx";
import { UserRow } from "../components/friends/UserRow.jsx";
import { Button } from "../components/ui/Button.jsx";
import {
  EmptyState,
  ErrorState,
  SkeletonList,
} from "../components/ui/Feedback.jsx";
import { Field, Input } from "../components/ui/Form.jsx";
import { Page, PageHeader } from "../components/ui/Page.jsx";
import { TabPanel, Tabs } from "../components/ui/Tabs.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  useDeclineFriendRequest,
  useFriendRequests,
  useFriends,
  useUserSearch,
} from "../hooks/useFriends.js";
import { useDebouncedValue } from "../hooks/useUi.js";
import { formatAgo } from "../utils/dates.js";

const TABS = ["amigos", "solicitudes", "buscar"];

function FriendsList({ onSearch }) {
  const friends = useFriends();
  if (friends.isPending)
    return <SkeletonList rows={4} label="Cargando amigos" />;
  if (friends.isError)
    return <ErrorState error={friends.error} onRetry={friends.refetch} />;
  if (friends.data.length === 0) {
    return (
      <EmptyState
        icon={UsersThree}
        title="Todavía no tienes amigos añadidos"
        action={
          <Button icon={MagnifyingGlass} onClick={onSearch}>
            Buscar estudiantes
          </Button>
        }
      >
        Añade a tus compañeros para invitarles a salas de estudio y ver sus
        perfiles.
      </EmptyState>
    );
  }
  return (
    <ul className="friends-list">
      {friends.data.map((friend) => (
        <UserRow
          key={friend._id}
          user={friend}
          meta={`Amigos ${formatAgo(friend.friendsSince).replace("hace", "desde hace")}`}
        >
          <RelationshipAction
            user={friend}
            relationship={{ status: "friends" }}
          />
        </UserRow>
      ))}
    </ul>
  );
}

function RequestsList() {
  const requests = useFriendRequests();
  const decline = useDeclineFriendRequest();
  if (requests.isPending)
    return <SkeletonList rows={3} label="Cargando solicitudes" />;
  if (requests.isError)
    return <ErrorState error={requests.error} onRetry={requests.refetch} />;

  const { incoming, outgoing } = requests.data;
  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <EmptyState icon={UserPlus} title="No hay solicitudes pendientes">
        Cuando alguien quiera añadirte, podrás aceptarle desde aquí o desde tus
        avisos.
      </EmptyState>
    );
  }
  return (
    <>
      {incoming.length ? (
        <>
          <h2 className="friends-subheading">Te han enviado</h2>
          <ul className="friends-list">
            {incoming.map((request) => (
              <UserRow
                key={request._id}
                user={request.user}
                meta={`Enviada ${formatAgo(request.createdAt)}`}
              >
                <RelationshipAction
                  user={request.user}
                  relationship={{
                    status: "request_received",
                    requestId: request._id,
                  }}
                />
              </UserRow>
            ))}
          </ul>
        </>
      ) : null}
      {outgoing.length ? (
        <>
          <h2 className="friends-subheading">Has enviado</h2>
          <ul className="friends-list">
            {outgoing.map((request) => (
              <UserRow
                key={request._id}
                user={request.user}
                meta={`Enviada ${formatAgo(request.createdAt)}`}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => decline.mutate(request._id)}
                >
                  Retirar
                </Button>
              </UserRow>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

function SearchPanel() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const term = useDebouncedValue(query, 300);
  const search = useUserSearch(term);
  const ready = term.trim().replace(/^@/, "").length >= 2;

  return (
    <>
      <Field
        label="Buscar estudiantes"
        hideLabel
        className="friends-search-box"
        hint={`Busca por nombre o por identificador. El tuyo es @${user.handle}.`}
      >
        <Input
          type="search"
          icon={MagnifyingGlass}
          placeholder="Nombre o @identificador"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />
      </Field>
      {!ready ? null : search.isPending ? (
        <SkeletonList rows={3} label="Buscando" />
      ) : search.isError ? (
        <ErrorState error={search.error} onRetry={search.refetch} />
      ) : search.data.length === 0 ? (
        <EmptyState
          icon={MagnifyingGlass}
          title={`Nadie coincide con «${term.trim()}»`}
          compact
        >
          Si la persona ha ocultado su nombre de las búsquedas, prueba con su
          identificador exacto.
        </EmptyState>
      ) : (
        <ul className="friends-list">
          {search.data.map((result) => (
            <UserRow key={result._id} user={result}>
              <RelationshipAction
                user={result}
                relationship={result.relationship}
              />
            </UserRow>
          ))}
        </ul>
      )}
    </>
  );
}

export default function FriendsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "amigos";
  const { data: friends } = useFriends();
  const { data: requests } = useFriendRequests();
  const setTab = (value) =>
    setParams(value === "amigos" ? {} : { tab: value }, { replace: true });

  return (
    <Page title="Amigos" width="narrow">
      <PageHeader
        title="Amigos"
        lead="Tus compañeros de estudio. Con ellos puedes crear salas y compartir archivos."
      />
      <Tabs
        value={tab}
        onValueChange={setTab}
        label="Secciones de amigos"
        tabs={[
          {
            value: "amigos",
            label: "Tus amigos",
            count: friends?.length || null,
          },
          {
            value: "solicitudes",
            label: "Solicitudes",
            count: requests?.incoming.length || null,
          },
          { value: "buscar", label: "Buscar" },
        ]}
      >
        <TabPanel value="amigos">
          <FriendsList onSearch={() => setTab("buscar")} />
        </TabPanel>
        <TabPanel value="solicitudes">
          <RequestsList />
        </TabPanel>
        <TabPanel value="buscar">
          <SearchPanel />
        </TabPanel>
      </Tabs>
    </Page>
  );
}
