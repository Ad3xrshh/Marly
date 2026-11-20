import React from 'react';
import { Dumbbell, Flame, ListChecks } from 'lucide-react';
import { useFitnessAndRoutinesData, useHabitsMomentumData } from '../../hooks/useMarlyData';
import { Card, Checkbox } from '../../components/ui';

export function HabitsListPreview() {
  const { habits, toggleHabit } = useHabitsMomentumData();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {habits.map((habit) => (
        <Card key={habit.id} tone="surface" padding="md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="pt-0.5">
                <Checkbox
                  checked={habit.completedToday}
                  onChange={() => toggleHabit(habit.id)}
                  tone="mint"
                  ariaLabel={`Toggle ${habit.name}`}
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[#F2F2F2]">{habit.name}</h3>
                <p className="mt-1 text-xs text-[#A3A3A8]">
                  {habit.category}
                  <span aria-hidden="true"> · </span>
                  {habit.scheduleLabel}
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono">{habit.targetLabel}</span>
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#F19A50] tabular-nums shrink-0">
              <Flame className="h-3.5 w-3.5" />
              <span>{habit.streakDays}d</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function FitnessRoutinesPreview() {
  const { workouts, routines } = useFitnessAndRoutinesData();

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card tone="surface" padding="lg">
        <div className="flex items-center justify-between gap-3 pb-4">
          <div className="flex items-center gap-2.5">
            <Dumbbell className="h-4 w-4 text-[#F19A50]" />
            <h3 className="text-base font-semibold text-[#F2F2F2]">Recent Workouts (Demo)</h3>
          </div>
          <span className="font-mono text-xs text-[#737378]">Phase 8</span>
        </div>

        <div className="divide-y divide-white/[0.07]">
          {workouts.map((workout) => (
            <div
              key={workout.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-medium text-[#F2F2F2]">{workout.name}</p>
                <p className="mt-0.5 text-xs text-[#A3A3A8]">
                  {workout.type}
                  <span aria-hidden="true"> · </span>
                  <span className="font-mono">{workout.when}</span>
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-[#F19A50] tabular-nums">
                {workout.duration}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card tone="surface" padding="lg">
        <div className="flex items-center justify-between gap-3 pb-4">
          <div className="flex items-center gap-2.5">
            <ListChecks className="h-4 w-4 text-[#96D2C5]" />
            <h3 className="text-base font-semibold text-[#F2F2F2]">Routines (Demo)</h3>
          </div>
          <span className="font-mono text-xs text-[#737378]">Phase 8</span>
        </div>

        <div className="space-y-4">
          {routines.map((routine) => (
            <div key={routine.id} className="rounded-xl bg-[#262626] p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-[#F2F2F2]">{routine.name}</h4>
                <span className="font-mono text-[11px] text-[#A3A3A8]">{routine.schedule}</span>
              </div>
              <ol className="mt-2.5 space-y-1.5 text-xs text-[#A3A3A8]">
                {routine.steps.map((step, idx) => (
                  <li key={step} className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-[#737378]">{idx + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
