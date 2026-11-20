import React from 'react';
import {
  Activity,
  ArrowRight,
  Calendar,
  CheckSquare,
  Dumbbell,
  Target,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCalendarContext } from '../../context/CalendarContext';
import { useHabitsContext } from '../../context/HabitsContext';
import { useProjectsGoalsContext } from '../../context/ProjectsGoalsContext';
import { useTasksContext } from '../../context/TasksContext';
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
    description: 'Title, description, priority, category, status, and due date.',
    phase: 'Live · PLAN',
    targetPath: '/plan/tasks',
    accent: 'text-[#E59585] bg-[#E59585]/12',
    icon: <CheckSquare className="h-4 w-4" />,
  },
  {
    id: 'habit',
    title: 'New Habit',
    description: 'Binary or measurable target with daily, weekday, or weekly schedule.',
    phase: 'Live · LIVE',
    targetPath: '/live/habits',
    accent: 'text-[#96D2C5] bg-[#96D2C5]/12',
    icon: <Activity className="h-4 w-4" />,
  },
  {
    id: 'event',
    title: 'Schedule Block / Event',
    description: 'Dedicated calendar event or time slot distinct from task deadlines.',
    phase: 'Live · PLAN',
    targetPath: '/plan/calendar',
    accent: 'text-[#A9C8E9] bg-[#A9C8E9]/12',
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    id: 'goal',
    title: 'New Goal',
    description: 'Long-term intention broken down into ordered milestones.',
    phase: 'Live · PLAN',
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
  const { user, signInWithGoogle } = useAuth();
  const { openCreateTask } = useTasksContext();
  const { openCreateEvent } = useCalendarContext();
  const { openCreateHabit } = useHabitsContext();
  const { openCreateGoal } = useProjectsGoalsContext();
  const { pushToast } = useToast();

  const handleSelect = async (option: (typeof QUICK_ADD_OPTIONS)[number]) => {
    onClose();

    if (option.id === 'task') {
      if (user) {
        openCreateTask();
      } else {
        const signedIn = await signInWithGoogle();
        if (signedIn) {
          openCreateTask();
        } else {
          onNavigate('/plan/tasks');
        }
      }
      return;
    }

    if (option.id === 'habit') {
      if (user) {
        openCreateHabit();
      } else {
        const signedIn = await signInWithGoogle();
        if (signedIn) {
          openCreateHabit();
        } else {
          onNavigate('/live/habits');
        }
      }
      return;
    }

    if (option.id === 'event') {
      if (user) {
        openCreateEvent();
      } else {
        const signedIn = await signInWithGoogle();
        if (signedIn) {
          openCreateEvent();
        } else {
          onNavigate('/plan/calendar');
        }
      }
      return;
    }

    if (option.id === 'goal') {
      if (user) {
        openCreateGoal();
      } else {
        const signedIn = await signInWithGoogle();
        if (signedIn) {
          openCreateGoal();
        } else {
          onNavigate('/plan/goals');
        }
      }
      return;
    }

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
      subtitle="Create a new task or jump to an upcoming workspace destination."
    >
      <div className="divide-y divide-white/[0.07] rounded-xl border border-white/[0.07] bg-[#1A1A1A]">
        {QUICK_ADD_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => void handleSelect(option)}
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
