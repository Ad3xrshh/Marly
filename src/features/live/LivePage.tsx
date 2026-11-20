import React from 'react';
import { LiveSubTab } from '../../types/marly';
import { PreviewNotice, SegmentedTabs } from '../../components/ui';
import { ActivityHeatmap } from './ActivityHeatmap';
import { FitnessRoutinesPreview } from './HabitsAndFitnessPreview';
import { LiveHabitsView } from './LiveHabitsView';
import { MonthlyHabitCalendar } from './MonthlyHabitCalendar';
import { WeeklyHabitMatrix } from './WeeklyHabitMatrix';

interface LivePageProps {
  activeTab: LiveSubTab;
  onNavigate: (path: string) => void;
}

const LIVE_TABS: Array<{ value: LiveSubTab; label: string; href: string }> = [
  { value: 'habits', label: 'Habits', href: '/live/habits' },
  { value: 'calendar', label: 'Habit Calendar', href: '/live/calendar' },
  { value: 'matrix', label: 'Weekly Matrix', href: '/live/matrix' },
  { value: 'heatmap', label: 'Activity Heatmap', href: '/live/heatmap' },
  { value: 'fitness', label: 'Fitness & Routines', href: '/live/fitness' },
];

export function LivePage({ activeTab, onNavigate }: LivePageProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#F2F2F2]">
            LIVE · Consistency & Activity
          </h2>
          <p className="mt-1 text-sm text-[#A3A3A8]">
            Scheduled habits, timezone-safe completion logs, and visual consistency previews.
          </p>
        </div>

        <SegmentedTabs
          options={LIVE_TABS}
          value={activeTab}
          onChange={(tab) => onNavigate(`/live/${tab}`)}
        />
      </div>

      {activeTab !== 'habits' && (
        <PreviewNotice
          accent="mint"
          title="Visual Preview Only"
          phaseLabel="Phases 7–8"
          description="Habit management and daily logs in the Habits tab are backed by PostgreSQL. Calendar, matrix, heatmap, and fitness analytics views will connect in Phases 7–8."
        />
      )}

      {activeTab === 'habits' && <LiveHabitsView />}
      {activeTab === 'calendar' && <MonthlyHabitCalendar />}
      {activeTab === 'matrix' && <WeeklyHabitMatrix />}
      {activeTab === 'heatmap' && <ActivityHeatmap />}
      {activeTab === 'fitness' && <FitnessRoutinesPreview />}
    </div>
  );
}
