import React from 'react';
import { LogIn, LogOut, Menu, Plus, Search, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDemoState } from '../../context/DemoStateContext';
import { handleSpaLinkClick } from '../../lib/router';
import { PrimaryRoute, RouteState } from '../../types/marly';
import { Button } from '../ui';
import { BrandMark } from './BrandMark';

interface TopBarProps {
  route: RouteState;
  onOpenMenu: () => void;
  onOpenQuickAdd: () => void;
  onNavigate: (path: string) => void;
}

const SECTION_META: Record<PrimaryRoute, { title: string; context: string }> = {
  home: { title: 'Home', context: 'Daily Overview' },
  plan: { title: 'Plan', context: 'Tasks, Calendar, Projects & Goals' },
  live: { title: 'Live', context: 'Habits, Streaks, Matrix & Heatmap · Preview' },
  think: { title: 'Think', context: 'AI Clarity Workspace · Phase 10A' },
  statistics: { title: 'Statistics', context: 'Unified PLAN + LIVE Analytics · Phase 9' },
  settings: { title: 'Settings', context: 'Account, Preferences & UI Kit' },
};

export function TopBar({ route, onOpenMenu, onOpenQuickAdd, onNavigate }: TopBarProps) {
  const { user, isAuthLoading, isSigningIn, signInWithGoogle, signOutUser } = useAuth();
  const { searchQuery, setSearchQuery } = useDemoState();
  const meta = route.isNotFound
    ? { title: 'Route Not Found', context: 'Unrecognized path' }
    : SECTION_META[route.section];

  const userDisplayName =
    user?.displayName || user?.email?.split('@')[0] || 'Account';

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#151515]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Left: Mobile menu + active section */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open navigation menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-[#202020] text-[#F2F2F2] hover:bg-[#292929] lg:hidden cursor-pointer"
          >
            <Menu className="h-4 w-4" />
          </button>

          <a
            href="/"
            onClick={(e) => handleSpaLinkClick(e, '/', onNavigate)}
            className="flex items-center gap-2 lg:hidden cursor-pointer"
            aria-label="Go to Marly Home"
          >
            <BrandMark size={24} />
          </a>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold text-[#F2F2F2] sm:text-lg">
                {meta.title}
              </h1>
              <span className="hidden text-xs text-[#737378] sm:inline" aria-hidden="true">
                ·
              </span>
              <span className="hidden truncate text-xs text-[#A3A3A8] sm:inline">
                {meta.context}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Search filter + Quick Add + Account control */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="relative hidden md:block w-56 lg:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#737378]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if ((route.section !== 'home' || route.isNotFound) && e.target.value.trim().length > 0) {
                  onNavigate('/');
                }
              }}
              placeholder="Search tasks & habits..."
              aria-label="Search tasks and habits"
              className="h-9 w-full rounded-xl border border-white/[0.08] bg-[#202020] pl-9 pr-3 text-xs text-[#F2F2F2] placeholder:text-[#737378] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#E59585]/60"
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={onOpenQuickAdd}
          >
            Quick Add
          </Button>

          {!isAuthLoading &&
            (user ? (
              <div className="hidden sm:flex items-center gap-1.5">
                <a
                  href="/settings"
                  onClick={(e) => handleSpaLinkClick(e, '/settings', onNavigate)}
                  title={user.email || 'Account settings'}
                  aria-label="Open workspace settings"
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#202020] px-2.5 text-xs font-medium text-[#F2F2F2] transition-colors hover:border-white/15 cursor-pointer"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={userDisplayName}
                      className="h-6 w-6 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#292929] text-[#E59585]">
                      <User className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="hidden max-w-[120px] truncate xl:inline">{userDisplayName}</span>
                </a>
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  title="Sign out"
                  aria-label="Sign out"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-[#202020] text-[#A3A3A8] transition-colors hover:border-white/15 hover:text-[#F2F2F2] cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<LogIn className="h-3.5 w-3.5" />}
                disabled={isSigningIn}
                onClick={() => void signInWithGoogle()}
                className="hidden sm:inline-flex"
              >
                {isSigningIn ? 'Signing in...' : 'Sign in'}
              </Button>
            ))}
        </div>
      </div>
    </header>
  );
}
