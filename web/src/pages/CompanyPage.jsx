import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ExternalLink, Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { api } from '../lib/api.js';
import { safeHttpUrl } from '../lib/utils.js';
import { useAsync } from '../lib/useAsync.js';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { ConfirmDialog } from '../components/ui/confirm-dialog.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { PageHeader, Spinner } from '../components/form.jsx';
import { ErrorAlert, SuccessAlert } from '../components/notice.jsx';

export function CompanyPage() {
  const { id } = useParams();
  const notice = useLocation().state?.notice;
  const navigate = useNavigate();
  const detail = useAsync(() => api.companies.get(id), [id]);
  const [query, setQuery] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  if (detail.loading) return <Spinner />;
  if (detail.error) return <ErrorAlert error={detail.error} />;

  const { company, employees } = detail.data;
  const websiteHref = safeHttpUrl(company.website ?? '');
  const filtered = employees.filter((e) => {
    const q = query.trim().toLowerCase();
    return !q || [e.name, e.job_title, e.email].some((v) => v?.toLowerCase().includes(q));
  });

  async function deleteCompany() {
    setBusy(true);
    setActionError(null);
    try {
      await api.companies.remove(company.id);
      navigate('/', { state: { notice: `${company.name} was deleted.` } });
    } catch (err) {
      setActionError(err);
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={company.name} description={websiteHref ? undefined : 'No website set'}>
        {websiteHref ? (
          <Button variant="outline" asChild>
            <a href={websiteHref} target="_blank" rel="noopener noreferrer"><ExternalLink />Website</a>
          </Button>
        ) : null}
        <Button variant="outline" asChild>
          <Link to={`/companies/${company.id}/edit`}><Pencil />Edit</Link>
        </Button>
        <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
          <Trash2 />Delete
        </Button>
      </PageHeader>

      <SuccessAlert message={notice} />
      <ErrorAlert error={actionError} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Search employees"
            placeholder="Search employees…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button asChild>
          <Link to={`/companies/${company.id}/employees/new`}><Plus />Add employee</Link>
        </Button>
      </div>

      <Card>
        {employees.length === 0 ? (
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <UserRound className="size-10 text-muted-foreground" />
            <p className="font-medium">No employees yet</p>
            <p className="text-sm text-muted-foreground">Add an employee to create their Wallet card.</p>
          </CardContent>
        ) : filtered.length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No employees match “{query}”.
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Job title</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link to={`/employees/${e.id}`} className="font-medium hover:underline">{e.name}</Link>
                  </TableCell>
                  <TableCell>
                    {e.job_title ? <Badge variant="secondary">{e.job_title}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{e.email || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        busy={busy}
        title={`Delete ${company.name}?`}
        description={`This also deletes all ${employees.length} employee${employees.length === 1 ? '' : 's'} and invalidates their Wallet links. This cannot be undone.`}
        confirmLabel="Delete company"
        onConfirm={deleteCompany}
      />
    </>
  );
}
