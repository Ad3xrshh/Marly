import React from 'react';
import { Calendar as CalendarIcon, CheckCircle2, Circle, Plus } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useScheduleData } from '../../hooks/useMarlyData';
import { Card, IconButton } from '../../components/ui';
import { cn } from '../../lib/cn';

interface ScheduleTimelineColumnProps {
  onNavigate: (path: string) => void;
}

const PERIODS: Array<'Morning' | 'Noon' | 'Evening'> = ['Morning', 'Noon', 'Evening'];

export function ScheduleTimelineColumn({ onNavigate }: ScheduleTimelineColumnProps) {
  const { weekDays, blocks, selectedDayKey, setSelectedDayKey } = useScheduleData();
  const { pushToast } = useToast();

  // Fall back cleanly to Today (Tue Mar 24) blocks for days without bespoke sample events
  const dayBlocks = blocks.filter((b) => b.dayKey === selectedDayKey);
  const blocksToRender =
    dayBlocks.length > 0 ? dayBlocks : blocks.filter((b) => b.dayKey === 'tue-24');

  const isFallbackDay = dayBlocks.length === 0;

  return (
    <Card tone="surface" padding="lg" className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-bold tracking-tight text-[#F2F2F2]">Calendar</h2>
          <button
            type="button"
            onClick={() => onNavigate('/plan/calendar')}
            className="text-xs font-medium text-[#A3A3A8] hover:text-[#E59585] cursor-pointer"
          >
            Full view
          </button>
        </div>
        <IconButton
          variant="light"
          label="Open Calendar preview"
          onClick={() => {
            onNavigate('/plan/calendar');
            pushToast({
              title: 'Calendar preview',
              description: 'Event & time-block creation arrives in Phase 4.',
              variant: 'info',
            });
          }}
        >
          <Plus className="h-4 w-4" />
        </IconButton>
      </div>

      {/* 7-Day Horizontal Selector */}
      <div className="mt-5 grid grid-cols-7 gap-1 border-b border-white/[0.07] pb-4">
        {weekDays.map((day) => {
          const active = day.key === selectedDayKey;
          return (
            <button
              key={day.key}
              type="button"
              onClick={() => setSelectedDayKey(day.key)}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl py-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E59585]',
                active
                  ? 'bg-[#292929] text-[#F2F2F2]'
                  : 'text-[#737378] hover:bg-white/[0.04] hover:text-[#A3A3A8]'
              )}
            >
              <span className="text-[11px] font-medium">{day.weekday}</span>
              <span
                className={cn(
                  'mt-1 font-mono text-sm tabular-nums',
                  active ? 'font-bold text-[#F2F2F2]' : 'font-medium'
                )}
              >
                {day.dayNumber}
              </span>
            </button>
          );
        })}
      </div>

      {isFallbackDay && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-[#A3A3A8]">
          <CalendarIcon className="h-3.5 w-3.5 text-[#A9C8E9]" />
          <span>Showing sample baseline schedule for demo preview</span>
        </div>
      )}

      {/* Time-block periods */}
      <div className="mt-4 flex-1 space-y-5">
        {PERIODS.map((period) => {
          const periodBlocks = blocksToRender.filter((b) => b.period === period);
          if (periodBlocks.length === 0) return null;

          return (
            <section key={period} className="space-y-2.5">
              <h3 className="text-xs font-medium text-[#737378]">{period}</h3>
              <div className="space-y-2.5">
                {periodBlocks.map((block) => (
                  <div
                    key={block.id}
                    className={cn(
                      'grid grid-cols-[62px_1fr] gap-3 rounded-2xl p-4 transition-colors',
                      block.featured
                        ? 'bg-[#E59585] text-[#151515]'
                        : 'bg-[#292929] text-[#F2F2F2]'
                    )}
                  >
                    <div className="flex flex-col justify-between">
                      <span
                        className={cn(
                          'font-mono text-xs font-semibold tabular-nums',
                          block.featured ? 'text-[#151515]' : 'text-[#A3A3A8]'
                        )}
                      >
                        {block.time}
                      </span>
                      {block.category && (
                        <span
                          className={cn(
                            'mt-2 text-[11px] font-medium',
                            block.featured ? 'text-[#151515]/75' : 'text-[#737378]'
                          )}
                        >
                          {block.category}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        {block.completed ? (
                          <CheckCircle2
                            className={cn(
                              'mt-0.5 h-4 w-4 shrink-0',
                              block.featured ? 'text-[#151515]' : 'text-[#96D2C5]'
                            )}
                          />
                        ) : (
                          <Circle
                            className={cn(
                              'mt-0.5 h-4 w-4 shrink-0',
                              block.featured ? 'text-[#151515]/60' : 'text-[#737378]'
                            )}
                          />
                        )}
                        <span className="text-sm font-semibold leading-snug">{block.title}</span>
                      </div>

                      {block.notes && block.notes.length > 0 && (
                        <ul
                          className={cn(
                            'mt-2 space-y-1 pl-6 text-xs',
                            block.featured ? 'text-[#151515]/80' : 'text-[#A3A3A8]'
                          )}
                        >
                          {block.notes.map((note) => (
                            <li key={note} className="list-disc">
                              {note}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Card>
  );
}
