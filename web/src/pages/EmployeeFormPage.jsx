import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Trash2, Upload, User } from 'lucide-react';
import { api, ApiError } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { readAsDataUrl } from '../lib/read-file.js';
import { Button } from '../components/ui/button.jsx';
import { Input, Label } from '../components/ui/input.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Field, PageHeader, Spinner } from '../components/form.jsx';
import { ConfirmDialog } from '../components/ui/confirm-dialog.jsx';
import { ErrorAlert } from '../components/notice.jsx';
import { PhotoCropper } from '../components/photo-cropper.jsx';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function EmployeeFormPage() {
  const { id, companyId: newForCompanyId } = useParams();
  const editing = Boolean(id);
  // Editing loads the employee (and its company). Creating loads only the company for the heading.
  const loaded = useAsync(
    () =>
      editing
        ? api.employees.get(id).then((d) => ({ employee: d.employee, company: d.company, photo: d.photo }))
        : api.companies.get(newForCompanyId).then((d) => ({ employee: null, company: d.company, photo: null })),
    [id, newForCompanyId],
  );

  if (loaded.loading) return <Spinner />;
  if (loaded.error) return <ErrorAlert error={loaded.error} />;
  const { employee, company, photo } = loaded.data;
  return (
    <EmployeeForm
      key={id ?? 'new'}
      id={id}
      company={company}
      initial={employee}
      initialPhoto={photo}
    />
  );
}

function EmployeeForm({ id, company, initial, initialPhoto }) {
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [values, setValues] = useState({
    name: initial?.name ?? '',
    job_title: initial?.job_title ?? '',
    email: initial?.email ?? '',
    mobile: initial?.mobile ?? '',
    linkedin: initial?.linkedin ?? '',
    location: initial?.location ?? '',
  });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photo, setPhoto] = useState(initialPhoto);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [cropSource, setCropSource] = useState(null);

  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const employee = editing
        ? await api.employees.update(id, values)
        : await api.employees.create(company.id, values);
      navigate(`/employees/${employee.id}`, {
        state: { notice: editing ? 'Employee updated.' : 'Employee added.' },
      });
    } catch (err) {
      setError(err);
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors);
      setSaving(false);
    }
  }

  // A selected file opens the cropper first; the cropped square is what gets stored.
  async function onPhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      setError(new ApiError('Photo must be smaller than 5 MB.', { errors: ['Photo must be smaller than 5 MB.'] }));
      return;
    }
    setError(null);
    try {
      setCropSource(await readAsDataUrl(file));
    } catch (err) {
      setError(err);
    }
  }

  // The photo is stored right away, so it does not depend on the form being saved.
  async function uploadCroppedPhoto(dataUrl) {
    setCropSource(null);
    setPhotoBusy(true);
    setError(null);
    try {
      const result = await api.employees.uploadPhoto(id, dataUrl);
      setPhoto(result.photo);
    } catch (err) {
      setError(err);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    setError(null);
    try {
      await api.employees.removePhoto(id);
      setPhoto(null);
    } catch (err) {
      setError(err);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function deleteEmployee() {
    setDeleting(true);
    setError(null);
    try {
      await api.employees.remove(id);
      navigate(`/companies/${company.id}`, { state: { notice: `${initial?.name ?? 'Employee'} was removed.` } });
    } catch (err) {
      setError(err);
      setDeleting(false);
    }
  }

  const backTo = editing ? `/employees/${id}` : `/companies/${company.id}`;

  return (
    <>
      <PageHeader
        title={editing ? 'Edit employee' : 'Add employee'}
        description={`Company: ${company.name}`}
      />
      <Card className="max-w-xl">
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} noValidate className="grid gap-5">
            <ErrorAlert error={error} />
            {cropSource ? (
              <PhotoCropper
                src={cropSource}
                onCancel={() => setCropSource(null)}
                onCrop={uploadCroppedPhoto}
              />
            ) : null}
            <div className="grid gap-2">
              <Label>Profile photo</Label>
              <div className="flex items-center gap-4">
                <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                  {photo ? (
                    <img src={photo} alt="" className="size-full object-cover" />
                  ) : (
                    <User className="size-8 text-muted-foreground" />
                  )}
                </div>
                {editing ? (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={photoBusy} asChild>
                      <label className="cursor-pointer">
                        <Upload />{photo ? 'Replace photo' : 'Upload photo'}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onPhotoChange} disabled={photoBusy} />
                      </label>
                    </Button>
                    {photo ? (
                      <Button type="button" variant="ghost" size="sm" disabled={photoBusy} onClick={removePhoto}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">You can add a photo after the employee is saved.</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Shown as the thumbnail on the Wallet card. JPEG, PNG or WebP, up to 5 MB.</p>
            </div>
            <Field id="name" label="Name" error={fieldErrors.name} hint="Full name, for example Erika Musterfrau">
              <Input
                id="name"
                required
                autoFocus
                value={values.name}
                onChange={set('name')}
                aria-invalid={Boolean(fieldErrors.name)}
                placeholder="Erika Musterfrau"
              />
            </Field>
            <Field id="job_title" label="Job title" error={fieldErrors.job_title}>
              <Input id="job_title" value={values.job_title} onChange={set('job_title')} aria-invalid={Boolean(fieldErrors.job_title)} placeholder="Senior Consultant" />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="email" label="Email" error={fieldErrors.email}>
                <Input id="email" type="email" value={values.email} onChange={set('email')} aria-invalid={Boolean(fieldErrors.email)} placeholder="erika@example.com" />
              </Field>
              <Field id="mobile" label="Mobile" error={fieldErrors.mobile}>
                <Input id="mobile" type="tel" value={values.mobile} onChange={set('mobile')} aria-invalid={Boolean(fieldErrors.mobile)} placeholder="+49 170 1234567" />
              </Field>
            </div>
            <Field id="location" label="Location" error={fieldErrors.location} hint="Optional. Shown in the vCard note, for example an office.">
              <Input id="location" value={values.location} onChange={set('location')} aria-invalid={Boolean(fieldErrors.location)} placeholder="Frankfurt, Büro 3" />
            </Field>
            <Field id="linkedin" label="LinkedIn" error={fieldErrors.linkedin} hint="Optional. Full profile URL, for example https://www.linkedin.com/in/…">
              <Input id="linkedin" type="url" value={values.linkedin} onChange={set('linkedin')} aria-invalid={Boolean(fieldErrors.linkedin)} placeholder="https://www.linkedin.com/in/erika-musterfrau" />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" asChild>
                <Link to={backTo}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add employee'}
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
                Deleting this employee also removes their card link. This cannot be undone.
              </p>
            </div>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)} className="shrink-0">
              <Trash2 />Delete employee
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        busy={deleting}
        title={`Delete ${initial?.name ?? 'employee'}?`}
        description="The employee and their card link are removed. This cannot be undone."
        confirmLabel="Delete employee"
        onConfirm={deleteEmployee}
      />
    </>
  );
}
