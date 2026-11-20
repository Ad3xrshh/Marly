import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useDemoState } from '../../context/DemoStateContext';
import { Button, PreviewNotice } from '../../components/ui';
import { HabitMomentumColumn } from './HabitMomentumColumn';
import { ScheduleTimelineColumn } from './ScheduleTimelineColumn';
import { TasksOverviewColumn } from './TasksOverviewColumn';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const { isModified, resetDemoState } = useDemoState();

  return (
    <div className="space-y-6">
      <PreviewNotice
        accent="coral"
        title="Welcome to Marly · Daily Overview"
        phaseLabel="Phase 1 UI Shell (Isolated Demo Data)"
        description="Check off tasks or habits to preview live local progress. Nothing is persisted to a database yet; full backend storage begins in Phase 3."
        action={
          isModified ? (
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={resetDemoState}
            >
              Reset demo
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-[310px_minmax(0,1fr)_360px] xl:items-start">
        <HabitMomentumColumn onNavigate={onNavigate} />
        <TasksOverviewColumn onNavigate={onNavigate} />
        <div className="md:col-span-2 xl:col-span-1">
          <ScheduleTimelineColumn onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}
