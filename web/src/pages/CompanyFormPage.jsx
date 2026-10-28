import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Trash2 } from 'lucide-react';
import { api, ApiError } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Field, PageHeader, Spinner } from '../components/form.jsx';
import { ConfirmDialog } from '../components/ui/confirm-dialog.jsx';
import { ErrorAlert } from '../components/notice.jsx';

export function CompanyFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const existing = useAsync(
    () => (editing ? api.companies.get(id).then((d) => d.company) : Promise.resolve(null)),
    [id],
  );

  if (existing.loading) return <Spinner />;
  if (existing.error) return <ErrorAlert error={existing.error} />;
  // key forces a fresh form when switching between companies.
  return <CompanyForm key={id ?? 'new'} id={id} initial={existing.data} />;
}

function CompanyForm({ id, initial }) {
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [values, setValues] = useState({ name: initial?.name ?? '', website: initial?.website ?? '' });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const company = editing
        ? await api.companies.update(id, values)
        : await api.companies.create(values);
      navigate(`/companies/${company.id}`, {
        state: { notice: editing ? 'Company updated.' : 'Company created.' },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
        setFieldErrors(err.fieldErrors);
      } else {
        setError(err);
      }
      setSaving(false);
    }
  }

  async function deleteCompany() {
    setDeleting(true);
    setError(null);
    try {
      await api.companies.remove(id);
      navigate('/', { state: { notice: `${initial?.name ?? 'Company'} was deleted.` } });
    } catch (err) {
      setError(err);
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={editing ? 'Edit company' : 'New company'}
        description="Name is required. The website is optional."
      />
      <Card className="max-w-xl">
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} noValidate className="grid gap-5">
            <ErrorAlert error={error} />
            <Field id="name" label="Company name" error={fieldErrors.name}>
              <Input
                id="name"
                required
                autoFocus
                value={values.name}
                onChange={set('name')}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              />
            </Field>
            <Field id="website" label="Website" error={fieldErrors.website} hint="Optional. Must start with https:// or http://">
              <Input
                id="website"
                type="url"
                value={values.website}
                onChange={set('website')}
                aria-invalid={Boolean(fieldErrors.website)}
                aria-describedby={fieldErrors.website ? 'website-error' : undefined}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" asChild>
                <Link to={editing ? `/companies/${id}` : '/'}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create company'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {editing ? (
        <Card className="mt-10 max-w-xl border-destructive/40">
          <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-destructive">Danger zone</h2>
              <p className="text-sm text-muted-foreground">
                Deleting this company also deletes all its employees and invalidates their Wallet links.
              </p>
            </div>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)} className="shrink-0">
              <Trash2 />Delete company
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        busy={deleting}
        title={`Delete ${initial?.name ?? 'company'}?`}
        description="This also deletes all employees and invalidates their Wallet links. This cannot be undone."
        confirmLabel="Delete company"
        onConfirm={deleteCompany}
      />
    </>
  );
}
