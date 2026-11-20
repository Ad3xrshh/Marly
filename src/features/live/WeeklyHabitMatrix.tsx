import React from 'react';
import { useWeeklyMatrixData } from '../../hooks/useMarlyData';
import { Card, Checkbox, ProgressBar } from '../../components/ui';

export function WeeklyHabitMatrix() {
  const { weekRangeLabel, weekdays, matrixHabits, toggleMatrixCell } = useWeeklyMatrixData();

  const totalCells = matrixHabits.length * weekdays.length;
  const totalChecked = matrixHabits.reduce(
    (sum, habit) => sum + habit.days.filter(Boolean).length,
    0
  );
  const weeklyPercent = totalCells > 0 ? Math.round((totalChecked / totalCells) * 100) : 0;

  const habitRates = matrixHabits.map((h) => ({
    name: h.name,
    count: h.days.filter(Boolean).length,
  }));
  const bestHabit = [...habitRates].sort((a, b) => b.count - a.count)[0];
  const attentionHabit = [...habitRates].sort((a, b) => a.count - b.count)[0];

  return (
    <div className="space-y-5">
      {/* Compact Weekly Summary Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card tone="surface" padding="sm">
          <p className="text-xs text-[#A3A3A8]">Habits checked</p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#F2F2F2] tabular-nums">
            {totalChecked}
            <span className="text-sm font-normal text-[#737378]">/{totalCells}</span>
          </p>
        </Card>
        <Card tone="surface" padding="sm">
          <p className="text-xs text-[#A3A3A8]">Weekly completion</p>
          <p className="mt-1 font-mono text-2xl font-bold text-[#96D2C5] tabular-nums">
            {weeklyPercent}%
          </p>
        </Card>
        <Card tone="surface" padding="sm">
          <p className="text-xs text-[#A3A3A8]">Strongest habit</p>
          <p className="mt-1 truncate text-base font-semibold text-[#F2F2F2]">
            {bestHabit?.name}
          </p>
          <p className="font-mono text-xs text-[#96D2C5] tabular-nums">
            {bestHabit?.count}/7 days
          </p>
        </Card>
        <Card tone="surface" padding="sm">
          <p className="text-xs text-[#A3A3A8]">Needs attention</p>
          <p className="mt-1 truncate text-base font-semibold text-[#F2F2F2]">
            {attentionHabit?.name}
          </p>
          <p className="font-mono text-xs text-[#F19A50] tabular-nums">
            {attentionHabit?.count}/7 days
          </p>
        </Card>
      </div>

      {/* Reference 4 inspired Weekly Habit Matrix Table */}
      <Card tone="surface" padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-[#F2F2F2]">Weekly Habit Matrix</h3>
            <p className="text-xs text-[#A3A3A8]">
              Click any day cell to preview live recalculation across rows and totals.
            </p>
          </div>
          <span className="font-mono text-xs text-[#A3A3A8]">{weekRangeLabel}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/[0.07] bg-[#1B1B1B] text-xs font-medium text-[#A3A3A8]">
                <th className="py-3 pl-5 pr-4 w-36">Day</th>
                {matrixHabits.map((habit) => (
                  <th key={habit.id} className="px-3 py-3 text-center">
                    <div className="font-semibold text-[#F2F2F2] whitespace-nowrap">
                      {habit.name}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] font-normal text-[#737378]">
                      {habit.targetLabel}
                    </div>
                  </th>
                ))}
                <th className="py-3 pl-4 pr-5 w-44">Progress</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.06]">
              {weekdays.map((weekday, dayIndex) => {
                const completedToday = matrixHabits.filter((h) => h.days[dayIndex]).length;
                const rowPercent = Math.round((completedToday / matrixHabits.length) * 100);

                return (
                  <tr
                    key={weekday}
                    className="transition-colors hover:bg-white/[0.025]"
                  >
                    <td className="py-2 pl-5 pr-4 text-sm font-medium text-[#F2F2F2] whitespace-nowrap">
                      {weekday}
                    </td>

                    {matrixHabits.map((habit) => (
                      <td key={habit.id} className="px-2 py-1.5 text-center">
                        <div className="inline-flex items-center justify-center">
                          <Checkbox
                            shape="square"
                            tone="blue"
                            size="md"
                            hitTarget="cell"
                            checked={habit.days[dayIndex]}
                            onChange={() => toggleMatrixCell(habit.id, dayIndex)}
                            ariaLabel={`${habit.name} on ${weekday}`}
                          />
                        </div>
                      </td>
                    ))}

                    <td className="py-2 pl-4 pr-5">
                      <ProgressBar value={rowPercent} tone="mint" showLabel />
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="border-t border-white/[0.08] bg-[#1B1B1B] text-xs text-[#A3A3A8]">
                <td className="py-3 pl-5 pr-4 font-medium">Checked</td>
                {matrixHabits.map((habit) => {
                  const total = habit.days.filter(Boolean).length;
                  return (
                    <td key={habit.id} className="px-3 py-3 text-center font-mono tabular-nums">
                      <span className="font-semibold text-[#F2F2F2]">{total}</span>
                      <span className="text-[#737378]">/7</span>
                    </td>
                  );
                })}
                <td className="py-3 pl-4 pr-5 font-mono text-right font-semibold text-[#96D2C5] tabular-nums">
                  {weeklyPercent}% avg
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
