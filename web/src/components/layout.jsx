import { Link, Outlet } from 'react-router';
import { CreditCard, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { Button } from './ui/button.jsx';

export function Layout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background shadow-sm">
              <CreditCard className="size-4" />
            </span>
            Wallet vCards
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/account" className="hidden text-xs text-muted-foreground hover:underline sm:inline">
              {user?.name || user?.email}
            </Link>
            <Button variant="ghost" size="sm" onClick={logout} aria-label="Sign out">
              <LogOut />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
