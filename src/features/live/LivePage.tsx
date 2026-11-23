import React from 'react';
import { LiveSubTab } from '../../types/marly';
import { SegmentedTabs } from '../../components/ui';
import { ActivityHeatmap } from './ActivityHeatmap';
import { LiveFitnessRoutinesView } from './LiveFitnessRoutinesView';
import { LiveHabitsView } from './LiveHabitsView';
import { MonthlyHabitCalendar } from './MonthlyHabitCalendar';
import { WeeklyHabitMatrix } from './WeeklyHabitMatrix';

interface LivePageProps {
  activeTab: LiveSubTab;
  search?: string;
  onNavigate: (path: string) => void;
}

const LIVE_TABS: Array<{ value: LiveSubTab; label: string; href: string }> = [
  { value: 'habits', label: 'Habits', href: '/live/habits' },
  { value: 'calendar', label: 'Habit Calendar', href: '/live/calendar' },
  { value: 'matrix', label: 'Weekly Matrix', href: '/live/matrix' },
  { value: 'heatmap', label: 'Activity Heatmap', href: '/live/heatmap' },
  { value: 'fitness', label: 'Fitness & Routines', href: '/live/fitness' },
];

export function LivePage({ activeTab, search = '', onNavigate }: LivePageProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#F2F2F2]">
            LIVE · Consistency & Activity
          </h2>
          <p className="mt-1 text-sm text-[#A3A3A8]">
            Scheduled habits, timezone-safe logs, workout tracking, and repeatable step routines.
          </p>
        </div>

        <SegmentedTabs
          options={LIVE_TABS}
          value={activeTab}
          onChange={(tab) => onNavigate(`/live/${tab}`)}
        />
      </div>

      {activeTab === 'habits' && <LiveHabitsView search={search} />}
      {activeTab === 'calendar' && <MonthlyHabitCalendar />}
      {activeTab === 'matrix' && <WeeklyHabitMatrix />}
      {activeTab === 'heatmap' && <ActivityHeatmap />}
      {activeTab === 'fitness' && <LiveFitnessRoutinesView search={search} />}
    </div>
  );
}
