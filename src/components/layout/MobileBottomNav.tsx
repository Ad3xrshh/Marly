import React from 'react';
import { Activity, CalendarCheck2, Home, Menu, Plus } from 'lucide-react';
import { cn } from '../../lib/cn';
import { handleSpaLinkClick } from '../../lib/router';
import { PrimaryRoute } from '../../types/marly';

interface MobileBottomNavProps {
  activeSection: PrimaryRoute;
  onNavigate: (path: string) => void;
  onOpenQuickAdd: () => void;
  onOpenMore: () => void;
}

export function MobileBottomNav({
  activeSection,
  onNavigate,
  onOpenQuickAdd,
  onOpenMore,
}: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#181818]/95 backdrop-blur-md md:hidden"
    >
      <div className="mx-auto grid h-14 max-w-md grid-cols-5 items-center px-2">
        <a
          href="/"
          onClick={(e) => handleSpaLinkClick(e, '/', onNavigate)}
          aria-current={activeSection === 'home' ? 'page' : undefined}
          className={cn(
            'flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium cursor-pointer',
            activeSection === 'home' ? 'text-[#F2F2F2]' : 'text-[#737378]'
          )}
        >
          <Home className="h-4 w-4" />
          <span>Home</span>
        </a>

        <a
          href="/plan/tasks"
          onClick={(e) => handleSpaLinkClick(e, '/plan/tasks', onNavigate)}
          aria-current={activeSection === 'plan' ? 'page' : undefined}
          className={cn(
            'flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium cursor-pointer',
            activeSection === 'plan' ? 'text-[#E59585]' : 'text-[#737378]'
          )}
        >
          <CalendarCheck2 className="h-4 w-4" />
          <span>Plan</span>
        </a>

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onOpenQuickAdd}
            aria-label="Quick Add"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E59585] text-[#151515] shadow-md active:scale-95 cursor-pointer"
          >
            <Plus className="h-5 w-5 stroke-[2.4]" />
          </button>
        </div>

        <a
          href="/live/calendar"
          onClick={(e) => handleSpaLinkClick(e, '/live/calendar', onNavigate)}
          aria-current={activeSection === 'live' ? 'page' : undefined}
          className={cn(
            'flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium cursor-pointer',
            activeSection === 'live' ? 'text-[#96D2C5]' : 'text-[#737378]'
          )}
        >
          <Activity className="h-4 w-4" />
          <span>Live</span>
        </a>

        <button
          type="button"
          onClick={onOpenMore}
          className={cn(
            'flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium cursor-pointer',
            activeSection === 'think' ||
              activeSection === 'statistics' ||
              activeSection === 'settings'
              ? 'text-[#F2F2F2]'
              : 'text-[#737378]'
          )}
        >
          <Menu className="h-4 w-4" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
