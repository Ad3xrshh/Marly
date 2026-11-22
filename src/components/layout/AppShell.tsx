import React, { useState } from 'react';
import { HabitFormDialog } from '../../features/live/HabitFormDialog';
import { RoutineFormDialog } from '../../features/live/RoutineFormDialog';
import { WorkoutFormDialog } from '../../features/live/WorkoutFormDialog';
import { CalendarEventFormDialog } from '../../features/plan/CalendarEventFormDialog';
import { GoalFormDialog } from '../../features/plan/GoalFormDialog';
import { ProjectFormDialog } from '../../features/plan/ProjectFormDialog';
import { TaskFormDialog } from '../../features/plan/TaskFormDialog';
import { RouteState } from '../../types/marly';
import { MobileBottomNav } from './MobileBottomNav';
import { QuickAddDialog } from './QuickAddDialog';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface AppShellProps {
  route: RouteState;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export function AppShell({ route, onNavigate, children }: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  return (
    <div className="marly-dot-canvas min-h-screen text-[#F2F2F2] flex">
      <Sidebar
        activeSection={route.section}
        onNavigate={onNavigate}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          route={route}
          onOpenMenu={() => setMobileMenuOpen(true)}
          onOpenQuickAdd={() => setQuickAddOpen(true)}
          onNavigate={onNavigate}
        />

        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pt-6 md:pb-10 lg:px-8">
          {children}
        </main>
      </div>

      <MobileBottomNav
        activeSection={route.section}
        onNavigate={onNavigate}
        onOpenQuickAdd={() => setQuickAddOpen(true)}
        onOpenMore={() => setMobileMenuOpen(true)}
      />

      <QuickAddDialog
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onNavigate={onNavigate}
      />

      <TaskFormDialog />
      <CalendarEventFormDialog />
      <ProjectFormDialog />
      <GoalFormDialog />
      <HabitFormDialog />
      <WorkoutFormDialog />
      <RoutineFormDialog />
    </div>
  );
}
