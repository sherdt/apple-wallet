import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, ApiError } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Field, PageHeader, Spinner } from '../components/form.jsx';
import { ErrorAlert } from '../components/notice.jsx';

export function EmployeeFormPage() {
  const { id, companyId: newForCompanyId } = useParams();
  const editing = Boolean(id);
  // Editing loads the employee (and its company). Creating loads only the company for the heading.
  const loaded = useAsync(
    () =>
      editing
        ? api.employees.get(id).then((d) => ({ employee: d.employee, company: d.company }))
        : api.companies.get(newForCompanyId).then((d) => ({ employee: null, company: d.company })),
    [id, newForCompanyId],
  );

  if (loaded.loading) return <Spinner />;
  if (loaded.error) return <ErrorAlert error={loaded.error} />;
  const { employee, company } = loaded.data;
  return (
    <EmployeeForm
      key={id ?? 'new'}
      id={id}
      company={company}
      initial={employee}
    />
  );
}

function EmployeeForm({ id, company, initial }) {
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [values, setValues] = useState({
    name: initial?.name ?? '',
    job_title: initial?.job_title ?? '',
    email: initial?.email ?? '',
    mobile: initial?.mobile ?? '',
  });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

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
    </>
  );
}
