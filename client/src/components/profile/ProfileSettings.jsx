import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Desktop, Moon, SunDim, Trash } from "@phosphor-icons/react";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  useChangePassword,
  useRemoveAvatar,
  useUpdatePreferences,
  useUpdatePrivacy,
  useUpdateProfile,
  useUploadAvatar,
} from "../../hooks/useProfile.js";
import { applyFieldErrors } from "../../utils/errors.js";
import { PasswordInput } from "../../pages/LoginPage.jsx";
import { Avatar } from "../ui/Avatar.jsx";
import { Button } from "../ui/Button.jsx";
import {
  ChoiceGroup,
  Field,
  FormRow,
  Input,
  Select,
  Switch,
  Textarea,
} from "../ui/Form.jsx";
import { OverlayFooter } from "../ui/Overlay.jsx";

const AVATAR_TYPES = "image/png,image/jpeg,image/webp";
// Debe coincidir con MAX_AVATAR_SIZE_MB del servidor, que guarda la foto optimizada (WebP de pocos KB).
const MAX_AVATAR_MB = 8;

export function AvatarEditor({ user }) {
  const input = useRef(null);
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();

  const pick = (file) => {
    if (!file) return;
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      toast.error(
        `La foto pesa más de ${MAX_AVATAR_MB} MB. Elige una más ligera.`,
      );
      return;
    }
    upload.mutate(file);
  };

  return (
    <div className="profile-avatar-editor">
      <Avatar user={user} size="xl" />
      <input
        ref={input}
        type="file"
        accept={AVATAR_TYPES}
        className="visually-hidden"
        tabIndex={-1}
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <div className="profile-avatar-actions">
        <Button
          size="sm"
          variant="secondary"
          icon={Camera}
          onClick={() => input.current?.click()}
          loading={upload.isPending}
        >
          {user.avatar ? "Cambiar foto" : "Subir foto"}
        </Button>
        {user.avatar ? (
          <Button
            size="sm"
            variant="ghost"
            icon={Trash}
            onClick={() => remove.mutate()}
            loading={remove.isPending}
            aria-label="Quitar foto"
          />
        ) : null}
      </div>
    </div>
  );
}

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe tu nombre completo")
    .max(80, "Como máximo 80 caracteres"),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9._]{3,30}$/,
      "Entre 3 y 30 caracteres: letras, números, punto o guion bajo",
    ),
  studies: z.string().trim().min(2, "Indica qué estudias").max(120),
  course: z.string().trim().min(1, "Indica tu curso").max(40),
  bio: z.string().trim().max(500, "Como máximo 500 caracteres"),
});

export function ProfileForm({ user, onDone, onCancel }) {
  const update = useUpdateProfile();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name,
      handle: user.handle,
      studies: user.studies,
      course: user.course,
      bio: user.bio,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      onDone();
    } catch (error) {
      applyFieldErrors(setError, error);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="profile-form">
      <Field label="Nombre completo" error={errors.name?.message}>
        <Input autoComplete="name" {...register("name")} />
      </Field>
      <Field
        label="Identificador"
        hint="Con él te pueden encontrar: @identificador"
        error={errors.handle?.message}
      >
        <Input autoComplete="username" {...register("handle")} />
      </Field>
      <FormRow>
        <Field label="Estudios" error={errors.studies?.message}>
          <Input {...register("studies")} />
        </Field>
        <Field label="Curso" error={errors.course?.message}>
          <Input {...register("course")} />
        </Field>
      </FormRow>
      <Field label="Descripción" optional error={errors.bio?.message}>
        <Textarea rows={4} {...register("bio")} />
      </Field>
      <OverlayFooter>
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={update.isPending}>
          Guardar cambios
        </Button>
      </OverlayFooter>
    </form>
  );
}

const VISIBILITY = [
  {
    value: "public",
    label: "Cualquier estudiante",
    hint: "Todos pueden ver tus estudios, asignaturas y progreso.",
  },
  {
    value: "friends",
    label: "Solo mis amigos",
    hint: "Quien no sea tu amigo solo verá tu nombre y tu foto.",
  },
  {
    value: "private",
    label: "Nadie",
    hint: "Tu perfil muestra solo tu nombre, tu foto y tu identificador.",
  },
];

export function PrivacySettings({ user }) {
  const update = useUpdatePrivacy();
  const { privacy } = user;
  const current = VISIBILITY.find(
    (option) => option.value === privacy.profileVisibility,
  );

  return (
    <div className="profile-stack">
      <Field label="Quién puede ver tu perfil" hint={current?.hint}>
        <Select
          value={privacy.profileVisibility}
          onChange={(event) =>
            update.mutate({ profileVisibility: event.target.value })
          }
          disabled={update.isPending}
        >
          {VISIBILITY.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Switch
        label="Aparecer en búsquedas por nombre"
        description="Aunque lo desactives, quien conozca tu identificador exacto podrá encontrarte."
        checked={privacy.searchable}
        onChange={(searchable) => update.mutate({ searchable })}
        disabled={update.isPending}
      />
      <Switch
        label="Mostrar mis notas en el perfil"
        description="Tu media y tu progreso, solo para quien pueda ver tu perfil."
        checked={privacy.showGrades}
        onChange={(showGrades) => update.mutate({ showGrades })}
        disabled={update.isPending}
      />
    </div>
  );
}

export function ThemeSettings({ user }) {
  const update = useUpdatePreferences();
  return (
    <ChoiceGroup
      name="theme"
      label="Tema"
      value={user.preferences.theme}
      onChange={(theme) => update.mutate({ theme })}
      options={[
        { value: "system", label: "Como el sistema", icon: Desktop },
        { value: "light", label: "Claro", icon: SunDim },
        { value: "dark", label: "Oscuro", icon: Moon },
      ]}
    />
  );
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Escribe tu contraseña actual"),
  newPassword: z
    .string()
    .min(8, "Al menos 8 caracteres")
    .regex(/[A-Za-z]/, "Incluye al menos una letra")
    .regex(/\d/, "Incluye al menos un número"),
});

export function PasswordForm() {
  const change = useChangePassword();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await change.mutateAsync(values);
      reset();
    } catch (error) {
      applyFieldErrors(setError, error);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="profile-form">
      <Field label="Contraseña actual" error={errors.currentPassword?.message}>
        <PasswordInput
          registration={register("currentPassword")}
          autoComplete="current-password"
        />
      </Field>
      <Field
        label="Contraseña nueva"
        hint="Al menos 8 caracteres, con letras y números"
        error={errors.newPassword?.message}
      >
        <PasswordInput
          registration={register("newPassword")}
          autoComplete="new-password"
        />
      </Field>
      <Button
        type="submit"
        variant="secondary"
        loading={change.isPending}
        style={{ justifySelf: "start" }}
      >
        Cambiar contraseña
      </Button>
    </form>
  );
}
