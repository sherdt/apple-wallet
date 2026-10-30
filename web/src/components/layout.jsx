import { useEffect, useRef, useState } from 'react';
import { Link, Outlet } from 'react-router';
import { CreditCard, LogOut, Pencil, User } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';

// Profile icon that opens a small menu with "Edit profile" and "Sign out".
function ProfileMenu({ user, logout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item = 'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Profile menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex size-8 items-center justify-center rounded-full border text-muted-foreground hover:text-foreground"
      >
        <User className="size-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-2 w-56 rounded-md border bg-card p-1 text-card-foreground shadow-md"
        >
          <div className="truncate px-2 py-1.5 text-xs text-muted-foreground">{user?.name || user?.email}</div>
          <div className="my-1 h-px bg-border" />
          <Link role="menuitem" to="/account" onClick={() => setOpen(false)} className={item}>
            <Pencil className="size-4" />
            Edit profile
          </Link>
          <button role="menuitem" type="button" onClick={logout} className={`${item} text-destructive`}>
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

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
          <ProfileMenu user={user} logout={logout} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
