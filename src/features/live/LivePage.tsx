import React from 'react';
import { LiveSubTab } from '../../types/marly';
import { PreviewNotice, SegmentedTabs } from '../../components/ui';
import { ActivityHeatmap } from './ActivityHeatmap';
import { FitnessRoutinesPreview, HabitsListPreview } from './HabitsAndFitnessPreview';
import { MonthlyHabitCalendar } from './MonthlyHabitCalendar';
import { WeeklyHabitMatrix } from './WeeklyHabitMatrix';

interface LivePageProps {
  activeTab: LiveSubTab;
  onNavigate: (path: string) => void;
}

const LIVE_TABS: Array<{ value: LiveSubTab; label: string; href: string }> = [
  { value: 'calendar', label: 'Habit Calendar', href: '/live/calendar' },
  { value: 'matrix', label: 'Weekly Matrix', href: '/live/matrix' },
  { value: 'heatmap', label: 'Activity Heatmap', href: '/live/heatmap' },
  { value: 'habits', label: 'Habits', href: '/live/habits' },
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
            Monthly habit states, weekly matrix tracking, and yearly consistency heatmaps.
          </p>
        </div>

        <SegmentedTabs
          options={LIVE_TABS}
          value={activeTab}
          onChange={(tab) => onNavigate(`/live/${tab}`)}
        />
      </div>

      <PreviewNotice
        accent="mint"
        title="Visual Preview Only"
        phaseLabel="Phases 6–8"
        description="These interfaces demonstrate Marly's core LIVE tracking system using isolated sample data. Real habit definitions, local-timezone habit_logs, and server-side streak engines will be built in Phases 6–8."
      />

      {activeTab === 'calendar' && <MonthlyHabitCalendar />}
      {activeTab === 'matrix' && <WeeklyHabitMatrix />}
      {activeTab === 'heatmap' && <ActivityHeatmap />}
      {activeTab === 'habits' && <HabitsListPreview />}
      {activeTab === 'fitness' && <FitnessRoutinesPreview />}
    </div>
  );
}
