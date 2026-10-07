import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../components/ui/Button.jsx';
import { Field, Input } from '../components/ui/Form.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useUi.js';
import { applyFieldErrors } from '../utils/errors.js';
import styles from './AuthPages.module.css';

const schema = z.object({
  email: z.string().trim().min(1, 'Escribe tu correo').email('Ese correo no parece válido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
});

// Recibe id y atributos ARIA de <Field> y los pasa al input real.
export function PasswordInput({ registration, autoComplete, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.password}>
      <Input type={visible ? 'text' : 'password'} autoComplete={autoComplete} {...inputProps} {...registration} />
      <button
        type="button"
        className={styles.reveal}
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? <EyeSlash size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
      </button>
    </div>
  );
}

export default function LoginPage() {
  useDocumentTitle('Entrar');
  const { login } = useAuth();
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values);
    } catch (error) {
      if (!applyFieldErrors(setError, error)) setFormError(error.message);
    }
  });

  return (
    <>
      <h1 className={styles.title}>Entra en tu planificador</h1>
      <p className={styles.subtitle}>Tus tareas y salas te esperan donde las dejaste.</p>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {formError ? (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        ) : null}
        <Field label="Correo electrónico" error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </Field>
        <Field label="Contraseña" error={errors.password?.message}>
          <PasswordInput registration={register('password')} autoComplete="current-password" />
        </Field>
        <Button type="submit" size="lg" block loading={isSubmitting}>
          Entrar
        </Button>
      </form>

      <p className={styles.switch}>
        ¿Aún no tienes cuenta? <Link to="/registro">Crea una</Link>
      </p>
    </>
  );
}
