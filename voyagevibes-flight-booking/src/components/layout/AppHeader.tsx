import type { ReactNode } from 'react';
import { Button, Card, StatusBadge } from '../ui';

interface AppHeaderProps {
  currentScreen: string;
  darkMode: boolean;
  isAuthenticated: boolean;
  isBusy?: boolean;
  onHome: () => void;
  onLogout: () => void;
  onSignIn: () => void;
  onToggleTheme: () => void;
  onViewTicket?: () => void;
  themeIcon: ReactNode;
  userInitials: string;
  userName: string | null;
}

export function AppHeader(props: AppHeaderProps) {
  return (
    <Card className="glass-panel sticky top-4 z-30 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button className="flex items-center gap-3 text-left" onClick={props.onHome} type="button">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-semibold text-white">
            VV
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700 dark:text-blue-200">VoyageVibes</p>
            <p className="text-sm text-slate-500 dark:text-slate-300">Customer booking</p>
          </div>
        </button>

        <div className="hidden items-center gap-2 lg:flex">
          <StatusBadge tone="info">{props.currentScreen}</StatusBadge>
          {props.darkMode ? <StatusBadge tone="neutral">dark mode</StatusBadge> : <StatusBadge tone="neutral">light mode</StatusBadge>}
        </div>

        <div className="flex items-center gap-2">
          {props.onViewTicket ? (
            <Button size="sm" variant="secondary" onClick={props.onViewTicket}>
              My ticket
            </Button>
          ) : null}
          <Button aria-label="Toggle theme" size="sm" variant="secondary" onClick={props.onToggleTheme}>
            {props.themeIcon}
          </Button>
          {props.isAuthenticated ? (
            <>
              <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 sm:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-900 dark:bg-slate-800 dark:text-white">
                  {props.userInitials}
                </div>
                <div className="pr-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{props.userName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">Signed in</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={props.onLogout}>
                Logout
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={props.onSignIn} disabled={props.isBusy}>
              {props.isBusy ? 'Connecting...' : 'Sign in'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
