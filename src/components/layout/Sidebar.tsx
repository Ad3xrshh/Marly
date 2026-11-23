import React from 'react';
import {
  Activity,
  BarChart3,
  BrainCircuit,
  CalendarCheck2,
  Home,
  LogIn,
  LogOut,
  RotateCcw,
  Settings,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDemoState } from '../../context/DemoStateContext';
import { cn } from '../../lib/cn';
import { handleSpaLinkClick } from '../../lib/router';
import { PrimaryRoute } from '../../types/marly';
import { BrandMark } from './BrandMark';

interface SidebarProps {
  activeSection: PrimaryRoute;
  onNavigate: (path: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: PrimaryRoute;
  label: string;
  path: string;
  subtitle: string;
  icon: React.ReactNode;
  accentClass: string;
  phaseNote?: string;
}

const PRIMARY_NAV_ITEMS: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    path: '/',
    subtitle: 'Daily overview',
    icon: <Home className="h-4 w-4" />,
    accentClass: 'text-[#F2F2F2]',
  },
  {
    id: 'plan',
    label: 'Plan',
    path: '/plan/tasks',
    subtitle: 'Tasks · Calendar · Goals',
    icon: <CalendarCheck2 className="h-4 w-4" />,
    accentClass: 'text-[#E59585]',
  },
  {
    id: 'live',
    label: 'Live',
    path: '/live/calendar',
    subtitle: 'Habits · Streaks · Matrix',
    icon: <Activity className="h-4 w-4" />,
    accentClass: 'text-[#96D2C5]',
    phaseNote: 'Preview',
  },
  {
    id: 'think',
    label: 'Think',
    path: '/think',
    subtitle: 'AI clarity layer',
    icon: <BrainCircuit className="h-4 w-4" />,
    accentClass: 'text-[#8C82E8]',
    phaseNote: 'Phase 10',
  },
  {
    id: 'statistics',
    label: 'Statistics',
    path: '/statistics',
    subtitle: 'Unified trends',
    icon: <BarChart3 className="h-4 w-4" />,
    accentClass: 'text-[#F19A50]',
    phaseNote: 'Phase 9',
  },
];

export function Sidebar({
  activeSection,
  onNavigate,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { user, isAuthLoading, isSigningIn, signInWithGoogle, signOutUser } = useAuth();
  const { isModified, resetDemoState } = useDemoState();

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-[#181818] px-3.5 py-5 border-r border-white/[0.07]">
      <div>
        {/* Brand header */}
        <div className="flex items-center justify-between px-2.5 pb-6">
          <a
            href="/"
            onClick={(e) => handleSpaLinkClick(e, '/', onNavigate, onCloseMobile)}
            className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59585] rounded-lg cursor-pointer"
          >
            <BrandMark size={28} />
            <span className="text-lg font-bold tracking-tight text-[#F2F2F2]">Marly</span>
          </a>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#A3A3A8] hover:bg-white/[0.06] hover:text-[#F2F2F2] lg:hidden cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation links */}
        <nav aria-label="Primary navigation" className="space-y-1">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={item.path}
                onClick={(e) => handleSpaLinkClick(e, item.path, onNavigate, onCloseMobile)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59585]',
                  isActive
                    ? 'bg-[#262626] text-[#F2F2F2]'
                    : 'text-[#A3A3A8] hover:bg-white/[0.04] hover:text-[#F2F2F2]'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      'shrink-0 transition-colors',
                      isActive ? item.accentClass : 'text-[#737378] group-hover:text-[#A3A3A8]'
                    )}
                  >
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-tight whitespace-nowrap">
                      {item.label}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-[#737378]">
                      {item.subtitle}
                    </div>
                  </div>
                </div>
                {item.phaseNote && (
                  <span className="font-mono text-[10px] text-[#737378] shrink-0 ml-2">
                    {item.phaseNote}
                  </span>
                )}
              </a>
            );
          })}
        </nav>
      </div>

      {/* Bottom utilities */}
      <div className="space-y-2 border-t border-white/[0.07] pt-4">
        {isModified && (
          <button
            type="button"
            onClick={resetDemoState}
            className="flex w-full items-center justify-between rounded-xl border border-[#96D2C5]/25 bg-[#96D2C5]/[0.08] px-3 py-2 text-xs font-medium text-[#96D2C5] transition-colors hover:bg-[#96D2C5]/15 cursor-pointer"
          >
            <span>Reset demo state</span>
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}

        <a
          href="/settings"
          onClick={(e) => handleSpaLinkClick(e, '/settings', onNavigate, onCloseMobile)}
          aria-current={activeSection === 'settings' ? 'page' : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59585]',
            activeSection === 'settings'
              ? 'bg-[#262626] text-[#F2F2F2]'
              : 'text-[#A3A3A8] hover:bg-white/[0.04] hover:text-[#F2F2F2]'
          )}
        >
          <Settings className="h-4 w-4 shrink-0 text-[#737378]" />
          <span className="whitespace-nowrap">Settings & UI Kit</span>
        </a>

        {!isAuthLoading && (
          user ? (
            <button
              type="button"
              onClick={() => {
                onCloseMobile();
                void signOutUser();
              }}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium text-[#A3A3A8] transition-colors hover:bg-white/[0.04] hover:text-[#F2F2F2] cursor-pointer"
            >
              <span className="truncate">{user.displayName || user.email}</span>
              <LogOut className="h-3.5 w-3.5 shrink-0 text-[#737378]" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSigningIn}
              onClick={() => {
                onCloseMobile();
                void signInWithGoogle();
              }}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#E59585]/25 bg-[#E59585]/[0.08] px-3 py-2 text-xs font-medium text-[#E59585] transition-colors hover:bg-[#E59585]/15 cursor-pointer disabled:opacity-50"
            >
              <span>{isSigningIn ? 'Signing in...' : 'Sign in with Google'}</span>
              <LogIn className="h-3.5 w-3.5 shrink-0" />
            </button>
          )
        )}

        <div className="px-3 pt-1 text-[11px] leading-relaxed text-[#737378]">
          Tasks live · Previews isolated
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Persistent Desktop Sidebar */}
      <aside className="hidden lg:block lg:w-[244px] lg:shrink-0">
        <div className="sticky top-0 h-screen">{navContent}</div>
      </aside>

      {/* Tablet & Mobile Slide-over Navigation Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-[2px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full w-[264px] max-w-[82vw]">{navContent}</div>
        </div>
      )}
    </>
  );
}
