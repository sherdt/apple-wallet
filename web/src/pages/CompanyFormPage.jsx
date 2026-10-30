import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Trash2, Upload, Building2 } from 'lucide-react';
import { api, ApiError } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { readAsDataUrl } from '../lib/read-file.js';
import { cn } from '../lib/utils.js';
import { Button } from '../components/ui/button.jsx';
import { Input, Label } from '../components/ui/input.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Field, PageHeader, Spinner } from '../components/form.jsx';
import { ConfirmDialog } from '../components/ui/confirm-dialog.jsx';
import { ErrorAlert } from '../components/notice.jsx';
import { CompanyAdmins } from '../components/company-admins.jsx';

const MAX_ICON_BYTES = 5 * 1024 * 1024;

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
  const [values, setValues] = useState({
    name: initial?.name ?? '',
    website: initial?.website ?? '',
    address: initial?.address ?? '',
  });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [icon, setIcon] = useState(initial?.has_icon ?? false);
  const [iconLight, setIconLight] = useState(initial?.icon_light ?? false);
  const [iconBusy, setIconBusy] = useState(false);
  const [iconError, setIconError] = useState(null);

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

  // The logo is stored right away, so it does not depend on the form being saved.
  async function onIconChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_ICON_BYTES) {
      setIconError('Logo must be smaller than 5 MB.');
      return;
    }
    setIconBusy(true);
    setIconError(null);
    try {
      const result = await api.companies.uploadIcon(id, await readAsDataUrl(file));
      setIcon(true);
      setIconLight(result?.icon_light ?? false);
    } catch (err) {
      setIconError(err instanceof ApiError ? err.fieldErrors.icon ?? err.message : err.message);
    } finally {
      setIconBusy(false);
    }
  }

  async function removeIcon() {
    setIconBusy(true);
    setIconError(null);
    try {
      await api.companies.removeIcon(id);
      setIcon(false);
      setIconLight(false);
    } catch (err) {
      setIconError(err.message);
    } finally {
      setIconBusy(false);
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
        description="Name is required. Website and address are optional."
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
            <Field id="address" label="Address" error={fieldErrors.address} hint="Optional. Shown on every employee's vCard">
              <textarea
                id="address"
                rows={3}
                value={values.address}
                onChange={set('address')}
                aria-invalid={Boolean(fieldErrors.address)}
                aria-describedby={fieldErrors.address ? 'address-error' : undefined}
                className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-base shadow-sm md:text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
              />
            </Field>
            {editing ? (
              <div className="grid gap-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  <div className={cn('flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg', iconLight ? 'bg-neutral-900' : 'bg-muted')}>
                    {icon ? (
                      <img src={`/admin/icons/${id}?v=${Date.now()}`} alt="" className="size-full object-contain" />
                    ) : (
                      <Building2 className="size-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={iconBusy} asChild>
                      <label className="cursor-pointer">
                        <Upload />{icon ? 'Replace logo' : 'Upload logo'}
                        <input type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" className="sr-only" onChange={onIconChange} disabled={iconBusy} />
                      </label>
                    </Button>
                    {icon ? (
                      <Button type="button" variant="ghost" size="sm" disabled={iconBusy} onClick={removeIcon}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
                {iconError ? <p className="text-sm text-destructive">{iconError}</p> : null}
                <p className="text-xs text-muted-foreground">Shown in the admin and as the header logo on the Wallet card. SVG, PNG, JPEG or WebP.</p>
              </div>
            ) : null}
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
        <div className="mt-10 max-w-xl">
          <CompanyAdmins companyId={id} />
        </div>
      ) : null}

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
