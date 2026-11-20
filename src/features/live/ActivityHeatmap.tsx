import React, { useState } from 'react';
import { useActivityHeatmapData } from '../../hooks/useMarlyData';
import { Card } from '../../components/ui';
import { cn } from '../../lib/cn';
import { DemoHeatmapCell } from '../../types/marly';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const LEVEL_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-[#292929]',
  1: 'bg-[#6B4423]',
  2: 'bg-[#A3632C]',
  3: 'bg-[#D88138]',
  4: 'bg-[#F19A50]',
};

export function ActivityHeatmap() {
  const { cells, stats, monthlyTrend, weekdayFrequency } = useActivityHeatmapData();
  const [inspectedCell, setInspectedCell] = useState<DemoHeatmapCell | null>(null);

  const weeks: DemoHeatmapCell[][] = Array.from({ length: 52 }, (_, weekIdx) =>
    cells.filter((cell) => cell.weekIndex === weekIdx)
  );

  const maxWeekdayCount = Math.max(...weekdayFrequency.map((d) => d.count));

  // Build smooth SVG polyline/area coordinates for 12-month trend
  const maxTrend = Math.max(...monthlyTrend.map((m) => m.value));
  const svgWidth = 360;
  const svgHeight = 96;
  const points = monthlyTrend.map((item, i) => {
    const x = (i / (monthlyTrend.length - 1)) * svgWidth;
    const y = svgHeight - 10 - (item.value / maxTrend) * (svgHeight - 24);
    return { x, y };
  });
  const linePath = points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${svgWidth} ${svgHeight} L 0 ${svgHeight} Z`;

  return (
    <div className="space-y-5">
      {/* Reference 3 inspired Yearly Contribution Heatmap */}
      <Card tone="surface" padding="lg">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-[#F2F2F2]">Activity History</h3>
            <p className="text-xs text-[#A3A3A8]">
              {inspectedCell
                ? `${inspectedCell.dateLabel} · ${inspectedCell.summary}`
                : 'Proportional daily completion intensity across 52 weeks (hover or tap a day)'}
            </p>
          </div>
          <span className="font-mono text-xs text-[#737378]">2026 Overview</span>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="min-w-[740px]">
            {/* Month labels */}
            <div className="mb-2 grid grid-cols-12 text-xs text-[#737378]">
              {MONTHS.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>

            {/* 52 columns x 7 rows */}
            <div className="grid grid-cols-[repeat(52,minmax(0,1fr))] gap-[3px]">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="grid grid-rows-7 gap-[3px]">
                  {week.map((cell) => {
                    const isUnscheduled = cell.kind === 'unscheduled';
                    const isSelected =
                      inspectedCell?.weekIndex === cell.weekIndex &&
                      inspectedCell?.dayIndex === cell.dayIndex;
                    return (
                      <button
                        key={`${cell.weekIndex}-${cell.dayIndex}`}
                        type="button"
                        onMouseEnter={() => setInspectedCell(cell)}
                        onFocus={() => setInspectedCell(cell)}
                        onClick={() => setInspectedCell(cell)}
                        aria-label={`${cell.dateLabel}: ${cell.summary}`}
                        className={cn(
                          'aspect-square w-full rounded-[3px] transition-transform duration-100 hover:scale-125 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F2F2F2] cursor-pointer',
                          isUnscheduled
                            ? 'bg-transparent border border-white/[0.1]'
                            : LEVEL_COLORS[cell.level],
                          isSelected && 'ring-1 ring-[#F2F2F2]'
                        )}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Distinct Unscheduled vs 0% Missed + Intensity Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-end gap-5 text-xs text-[#737378]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[3px] border border-white/[0.14] bg-transparent" />
            <span>Unscheduled</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span>0%</span>
            <span className="h-3 w-3 rounded-[3px] bg-[#292929]" title="0% missed scheduled day" />
            <span className="h-3 w-3 rounded-[3px] bg-[#6B4423]" title="1–25%" />
            <span className="h-3 w-3 rounded-[3px] bg-[#A3632C]" title="26–50%" />
            <span className="h-3 w-3 rounded-[3px] bg-[#D88138]" title="51–75%" />
            <span className="h-3 w-3 rounded-[3px] bg-[#F19A50]" title="76–100%" />
            <span>100%</span>
          </span>
        </div>
      </Card>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card tone="surface" padding="lg" className="text-center">
          <div className="font-mono text-2xl font-bold text-[#F2F2F2] tabular-nums">
            {stats.totalCompletions}{' '}
            <span className="text-sm font-normal text-[#A3A3A8]">Times</span>
          </div>
          <div className="mt-1 text-xs text-[#737378]">Last year</div>
        </Card>
        <Card tone="surface" padding="lg" className="text-center">
          <div className="font-mono text-2xl font-bold text-[#F2F2F2] tabular-nums">
            {stats.activeDays}{' '}
            <span className="text-sm font-normal text-[#A3A3A8]">Days</span>
          </div>
          <div className="mt-1 text-xs text-[#737378]">
            out of {stats.scheduledDays} scheduled
          </div>
        </Card>
        <Card tone="surface" padding="lg" className="text-center">
          <div className="font-mono text-2xl font-bold text-[#F19A50] tabular-nums">
            {stats.completionRate}%
          </div>
          <div className="mt-1 text-xs text-[#737378]">Completion rate</div>
        </Card>
        <Card tone="surface" padding="lg" className="text-center">
          <div className="font-mono text-2xl font-bold text-[#F2F2F2] tabular-nums">
            {stats.currentStreak}{' '}
            <span className="text-sm font-normal text-[#A3A3A8]">Days</span>
          </div>
          <div className="mt-1 text-xs text-[#737378]">Current streak</div>
        </Card>
      </div>

      {/* Bottom 2 Trend Cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card tone="surface" padding="lg" className="flex flex-col justify-between overflow-hidden">
          <div>
            <div className="font-mono text-2xl font-bold text-[#F2F2F2] tabular-nums">
              {stats.totalCompletions}{' '}
              <span className="text-base font-normal text-[#A3A3A8]">times</span>
            </div>
            <p className="mt-0.5 text-xs text-[#737378]">in 12 months (demo trend)</p>
          </div>
          <div className="mt-5">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-24 w-full overflow-visible">
              <path d={areaPath} fill="rgba(241, 154, 80, 0.14)" />
              <path
                d={linePath}
                fill="none"
                stroke="#F19A50"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </Card>

        <Card tone="surface" padding="lg" className="flex flex-col justify-between">
          <div>
            <div className="text-2xl font-bold text-[#F2F2F2]">{stats.peakDayName}</div>
            <p className="mt-0.5 text-xs text-[#737378]">Most frequent completion day</p>
          </div>

          <div className="mt-5 grid grid-cols-7 items-end gap-2.5 h-24">
            {weekdayFrequency.map((item) => {
              const heightPct = Math.max(12, Math.round((item.count / maxWeekdayCount) * 100));
              const isPeak = item.day === 'Tue';
              return (
                <div key={item.day} className="flex h-full flex-col items-center justify-end gap-1.5">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className={cn(
                        'w-full rounded-t-md border transition-colors',
                        isPeak
                          ? 'border-[#F19A50] bg-[#F19A50]/25'
                          : 'border-[#F19A50]/60 bg-[#F19A50]/[0.06]'
                      )}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-[#737378]">{item.day}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
