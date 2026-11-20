/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Compass } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { AppShell } from './components/layout/AppShell';
import { EmptyState } from './components/ui';
import { AuthProvider } from './context/AuthContext';
import { CalendarProvider } from './context/CalendarContext';
import { DemoStateProvider } from './context/DemoStateContext';
import { HabitsProvider } from './context/HabitsContext';
import { ProjectsGoalsProvider } from './context/ProjectsGoalsContext';
import { TasksProvider } from './context/TasksContext';
import { ToastProvider } from './context/ToastContext';
import { HomePage } from './features/home/HomePage';
import { LivePage } from './features/live/LivePage';
import { PlanPage } from './features/plan/PlanPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { StatisticsPage } from './features/statistics/StatisticsPage';
import { ThinkPage } from './features/think/ThinkPage';
import { useMarlyRoute } from './lib/router';

function MarlyWorkspace() {
  const { route, navigate } = useMarlyRoute();

  return (
    <AppShell route={route} onNavigate={navigate}>
      {route.isNotFound ? (
        <EmptyState
          icon={<Compass className="h-5 w-5 text-[#E59585]" />}
          title={`Route "${route.path}" not found`}
          description="This path does not match a Marly workspace destination yet. Return to the Home overview to continue exploring your workspace."
          actionLabel="Return to Home"
          onAction={() => navigate('/')}
        />
      ) : (
        <>
          {route.section === 'home' && <HomePage onNavigate={navigate} />}
          {route.section === 'plan' && <PlanPage activeTab={route.planTab} onNavigate={navigate} />}
          {route.section === 'live' && <LivePage activeTab={route.liveTab} onNavigate={navigate} />}
          {route.section === 'think' && <ThinkPage />}
          {route.section === 'statistics' && <StatisticsPage />}
          {route.section === 'settings' && <SettingsPage />}
        </>
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <AuthProvider>
          <TasksProvider>
            <ProjectsGoalsProvider>
              <CalendarProvider>
                <HabitsProvider>
                  <DemoStateProvider>
                    <MarlyWorkspace />
                  </DemoStateProvider>
                </HabitsProvider>
              </CalendarProvider>
            </ProjectsGoalsProvider>
          </TasksProvider>
        </AuthProvider>
      </ToastProvider>
    </MotionConfig>
  );
}
