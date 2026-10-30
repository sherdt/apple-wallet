import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft, ChevronRight, ExternalLink, Pencil, Plus, Search, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { api } from '../lib/api.js';
import { safeHttpUrl } from '../lib/utils.js';
import { useAsync } from '../lib/useAsync.js';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { PageHeader, Spinner } from '../components/form.jsx';
import { CompanyIcon } from '../components/company-icon.jsx';
import { ErrorAlert, SuccessAlert } from '../components/notice.jsx';

export function CompanyPage() {
  const { id } = useParams();
  const notice = useLocation().state?.notice;
  const navigate = useNavigate();
  const detail = useAsync(() => api.companies.get(id), [id]);
  const [query, setQuery] = useState('');

  if (detail.loading) return <Spinner />;
  if (detail.error) return <ErrorAlert error={detail.error} />;

  const { company, employees } = detail.data;
  const websiteHref = safeHttpUrl(company.website ?? '');
  const filtered = employees.filter((e) => {
    const q = query.trim().toLowerCase();
    return !q || [e.name, e.job_title, e.email].some((v) => v?.toLowerCase().includes(q));
  });

  return (
    <>
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />Back to companies
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <CompanyIcon company={company} />
            {company.name}
          </span>
        }
        description={company.address ? <span className="whitespace-pre-line">{company.address}</span> : websiteHref ? undefined : 'No website set'}
      >
        {websiteHref ? (
          <Button variant="outline" asChild>
            <a href={websiteHref} target="_blank" rel="noopener noreferrer"><ExternalLink />Website</a>
          </Button>
        ) : null}
        <Button variant="outline" asChild>
          <Link to={`/companies/${company.id}/edit`}><Pencil />Edit</Link>
        </Button>
      </PageHeader>

      <SuccessAlert message={notice} />

      {employees.length > 0 ? (
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
      ) : null}

      <Card>
        {employees.length === 0 ? (
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <UserRound className="size-10 text-muted-foreground" />
            <p className="font-medium">No employees yet</p>
            <p className="text-sm text-muted-foreground">Add an employee to create their Wallet card.</p>
            <Button asChild className="mt-2">
              <Link to={`/companies/${company.id}/employees/new`}><Plus />Add employee</Link>
            </Button>
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
                <TableRow
                  key={e.id}
                  onClick={() => navigate(`/employees/${e.id}`)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell>
                    <div className="flex items-center justify-between gap-2">
                      <Link to={`/employees/${e.id}`} onClick={(ev) => ev.stopPropagation()} className="font-medium hover:underline">{e.name}</Link>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground md:hidden" />
                    </div>
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
    </>
  );
}
