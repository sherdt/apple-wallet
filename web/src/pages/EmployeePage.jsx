import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ArrowLeft, Check, Copy, Download, ExternalLink, Pencil, RefreshCw, User, Wallet } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { ConfirmDialog } from '../components/ui/confirm-dialog.jsx';
import { PageHeader, Spinner } from '../components/form.jsx';
import { ErrorAlert, SuccessAlert } from '../components/notice.jsx';

export function EmployeePage() {
  const { id } = useParams();
  const notice = useLocation().state?.notice;
  const detail = useAsync(() => api.employees.get(id), [id]);
  const [dialog, setDialog] = useState(null); // 'rotate' | null
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState(null);

  if (detail.loading) return <Spinner />;
  if (detail.error) return <ErrorAlert error={detail.error} />;

  const { employee, company, origin, photo } = detail.data;
  const cardPath = `/p/${employee.token}`;
  const cardUrl = `${origin}${cardPath}`;

  async function run(action) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err);
      setBusy(false);
    }
  }

  const rotate = () =>
    run(async () => {
      await api.employees.rotateToken(employee.id);
      setDialog(null);
      setBusy(false);
      setSuccess('Card link revoked. The new link is shown below.');
      detail.reload();
    });

  return (
    <>
      <Link
        to={`/companies/${company.id}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />Back to {company.name} employees
      </Link>
      <PageHeader title={employee.name} description={[employee.job_title, company.name].filter(Boolean).join(' · ')}>
        <Button variant="outline" asChild>
          <Link to={`/employees/${employee.id}/edit`}><Pencil />Edit</Link>
        </Button>
      </PageHeader>

      <SuccessAlert message={notice ?? success} />
      <ErrorAlert error={actionError} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
            <CardDescription>Shown on the card and in the saved contact.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="flex items-center gap-4">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                {photo ? (
                  <img src={photo} alt={employee.name} className="size-full object-cover" />
                ) : (
                  <User className="size-8 text-muted-foreground" />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {photo ? 'Also used as the thumbnail on the Wallet card.' : 'No photo yet. Add one in the employee settings.'}
              </p>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Job title</dt>
              <dd>{employee.job_title || '—'}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{employee.email || '—'}</dd>
              <dt className="text-muted-foreground">Mobile</dt>
              <dd>{employee.mobile || '—'}</dd>
              <dt className="text-muted-foreground">Location</dt>
              <dd>{employee.location || '—'}</dd>
              <dt className="text-muted-foreground">LinkedIn</dt>
              <dd>{employee.linkedin ? <a href={employee.linkedin} target="_blank" rel="noopener noreferrer" className="hover:underline">{employee.linkedin}</a> : '—'}</dd>
              <dt className="text-muted-foreground">Company</dt>
              <dd>
                <Link to={`/companies/${company.id}`} className="hover:underline">{company.name}</Link>
              </dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Wallet card
              <Badge variant="secondary">Live</Badge>
            </CardTitle>
            <CardDescription>Anyone with this link can open the card. Revoke it to invalidate old links.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <CopyField value={cardUrl} />
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href={`${cardPath}.pkpass`}><Wallet />Add to Wallet</a>
              </Button>
              <Button variant="outline" asChild>
                <a href={`${cardPath}.vcf`}><Download />Save contact</a>
              </Button>
              <Button variant="outline" asChild>
                <a href={cardPath} target="_blank" rel="noopener noreferrer"><ExternalLink />Open card</a>
              </Button>
              <Button variant="ghost" onClick={() => setDialog('rotate')}>
                <RefreshCw />Revoke link
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={dialog === 'rotate'}
        onOpenChange={(open) => !open && setDialog(null)}
        busy={busy}
        title="Revoke card link?"
        description="The current link and any Wallet pass created from it stop working. A new link is generated."
        confirmLabel="Revoke link"
        onConfirm={rotate}
      />
    </>
  );
}

function CopyField({ value }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be blocked on plain http. Select the text so the user can copy it manually.
      document.getElementById('card-url')?.select();
    }
  }

  return (
    <div className="flex gap-2">
      <Input id="card-url" readOnly value={value} aria-label="Card link" onFocus={(e) => e.target.select()} />
      <Button variant="outline" size="icon" onClick={copy} aria-label="Copy card link">
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}
