-- =====================================================================================
-- STUDY-PLANNER: esquema relacional (PostgreSQL 14 o superior)
--
-- Se aplica al arrancar el servidor (database/db.js) y es idempotente: CREATE … IF NOT EXISTS
-- y CREATE OR REPLACE para funciones y triggers. Describe siempre el esquema completo y actual;
-- los cambios sobre bases existentes van además en database/migrations.js.
--
-- Convenciones:
--   * Los nombres sin comillas: PostgreSQL los guarda en minúsculas (Usuarios → usuarios).
--   * Fechas: timestamptz. La API las recibe y devuelve en ISO 8601 UTC (ver database/db.js).
--   * Usuarios y salas usan un identificador público de 9 caracteres (se genera en
--     utils/ids.js); el resto, integer autoincremental (identity).
--   * Los valores de los CHECK son los de config/constants.js: si cambias uno, cambia el otro.
--   * Los errores de las reglas de los triggers usan SQLSTATE P0001 (la API responde 409).
-- =====================================================================================

-- Búsquedas sin tildes (unaccent) y por trozos de palabra con índice (pg_trgm).
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- normalizar(texto): minúsculas y sin tildes, para buscar "calculo" y encontrar "Cálculo".
CREATE OR REPLACE FUNCTION normalizar(texto text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, coalesce(texto, ''))) $$;

-- USUARIOS ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Usuarios (
    usuario_id          text PRIMARY KEY CHECK (char_length(usuario_id) = 9),
    nombre              text NOT NULL CHECK (char_length(nombre) BETWEEN 2 AND 80),
    nombre_busqueda     text NOT NULL,                       -- nombre en minúsculas y sin tildes
    email               text NOT NULL UNIQUE CHECK (char_length(email) <= 254 AND email = lower(email)),
    password            text NOT NULL,                       -- hash bcrypt, nunca la contraseña
    version_sesion      integer NOT NULL DEFAULT 0,          -- al cambiar la contraseña, invalida sesiones
    identificador       text NOT NULL UNIQUE CHECK (char_length(identificador) BETWEEN 3 AND 30),
    foto_perfil         text,                                -- archivo de la foto (WebP)
    foto_actualizada    timestamptz,
    descripcion         text NOT NULL DEFAULT '' CHECK (char_length(descripcion) <= 500),
    curso               text NOT NULL DEFAULT '' CHECK (char_length(curso) <= 40),
    estudios            text NOT NULL DEFAULT '' CHECK (char_length(estudios) <= 120),
    visibilidad_perfil  text NOT NULL DEFAULT 'friends' CHECK (visibilidad_perfil IN ('public', 'friends', 'private')),
    buscable            boolean NOT NULL DEFAULT true,
    mostrar_notas       boolean NOT NULL DEFAULT false,
    tema                text NOT NULL DEFAULT 'system' CHECK (tema IN ('system', 'light', 'dark')),
    fecha_registro      timestamptz NOT NULL DEFAULT now(),
    fecha_actualizacion timestamptz NOT NULL DEFAULT now(),
    CHECK ((foto_perfil IS NULL) = (foto_actualizada IS NULL))
);
-- Búsqueda de personas: trigramas sobre el nombre normalizado (con un espacio delante, para buscar
-- principios de palabra con LIKE '% pal%') y sobre el identificador.
CREATE INDEX IF NOT EXISTS ix_usuarios_nombre_trgm ON Usuarios USING gin ((' ' || nombre_busqueda) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_usuarios_identificador_trgm ON Usuarios USING gin (identificador gin_trgm_ops);

-- Ajustes del temporizador (1:1 con el usuario; se crean al registrarse).
CREATE TABLE IF NOT EXISTS Ajustes_Pomodoro (
    usuario_id             text PRIMARY KEY REFERENCES Usuarios(usuario_id) ON DELETE CASCADE ON UPDATE CASCADE,
    minutos_trabajo        integer NOT NULL DEFAULT 25 CHECK (minutos_trabajo BETWEEN 1 AND 120),
    minutos_descanso       integer NOT NULL DEFAULT 5 CHECK (minutos_descanso BETWEEN 1 AND 60),
    minutos_descanso_largo integer NOT NULL DEFAULT 15 CHECK (minutos_descanso_largo BETWEEN 1 AND 90),
    ciclos_descanso_largo  integer NOT NULL DEFAULT 4 CHECK (ciclos_descanso_largo BETWEEN 1 AND 12)
);

-- CUENTAS EXTERNAS ----------------------------------------------------------------------
-- Cuentas de Google o Apple vinculadas a un usuario para iniciar sesión con ellas. 'sujeto' es el
-- identificador estable que da el proveedor (claim sub), no el correo, que puede cambiar. Cada
-- cuenta externa pertenece a un solo usuario y cada usuario tiene como mucho una por proveedor.
CREATE TABLE IF NOT EXISTS Cuentas_Externas (
    cuenta_id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id        text NOT NULL REFERENCES Usuarios(usuario_id) ON DELETE CASCADE ON UPDATE CASCADE,
    proveedor         text NOT NULL CHECK (proveedor IN ('google', 'apple')),
    sujeto            text NOT NULL CHECK (char_length(sujeto) BETWEEN 1 AND 255),
    email             text CHECK (char_length(email) <= 254),
    fecha_vinculacion timestamptz NOT NULL DEFAULT now(),
    UNIQUE (proveedor, sujeto),
    UNIQUE (usuario_id, proveedor)
);

-- AMIGOS --------------------------------------------------------------------------------
-- Una fila por pareja: usuario_id envía la solicitud y amigo_id la recibe. Al aceptarla pasa
-- a 'accepted'. El índice único sobre (menor, mayor) impide dos filas para la misma pareja
-- aunque cada uno envíe una solicitud al otro a la vez.
CREATE TABLE IF NOT EXISTS Amigos (
    amistad_id      integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id      text NOT NULL REFERENCES Usuarios(usuario_id) ON DELETE CASCADE ON UPDATE CASCADE,
    amigo_id        text NOT NULL REFERENCES Usuarios(usuario_id) ON DELETE CASCADE ON UPDATE CASCADE,
    estado          text NOT NULL DEFAULT 'pending' CHECK (estado IN ('pending', 'accepted')),
    fecha_solicitud timestamptz NOT NULL DEFAULT now(),
    fecha_amistad   timestamptz,
    CHECK (usuario_id <> amigo_id),
    CHECK ((estado = 'accepted') = (fecha_amistad IS NOT NULL))
);
-- COLLATE "C": orden por código de carácter, igual que el que calcula friend.service.js.
CREATE UNIQUE INDEX IF NOT EXISTS ux_amigos_pareja
    ON Amigos (LEAST(usuario_id COLLATE "C", amigo_id COLLATE "C"), GREATEST(usuario_id COLLATE "C", amigo_id COLLATE "C"));
CREATE INDEX IF NOT EXISTS ix_amigos_usuario ON Amigos (usuario_id, estado);
CREATE INDEX IF NOT EXISTS ix_amigos_amigo ON Amigos (amigo_id, estado);

-- ASIGNATURAS ---------------------------------------------------------------------------
-- Cada estudiante crea las suyas con su propio color: pertenecen a un único usuario (1:N).
CREATE TABLE IF NOT EXISTS Asignaturas (
    asignatura_id       integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id          text NOT NULL REFERENCES Usuarios(usuario_id) ON DELETE CASCADE ON UPDATE CASCADE,
    nombre_asignatura   text NOT NULL CHECK (char_length(nombre_asignatura) BETWEEN 1 AND 60),
    nombre_normalizado  text NOT NULL,                       -- para impedir duplicados con otras tildes
    color               text NOT NULL CHECK (color IN ('yellow', 'pink', 'green', 'orange', 'blue', 'lilac', 'mint', 'coral')),
    descripcion         text NOT NULL DEFAULT '' CHECK (char_length(descripcion) <= 300),
    fecha_creacion      timestamptz NOT NULL DEFAULT now(),
    fecha_actualizacion timestamptz NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, nombre_normalizado)
);

-- TAREAS --------------------------------------------------------------------------------
-- "Atrasada" no se guarda: estado <> 'completed' AND fecha_entrega < ahora.
CREATE TABLE IF NOT EXISTS Tareas (
    tarea_id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id           text NOT NULL REFERENCES Usuarios(usuario_id) ON DELETE CASCADE ON UPDATE CASCADE,
    -- NULL: sin asignatura. Al borrar la asignatura, la tarea se queda sin ella en lugar de desaparecer.
    asignatura_id        integer REFERENCES Asignaturas(asignatura_id) ON DELETE SET NULL ON UPDATE CASCADE,
    titulo               text NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 120),
    descripcion          text NOT NULL DEFAULT '' CHECK (char_length(descripcion) <= 2000),
    tipo_actividad       text NOT NULL DEFAULT 'assignment'
                         CHECK (tipo_actividad IN ('exam', 'assignment', 'project', 'reading', 'practice', 'presentation', 'other')),
    urgencia             text NOT NULL DEFAULT 'medium' CHECK (urgencia IN ('low', 'medium', 'high')),
    estado               text NOT NULL DEFAULT 'pending' CHECK (estado IN ('pending', 'in_progress', 'completed')),
    fecha_entrega        timestamptz NOT NULL,               -- fecha y hora (sin hora = 23:59 local)
    fecha_completada     timestamptz,
    recordatorio_enviado timestamptz,
    fecha_creacion       timestamptz NOT NULL DEFAULT now(),
    fecha_actualizacion  timestamptz NOT NULL DEFAULT now(),
    CHECK ((estado = 'completed') = (fecha_completada IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_tareas_usuario_entrega ON Tareas (usuario_id, fecha_entrega);
CREATE INDEX IF NOT EXISTS ix_tareas_usuario_estado ON Tareas (usuario_id, estado, fecha_entrega);
CREATE INDEX IF NOT EXISTS ix_tareas_asignatura ON Tareas (asignatura_id);
CREATE INDEX IF NOT EXISTS ix_tareas_recordatorio ON Tareas (fecha_entrega) WHERE recordatorio_enviado IS NULL AND estado <> 'completed';

-- La asignatura de una tarea tiene que ser del mismo usuario.
CREATE OR REPLACE FUNCTION fn_tareas_asignatura_propia() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.asignatura_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM Asignaturas WHERE asignatura_id = NEW.asignatura_id AND usuario_id = NEW.usuario_id
    ) THEN
        RAISE EXCEPTION 'La asignatura no pertenece al usuario';
    END IF;
    RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER tr_tareas_asignatura_propia
    BEFORE INSERT OR UPDATE OF asignatura_id ON Tareas
    FOR EACH ROW EXECUTE FUNCTION fn_tareas_asignatura_propia();

-- CALIFICACIONES ------------------------------------------------------------------------
-- 1:1 con la tarea (tarea_id UNIQUE). Solo puede existir si la tarea está completada.
CREATE TABLE IF NOT EXISTS Calificaciones (
    calificacion_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tarea_id        integer NOT NULL UNIQUE REFERENCES Tareas(tarea_id) ON DELETE CASCADE ON UPDATE CASCADE,
    calificacion    numeric(4, 2) NOT NULL CHECK (calificacion >= 0 AND calificacion <= 10),
    fecha_registro  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION fn_calificaciones_solo_completadas() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (SELECT estado FROM Tareas WHERE tarea_id = NEW.tarea_id) IS DISTINCT FROM 'completed' THEN
        RAISE EXCEPTION 'Solo se califican tareas completadas';
    END IF;
    RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER tr_calificaciones_solo_completadas
    BEFORE INSERT OR UPDATE ON Calificaciones
    FOR EACH ROW EXECUTE FUNCTION fn_calificaciones_solo_completadas();

-- Reabrir una tarea borra su nota.
CREATE OR REPLACE FUNCTION fn_tareas_reabrir_borra_nota() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM Calificaciones WHERE tarea_id = NEW.tarea_id;
    RETURN NULL;
END $$;
CREATE OR REPLACE TRIGGER tr_tareas_reabrir_borra_nota
    AFTER UPDATE OF estado ON Tareas
    FOR EACH ROW WHEN (NEW.estado <> 'completed')
    EXECUTE FUNCTION fn_tareas_reabrir_borra_nota();

-- SALAS DE TRABAJO GRUPALES ---------------------------------------------------------------
-- La asignatura de la sala es una copia (nombre y color): las asignaturas son privadas de cada
-- usuario y los demás participantes no pueden ver la original.
CREATE TABLE IF NOT EXISTS Salas (
    sala_id             text PRIMARY KEY CHECK (char_length(sala_id) = 9),
    nombre              text NOT NULL CHECK (char_length(nombre) BETWEEN 2 AND 80),
    descripcion         text NOT NULL DEFAULT '' CHECK (char_length(descripcion) <= 500),
    fecha_sesion        timestamptz,                         -- próxima sesión de estudio programada
    asignatura_nombre   text,
    asignatura_color    text CHECK (asignatura_color IN ('yellow', 'pink', 'green', 'orange', 'blue', 'lilac', 'mint', 'coral')),
    creador_id          text REFERENCES Usuarios(usuario_id) ON DELETE SET NULL ON UPDATE CASCADE,
    -- Contadores mantenidos por los triggers tr_contador_* (no se escriben desde el código).
    mensajes            integer NOT NULL DEFAULT 0 CHECK (mensajes >= 0),
    archivos            integer NOT NULL DEFAULT 0 CHECK (archivos >= 0),
    tareas_abiertas     integer NOT NULL DEFAULT 0 CHECK (tareas_abiertas >= 0),
    ultima_actividad    timestamptz NOT NULL DEFAULT now(),
    fecha_creacion      timestamptz NOT NULL DEFAULT now(),
    fecha_actualizacion timestamptz NOT NULL DEFAULT now(),
    CHECK ((asignatura_nombre IS NULL) = (asignatura_color IS NULL))
);
CREATE INDEX IF NOT EXISTS ix_salas_sesion ON Salas (fecha_sesion) WHERE fecha_sesion IS NOT NULL;

-- PARTICIPANTES DE LAS SALAS
CREATE TABLE IF NOT EXISTS Participantes_Salas (
    sala_id     text NOT NULL REFERENCES Salas(sala_id) ON DELETE CASCADE ON UPDATE CASCADE,
    usuario_id  text NOT NULL REFERENCES Usuarios(usuario_id) ON DELETE CASCADE ON UPDATE CASCADE,
    rol         text NOT NULL DEFAULT 'member' CHECK (rol IN ('admin', 'member')),
    fecha_union timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (sala_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS ix_participantes_usuario ON Participantes_Salas (usuario_id);

-- INVITACIONES PENDIENTES A LAS SALAS (al aceptarla, la fila pasa a Participantes_Salas)
CREATE TABLE IF NOT EXISTS Invitaciones_Salas (
    sala_id          text NOT NULL REFERENCES Salas(sala_id) ON DELETE CASCADE ON UPDATE CASCADE,
    usuario_id       text NOT NULL REFERENCES Usuarios(usuario_id) ON DELETE CASCADE ON UPDATE CASCADE,  -- invitado
    invitado_por     text NOT NULL REFERENCES Usuarios(usuario_id) ON DELETE CASCADE ON UPDATE CASCADE,
    fecha_invitacion timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (sala_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS ix_invitaciones_usuario ON Invitaciones_Salas (usuario_id);

-- Nadie puede estar invitado a una sala de la que ya forma parte.
CREATE OR REPLACE FUNCTION fn_invitaciones_no_participantes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM Participantes_Salas WHERE sala_id = NEW.sala_id AND usuario_id = NEW.usuario_id) THEN
        RAISE EXCEPTION 'Esa persona ya está en la sala';
    END IF;
    RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER tr_invitaciones_no_participantes
    BEFORE INSERT ON Invitaciones_Salas
    FOR EACH ROW EXECUTE FUNCTION fn_invitaciones_no_participantes();

-- TAREAS ASIGNADAS A LOS PARTICIPANTES DE LAS SALAS
CREATE TABLE IF NOT EXISTS Tareas_Sala (
    tarea_sala_id       integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sala_id             text NOT NULL REFERENCES Salas(sala_id) ON DELETE CASCADE ON UPDATE CASCADE,
    usuario_id          text REFERENCES Usuarios(usuario_id) ON DELETE SET NULL ON UPDATE CASCADE,  -- asignada a
    creador_id          text REFERENCES Usuarios(usuario_id) ON DELETE SET NULL ON UPDATE CASCADE,
    titulo              text NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 120),
    descripcion         text NOT NULL DEFAULT '' CHECK (char_length(descripcion) <= 1000),
    fecha_entrega       timestamptz,
    estado              text NOT NULL DEFAULT 'pending' CHECK (estado IN ('pending', 'in_progress', 'completed')),
    fecha_completada    timestamptz,
    fecha_creacion      timestamptz NOT NULL DEFAULT now(),
    fecha_actualizacion timestamptz NOT NULL DEFAULT now(),
    CHECK ((estado = 'completed') = (fecha_completada IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS ix_tareas_sala_sala ON Tareas_Sala (sala_id, tarea_sala_id);
CREATE INDEX IF NOT EXISTS ix_tareas_sala_asignada ON Tareas_Sala (usuario_id, fecha_entrega);

-- Quien sale de una sala deja sus tareas sin asignar.
CREATE OR REPLACE FUNCTION fn_participantes_salida_desasigna() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE Tareas_Sala SET usuario_id = NULL WHERE sala_id = OLD.sala_id AND usuario_id = OLD.usuario_id;
    RETURN NULL;
END $$;
CREATE OR REPLACE TRIGGER tr_participantes_salida_desasigna
    AFTER DELETE ON Participantes_Salas
    FOR EACH ROW EXECUTE FUNCTION fn_participantes_salida_desasigna();

-- CHAT GRUPAL DE LAS SALAS
CREATE TABLE IF NOT EXISTS Mensajes_Salas (
    mensaje_id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sala_id       text NOT NULL REFERENCES Salas(sala_id) ON DELETE CASCADE ON UPDATE CASCADE,
    usuario_id    text NOT NULL REFERENCES Usuarios(usuario_id) ON DELETE CASCADE ON UPDATE CASCADE,
    mensaje       text NOT NULL CHECK (char_length(mensaje) BETWEEN 1 AND 2000),
    fecha_envio   timestamptz NOT NULL DEFAULT now(),
    fecha_edicion timestamptz
);
-- Paginación hacia atrás por cursor sobre mensaje_id (creciente en el tiempo).
CREATE INDEX IF NOT EXISTS ix_mensajes_sala ON Mensajes_Salas (sala_id, mensaje_id DESC);

-- BIBLIOTECA DE ARCHIVOS DE LAS SALAS (el binario vive en el almacenamiento: disco o S3)
CREATE TABLE IF NOT EXISTS Archivos_Salas (
    archivo_id     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sala_id        text NOT NULL REFERENCES Salas(sala_id) ON DELETE CASCADE ON UPDATE CASCADE,
    usuario_id     text REFERENCES Usuarios(usuario_id) ON DELETE SET NULL ON UPDATE CASCADE,
    nombre_archivo text NOT NULL CHECK (char_length(nombre_archivo) BETWEEN 1 AND 255),  -- nombre original
    ruta_archivo   text NOT NULL,                            -- nombre aleatorio en el almacenamiento
    tipo_mime      text NOT NULL,
    tamano_bytes   integer NOT NULL CHECK (tamano_bytes >= 0),
    fecha_subida   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_archivos_sala ON Archivos_Salas (sala_id, fecha_subida DESC);

-- NOTIFICACIONES Y RECORDATORIOS ------------------------------------------------------------
-- "datos" es una instantánea JSON (nombres, títulos) para pintar el aviso sin joins aunque la
-- sala o la tarea cambien después. Se borran a los 180 días (jobs/reminders.js).
CREATE TABLE IF NOT EXISTS Notificaciones (
    notificacion_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id      text NOT NULL REFERENCES Usuarios(usuario_id) ON DELETE CASCADE ON UPDATE CASCADE,  -- destinatario
    remitente_id    text REFERENCES Usuarios(usuario_id) ON DELETE SET NULL ON UPDATE CASCADE,
    tipo            text NOT NULL CHECK (tipo IN ('friend_request', 'friend_accepted', 'room_invitation',
                        'room_member_joined', 'room_role_changed', 'room_task_assigned', 'task_due')),
    sala_id         text REFERENCES Salas(sala_id) ON DELETE CASCADE ON UPDATE CASCADE,
    tarea_id        integer,                                 -- tarea personal o de sala, según el tipo
    datos           jsonb NOT NULL DEFAULT '{}',
    leida           boolean NOT NULL DEFAULT false,
    fecha_lectura   timestamptz,
    fecha_envio     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_notificaciones_usuario ON Notificaciones (usuario_id, notificacion_id DESC);
CREATE INDEX IF NOT EXISTS ix_notificaciones_no_leidas ON Notificaciones (usuario_id) WHERE NOT leida;
CREATE INDEX IF NOT EXISTS ix_notificaciones_sala ON Notificaciones (sala_id) WHERE sala_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_notificaciones_fecha ON Notificaciones (fecha_envio);

-- CONTADORES DE LAS SALAS -----------------------------------------------------------------
-- Listar salas o difundir un cambio no recorre los mensajes, archivos y tareas: lee estas columnas.
-- Los triggers las mantienen exactas en cualquier escritura, también en los borrados en cascada.
CREATE OR REPLACE FUNCTION fn_contador_sala() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    columna text := TG_ARGV[0];
    sala text := CASE WHEN TG_OP = 'DELETE' THEN OLD.sala_id ELSE NEW.sala_id END;
    cambio integer := CASE WHEN TG_OP = 'DELETE' THEN -1 ELSE 1 END;
BEGIN
    EXECUTE format('UPDATE Salas SET %I = %I + $1 WHERE sala_id = $2', columna, columna) USING cambio, sala;
    RETURN NULL;
END $$;

CREATE OR REPLACE TRIGGER tr_contador_mensajes
    AFTER INSERT OR DELETE ON Mensajes_Salas
    FOR EACH ROW EXECUTE FUNCTION fn_contador_sala('mensajes');

CREATE OR REPLACE TRIGGER tr_contador_archivos
    AFTER INSERT OR DELETE ON Archivos_Salas
    FOR EACH ROW EXECUTE FUNCTION fn_contador_sala('archivos');

CREATE OR REPLACE TRIGGER tr_contador_tareas_sala_ins
    AFTER INSERT ON Tareas_Sala
    FOR EACH ROW WHEN (NEW.estado <> 'completed')
    EXECUTE FUNCTION fn_contador_sala('tareas_abiertas');

CREATE OR REPLACE TRIGGER tr_contador_tareas_sala_del
    AFTER DELETE ON Tareas_Sala
    FOR EACH ROW WHEN (OLD.estado <> 'completed')
    EXECUTE FUNCTION fn_contador_sala('tareas_abiertas');

CREATE OR REPLACE FUNCTION fn_contador_tareas_sala_estado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE Salas
       SET tareas_abiertas = tareas_abiertas + CASE WHEN NEW.estado = 'completed' THEN -1 ELSE 1 END
     WHERE sala_id = NEW.sala_id;
    RETURN NULL;
END $$;
CREATE OR REPLACE TRIGGER tr_contador_tareas_sala_upd
    AFTER UPDATE OF estado ON Tareas_Sala
    FOR EACH ROW WHEN ((OLD.estado = 'completed') IS DISTINCT FROM (NEW.estado = 'completed'))
    EXECUTE FUNCTION fn_contador_tareas_sala_estado();

-- CRONÓMETRO Y TÉCNICA POMODORO ---------------------------------------------------------------
-- Una fila por sesión (trabajo o descanso). "dia" es la fecha local del usuario (AAAA-MM-DD):
-- los totales diarios se calculan con SUM agrupando por día.
CREATE TABLE IF NOT EXISTS Pomodoro (
    pomodoro_id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id         text NOT NULL REFERENCES Usuarios(usuario_id) ON DELETE CASCADE ON UPDATE CASCADE,
    dia                text NOT NULL CHECK (dia ~ '^\d{4}-\d{2}-\d{2}$'),
    fase               text NOT NULL CHECK (fase IN ('focus', 'break')),
    segundos_previstos integer NOT NULL CHECK (segundos_previstos > 0),
    segundos_reales    integer NOT NULL CHECK (segundos_reales >= 0),
    completada         boolean NOT NULL,
    asignatura_id      integer REFERENCES Asignaturas(asignatura_id) ON DELETE SET NULL ON UPDATE CASCADE,
    fecha_inicio       timestamptz NOT NULL,
    fecha_fin          timestamptz NOT NULL,
    CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX IF NOT EXISTS ix_pomodoro_usuario_dia ON Pomodoro (usuario_id, dia);
