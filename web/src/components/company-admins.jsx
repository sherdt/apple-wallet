import { useState } from 'react';
import { Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Badge } from './ui/badge.jsx';
import { Field } from './form.jsx';
import { ErrorAlert } from './notice.jsx';

// Lists the company's admins and lets an admin add already registered users by email.
export function CompanyAdmins({ companyId }) {
  const admins = useAsync(() => api.companies.admins(companyId), [companyId]);
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function add(event) {
    event.preventDefault();
    setBusy(true);
    setFieldError(null);
    setActionError(null);
    try {
      await api.companies.addAdmin(companyId, email);
      setEmail('');
      admins.reload();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.email) setFieldError(err.fieldErrors.email);
      else setActionError(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId) {
    setActionError(null);
    try {
      await api.companies.removeAdmin(companyId, userId);
      admins.reload();
    } catch (err) {
      setActionError(err);
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5" />Admins</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Admins can edit this company, its employees and logo, and manage other admins. Added users must already have an account.
        </p>
        {admins.error ? <ErrorAlert error={admins.error} /> : null}
        {actionError ? <ErrorAlert error={actionError} /> : null}
        {admins.data ? (
          <ul className="divide-y rounded-md border">
            {admins.data.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="flex items-center gap-2 truncate">
                  {a.email}
                  {a.is_owner ? <Badge variant="secondary">Creator</Badge> : null}
                </span>
                {a.is_owner ? null : (
                  <Button variant="ghost" size="sm" onClick={() => remove(a.id)} aria-label={`Remove ${a.email}`}>
                    <Trash2 />Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Field id="admin-email" label="Add admin by email" error={fieldError} className="flex-1">
            <Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="kollege@example.com" aria-invalid={Boolean(fieldError)} />
          </Field>
          <Button type="submit" disabled={busy} className="sm:mt-6"><Plus />Add admin</Button>
        </form>
      </CardContent>
    </Card>
  );
}
