import React from 'react';
import {
  Activity,
  Calendar,
  CheckSquare,
  Dumbbell,
  Target,
  ArrowRight,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { Dialog } from '../ui';

interface QuickAddDialogProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}

const QUICK_ADD_OPTIONS = [
  {
    id: 'task',
    title: 'New Task',
    description: 'Priority, due date, time block, and optional project link.',
    phase: 'Phase 3 · PLAN',
    targetPath: '/plan/tasks',
    accent: 'text-[#E59585] bg-[#E59585]/12',
    icon: <CheckSquare className="h-4 w-4" />,
  },
  {
    id: 'habit',
    title: 'New Habit',
    description: 'Binary or measurable target with custom weekday schedule.',
    phase: 'Phase 6 · LIVE',
    targetPath: '/live/habits',
    accent: 'text-[#96D2C5] bg-[#96D2C5]/12',
    icon: <Activity className="h-4 w-4" />,
  },
  {
    id: 'event',
    title: 'Schedule Block / Event',
    description: 'Dedicated calendar time slot distinct from task deadlines.',
    phase: 'Phase 4 · PLAN',
    targetPath: '/plan/calendar',
    accent: 'text-[#A9C8E9] bg-[#A9C8E9]/12',
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    id: 'goal',
    title: 'New Goal',
    description: 'Long-term intention broken down into ordered milestones.',
    phase: 'Phase 5 · PLAN',
    targetPath: '/plan/goals',
    accent: 'text-[#E59585] bg-[#E59585]/12',
    icon: <Target className="h-4 w-4" />,
  },
  {
    id: 'workout',
    title: 'Log Workout',
    description: 'Session duration, workout type, and optional exercise sets.',
    phase: 'Phase 8 · LIVE',
    targetPath: '/live/fitness',
    accent: 'text-[#F19A50] bg-[#F19A50]/12',
    icon: <Dumbbell className="h-4 w-4" />,
  },
];

export function QuickAddDialog({ open, onClose, onNavigate }: QuickAddDialogProps) {
  const { pushToast } = useToast();

  const handleSelect = (option: (typeof QUICK_ADD_OPTIONS)[number]) => {
    onClose();
    onNavigate(option.targetPath);
    pushToast({
      title: `${option.title} preview`,
      description: `Creation forms and persistence arrive in ${option.phase}.`,
      variant: 'info',
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Quick Add"
      subtitle="Shell entry point for future creation flows. Select a destination to inspect its preview."
    >
      <div className="divide-y divide-white/[0.07] rounded-xl border border-white/[0.07] bg-[#1A1A1A]">
        {QUICK_ADD_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => handleSelect(option)}
            className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04] first:rounded-t-xl last:rounded-b-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59585]"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${option.accent}`}>
                {option.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#F2F2F2]">
                  <span>{option.title}</span>
                  <span className="text-[#737378]" aria-hidden="true">·</span>
                  <span className="font-mono text-[11px] font-normal text-[#A3A3A8]">
                    {option.phase}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[#A3A3A8]">{option.description}</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#737378]" />
          </button>
        ))}
      </div>
    </Dialog>
  );
}
