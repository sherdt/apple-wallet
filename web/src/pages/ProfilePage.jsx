import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card.jsx';
import { Field, PageHeader } from '../components/form.jsx';
import { ErrorAlert, SuccessAlert } from '../components/notice.jsx';

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirmPassword: '' };

export function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" description="Your name and password for this account." />
      <div className="grid max-w-sm gap-6">
        <NameForm />
        <PasswordForm />
      </div>
    </>
  );
}

function NameForm() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  // The user is restored asynchronously on first load, so the field may fill in later.
  useEffect(() => {
    setName(user?.name ?? '');
  }, [user?.name]);

  async function onSubmit(e) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      updateUser(await api.auth.updateProfile({ name }));
      setMessage('Your name has been saved.');
    } catch (err) {
      setError(err);
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Name</CardTitle>
        <CardDescription>Signed in as {user?.email}</CardDescription>
      </CardHeader>
      <CardContent>
        <SuccessAlert message={message} />
        <form onSubmit={onSubmit} noValidate className="grid gap-5">
          <ErrorAlert error={error} />
          <Field id="name" label="Real name" error={fieldErrors.name}>
            <Input
              id="name"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
            />
          </Field>
          <Button type="submit" disabled={saving}>
            {saving ? 'Please wait…' : 'Save name'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordForm() {
  const navigate = useNavigate();
  const [values, setValues] = useState(EMPTY_PASSWORDS);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (values.newPassword !== values.confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match.' });
      return;
    }
    setSaving(true);
    try {
      await api.auth.changePassword(values);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err);
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Enter your current password and the new one twice. At least 8 characters.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-5">
          <ErrorAlert error={error} />
          <Field id="currentPassword" label="Current password" error={fieldErrors.currentPassword}>
            <Input
              id="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              value={values.currentPassword}
              onChange={set('currentPassword')}
              aria-invalid={Boolean(fieldErrors.currentPassword)}
            />
          </Field>
          <Field id="newPassword" label="New password" error={fieldErrors.newPassword}>
            <Input
              id="newPassword"
              type="password"
              required
              autoComplete="new-password"
              value={values.newPassword}
              onChange={set('newPassword')}
              aria-invalid={Boolean(fieldErrors.newPassword)}
            />
          </Field>
          <Field id="confirmPassword" label="Repeat new password" error={fieldErrors.confirmPassword}>
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
          <Button type="submit" disabled={saving}>
            {saving ? 'Please wait…' : 'Change password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
