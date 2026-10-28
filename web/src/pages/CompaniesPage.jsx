import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Building2, Plus, Search, Users } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { PageHeader, Spinner } from '../components/form.jsx';
import { CompanyIcon } from '../components/company-icon.jsx';
import { ErrorAlert, SuccessAlert } from '../components/notice.jsx';

export function CompaniesPage() {
  const notice = useLocation().state?.notice;
  const companies = useAsync(() => api.companies.list(), []);
  const [query, setQuery] = useState('');

  const visible = (companies.data ?? []).filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader title="Companies" description="Each company holds its employees and their Wallet cards.">
        {companies.data?.length > 0 ? (
          <Button asChild>
            <Link to="/companies/new"><Plus />New company</Link>
          </Button>
        ) : null}
      </PageHeader>

      <SuccessAlert message={notice} />
      <ErrorAlert error={companies.error} />

      {companies.loading ? <Spinner /> : null}

      {companies.data ? (
        <>
          {companies.data.length > 0 ? (
            <div className="relative mb-6 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Search companies"
                placeholder="Search companies…"
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          ) : null}

          {companies.data.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 py-16 text-center">
              <Building2 className="size-10 text-muted-foreground" />
              <p className="font-medium">No companies yet</p>
              <p className="text-sm text-muted-foreground">Create your first company to start adding employees.</p>
              <Button asChild className="mt-2">
                <Link to="/companies/new"><Plus />New company</Link>
              </Button>
            </Card>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No companies match “{query}”.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {visible.map((c) => (
                <li key={c.id}>
                  <Link to={`/companies/${c.id}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Card className="h-full transition-shadow hover:shadow-md">
                      <CardContent className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <CompanyIcon company={c} />
                          <div className="min-w-0">
                          <p className="truncate font-semibold">{c.name}</p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">{c.website || 'No website'}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0 gap-1">
                          <Users className="size-3" />{c.employee_count}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </>
  );
}
