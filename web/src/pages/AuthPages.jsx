import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card.jsx';
import { Field, Spinner } from '../components/form.jsx';
import { ErrorAlert } from '../components/notice.jsx';

export function LoginPage() {
  return (
    <AuthForm
      mode="login"
      title="Sign in"
      description="Sign in to manage your companies."
      submitLabel="Sign in"
      footer={<>No account yet? <Link className="underline" to="/register">Register</Link></>}
    />
  );
}

export function RegisterPage() {
  return (
    <AuthForm
      mode="register"
      title="Create account"
      description="Every registered account is an administrator for the companies it creates."
      submitLabel="Register"
      footer={<>Already registered? <Link className="underline" to="/login">Sign in</Link></>}
    />
  );
}

function AuthForm({ mode, title, description, submitLabel, footer }) {
  const { user, ready, login, register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  if (!ready) return <Spinner />;
  if (user) return <Navigate to="/" replace />;

  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    if (mode === 'register' && values.password !== values.confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match.' });
      return;
    }
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      await (mode === 'login' ? login({ email: values.email, password: values.password }) : register(values));
      navigate('/', { replace: true });
    } catch (err) {
      setError(err);
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto mt-12 max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="grid gap-5">
            <ErrorAlert error={error} />
            <Field id="email" label="Email" error={fieldErrors.email}>
              <Input
                id="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={values.email}
                onChange={set('email')}
                aria-invalid={Boolean(fieldErrors.email)}
              />
            </Field>
            <Field
              id="password"
              label="Password"
              error={fieldErrors.password}
              hint={mode === 'register' ? 'At least 8 characters.' : undefined}
            >
              <Input
                id="password"
                type="password"
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={values.password}
                onChange={set('password')}
                aria-invalid={Boolean(fieldErrors.password)}
              />
            </Field>
            {mode === 'register' && (
              <Field id="confirmPassword" label="Repeat password" error={fieldErrors.confirmPassword}>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={values.confirmPassword}
                  onChange={set('confirmPassword')}
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                />
              </Field>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? 'Please wait…' : submitLabel}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        </CardContent>
      </Card>
    </div>
  );
}
