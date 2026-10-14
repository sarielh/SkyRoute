import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, Search, Ticket, X } from 'lucide-react';
import movementLogo from '../assets/movement-logo.png';
import { Logo } from '../common/Logo';
import { cx } from '../common/ui';

function NavItem({ to, icon, children, onClick }: { to: string; icon: React.ReactNode; children: React.ReactNode; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        cx(
          'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition',
          isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-soft hover:bg-slate-100 hover:text-ink',
        )
      }
    >
      {icon}
      {children}
    </NavLink>
  );
}

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label="SkyRoute home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            <NavItem to="/" icon={<Search className="h-4 w-4" />}>
              Search flights
            </NavItem>
            <NavItem to="/bookings" icon={<Ticket className="h-4 w-4" />}>
              My Bookings
            </NavItem>
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 border-l border-slate-200 pl-4 lg:flex">
              <span className="text-xs font-medium text-ink-muted">QA Assessment Environment by</span>
              <img src={movementLogo} alt="movement" width={103} height={20} className="h-5 w-auto" />
            </div>
            <button type="button" className="rounded-xl p-2 text-ink-soft hover:bg-slate-100 md:hidden" onClick={() => setMenuOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={menuOpen}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="flex flex-col gap-1 border-t border-slate-200 px-4 py-3 md:hidden" aria-label="Mobile">
            <NavItem to="/" icon={<Search className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
              Search flights
            </NavItem>
            <NavItem to="/bookings" icon={<Ticket className="h-4 w-4" />} onClick={() => setMenuOpen(false)}>
              My Bookings
            </NavItem>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-ink-muted sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Logo className="scale-90" />
          </div>
          <p className="max-w-xl md:text-center">
            This is a demo booking platform. Please use fictional passenger information. No real flights, bookings or payments are made.
          </p>
          <div className="flex gap-4">
            <span>© {new Date().getFullYear()} SkyRoute</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
