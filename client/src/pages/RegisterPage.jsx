import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "@phosphor-icons/react";
import clsx from "clsx";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Button } from "../components/ui/Button.jsx";
import { Field, Input, Textarea } from "../components/ui/Form.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useDocumentTitle } from "../hooks/useUi.js";
import { applyFieldErrors } from "../utils/errors.js";
import { PasswordInput } from "./LoginPage.jsx";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe tu nombre completo")
    .max(80, "Como máximo 80 caracteres"),
  email: z
    .string()
    .trim()
    .min(1, "Escribe tu correo")
    .email("Ese correo no parece válido"),
  password: z
    .string()
    .min(8, "Al menos 8 caracteres")
    .regex(/[A-Za-z]/, "Incluye al menos una letra")
    .regex(/\d/, "Incluye al menos un número"),
  studies: z
    .string()
    .trim()
    .min(2, "Indica qué estudias")
    .max(120, "Como máximo 120 caracteres"),
  course: z
    .string()
    .trim()
    .min(1, "Indica tu curso")
    .max(40, "Como máximo 40 caracteres"),
  bio: z.string().trim().max(500, "Como máximo 500 caracteres"),
});

const STEP_FIELDS = [
  ["name", "email", "password"],
  ["studies", "course", "bio"],
];

// Registro en dos pasos: la cuenta y después los datos académicos.
export default function RegisterPage() {
  useDocumentTitle("Crear cuenta");
  const { register: signUp } = useAuth();
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    trigger,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      studies: "",
      course: "",
      bio: "",
    },
  });

  const next = async () => {
    if (await trigger(STEP_FIELDS[0])) setStep(1);
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signUp(values);
    } catch (error) {
      const applied = applyFieldErrors(setError, error);
      if (applied && STEP_FIELDS[0].some((field) => error.fields?.[field]))
        setStep(0);
      if (!applied) setFormError(error.message);
    }
  });

  return (
    <>
      <ol className="auth-steps" aria-label="Pasos del registro">
        {["Tu cuenta", "Tus estudios"].map((label, index) => (
          <li
            key={label}
            className={clsx("auth-step", index === step && "auth-step-active")}
            aria-current={index === step ? "step" : undefined}
          >
            <span className="auth-step-number">{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <h1 className="auth-title">
        {step === 0 ? "Crea tu cuenta" : "¿Qué estudias?"}
      </h1>
      <p className="auth-subtitle">
        {step === 0
          ? "Con tu correo y una contraseña."
          : "Lo verán tus compañeros en tu perfil, según tu privacidad."}
      </p>

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {formError ? (
          <p className="auth-form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <div hidden={step !== 0} className="auth-step-fields">
          <Field label="Nombre completo" error={errors.name?.message}>
            <Input autoComplete="name" {...register("name")} />
          </Field>
          <Field label="Correo electrónico" error={errors.email?.message}>
            <Input type="email" autoComplete="email" {...register("email")} />
          </Field>
          <Field
            label="Contraseña"
            hint="Al menos 8 caracteres, con letras y números"
            error={errors.password?.message}
          >
            <PasswordInput
              registration={register("password")}
              autoComplete="new-password"
            />
          </Field>
          <Button size="lg" block onClick={next}>
            Continuar
          </Button>
        </div>

        <div hidden={step !== 1} className="auth-step-fields">
          <Field label="Estudios" error={errors.studies?.message}>
            <Input
              placeholder="Ej. Grado en Ingeniería Informática"
              {...register("studies")}
            />
          </Field>
          <Field label="Curso" error={errors.course?.message}>
            <Input placeholder="Ej. 2º" {...register("course")} />
          </Field>
          <Field label="Descripción" optional error={errors.bio?.message}>
            <Textarea
              rows={3}
              placeholder="Qué te interesa, en qué te pueden ayudar tus compañeros…"
              {...register("bio")}
            />
          </Field>
          <div className="auth-step-actions">
            <Button
              variant="secondary"
              size="lg"
              icon={ArrowLeft}
              onClick={() => setStep(0)}
            >
              Atrás
            </Button>
            <Button
              type="submit"
              size="lg"
              loading={isSubmitting}
              className="auth-grow"
            >
              Crear cuenta
            </Button>
          </div>
        </div>
      </form>

      <p className="auth-switch">
        ¿Ya tienes cuenta? <Link to="/entrar">Entra</Link>
      </p>
    </>
  );
}
