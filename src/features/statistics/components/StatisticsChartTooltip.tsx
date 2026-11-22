import React from 'react';

interface TooltipPayloadItem {
  name?: string;
  value?: number | string | null;
  color?: string;
  dataKey?: string;
  payload?: Record<string, unknown>;
}

interface StatisticsChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  formatValue?: (value: number | string | null | undefined, item: TooltipPayloadItem) => string;
  footerNote?: (payloadObj: Record<string, unknown>) => string | null;
}

export function StatisticsChartTooltip({
  active,
  payload,
  label,
  formatValue,
  footerNote,
}: StatisticsChartTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const firstPayload = payload[0]?.payload;
  const headerLabel =
    firstPayload && typeof firstPayload.rangeLabel === 'string'
      ? firstPayload.rangeLabel
      : label;

  const note = firstPayload && footerNote ? footerNote(firstPayload) : null;

  return (
    <div className="min-w-[168px] rounded-xl border border-white/[0.12] bg-[#18181B] px-3 py-2.5 shadow-xl">
      {headerLabel && (
        <p className="mb-1.5 text-[11px] font-semibold text-[#F2F2F2]">{headerLabel}</p>
      )}
      <div className="space-y-1">
        {payload.map((entry, idx) => {
          const displayValue = formatValue
            ? formatValue(entry.value, entry)
            : String(entry.value ?? '—');
          return (
            <div
              key={`${entry.dataKey ?? entry.name ?? idx}`}
              className="flex items-center justify-between gap-4 text-[11px]"
            >
              <span className="flex items-center gap-1.5 text-[#A3A3A8]">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-xs shrink-0"
                  style={{ backgroundColor: entry.color || '#A3A3A8' }}
                />
                <span>{entry.name}</span>
              </span>
              <span className="font-mono font-semibold text-[#F2F2F2] tabular-nums">
                {displayValue}
              </span>
            </div>
          );
        })}
      </div>
      {note && (
        <p className="mt-1.5 border-t border-white/[0.08] pt-1.5 text-[10px] text-[#737378] tabular-nums">
          {note}
        </p>
      )}
    </div>
  );
}
