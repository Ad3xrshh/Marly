import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Checkbox, Dialog, Input } from '../../components/ui';
import { useCalendarContext } from '../../context/CalendarContext';
import {
  addDaysLocal,
  combineLocalDateAndTimeToIso,
  parseLocalDate,
  toLocalTimeInputValue,
} from '../../types/calendar';
import {
  TASK_CATEGORY_OPTIONS,
  toLocalDateString,
  type TaskCategory,
} from '../../types/task';

export function CalendarEventFormDialog() {
  const {
    dialogState,
    closeEventDialog,
    createEvent,
    updateEvent,
    deleteEvent,
    isMutating,
  } = useCalendarContext();

  const { open, mode, event, defaultDate, defaultStartHour } = dialogState;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('Work');
  const [allDay, setAllDay] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');

  const [titleError, setTitleError] = useState<string | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitleError(null);
    setRangeError(null);
    setConfirmingDelete(false);

    if (mode === 'edit' && event) {
      setTitle(event.title);
      setDescription(event.description ?? '');
      setCategory(event.category);
      setAllDay(event.allDay);

      if (event.allDay) {
        const sDate = event.startDate ?? defaultDate;
        const eDate = event.endDate ?? sDate;
        setStartDate(sDate);
        setEndDate(eDate);
        setStartTime('09:00');
        setEndTime('10:00');
      } else {
        const start = event.startAt ? new Date(event.startAt) : new Date();
        const end = event.endAt ? new Date(event.endAt) : new Date(start.getTime() + 60 * 60 * 1000);
        setStartDate(toLocalDateString(start));
        setStartTime(toLocalTimeInputValue(start));
        setEndDate(toLocalDateString(end));
        setEndTime(toLocalTimeInputValue(end));
      }
      return;
    }

    // Create mode
    setTitle('');
    setDescription('');
    setCategory('Work');
    setAllDay(false);
    setStartDate(defaultDate);

    if (typeof defaultStartHour === 'number') {
      const clampedHour = Math.max(0, Math.min(23, defaultStartHour));
      const startH = String(clampedHour).padStart(2, '0');
      setStartTime(`${startH}:00`);

      if (clampedHour === 23) {
        const nextDay = toLocalDateString(addDaysLocal(parseLocalDate(defaultDate), 1));
        setEndDate(nextDay);
        setEndTime('00:00');
      } else {
        const endH = String(clampedHour + 1).padStart(2, '0');
        setEndDate(defaultDate);
        setEndTime(`${endH}:00`);
      }
    } else {
      setStartTime('09:00');
      setEndDate(defaultDate);
      setEndTime('10:00');
    }
  }, [open, mode, event, defaultDate, defaultStartHour]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError('Event title is required');
      return;
    }

    if (!startDate) {
      setRangeError('Start date is required');
      return;
    }

    if (allDay) {
      const effectiveEndDate = endDate || startDate;
      if (effectiveEndDate < startDate) {
        setRangeError('End date cannot be earlier than start date');
        return;
      }

      const payload = {
        title: trimmedTitle,
        description: description.trim() ? description.trim() : null,
        category,
        allDay: true,
        startDate,
        endDate: effectiveEndDate,
        startAt: null,
        endAt: null,
      };

      if (mode === 'edit' && event) {
        const updated = await updateEvent(event.id, payload);
        if (updated) closeEventDialog();
      } else {
        const created = await createEvent(payload);
        if (created) closeEventDialog();
      }
      return;
    }

    const effectiveEndDate = endDate || startDate;
    if (!startTime || !endTime) {
      setRangeError('Start and end times are required');
      return;
    }

    const startIso = combineLocalDateAndTimeToIso(startDate, startTime);
    const endIso = combineLocalDateAndTimeToIso(effectiveEndDate, endTime);

    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setRangeError('End date/time must be after start date/time');
      return;
    }

    const payload = {
      title: trimmedTitle,
      description: description.trim() ? description.trim() : null,
      category,
      allDay: false,
      startDate: null,
      endDate: null,
      startAt: startIso,
      endAt: endIso,
    };

    if (mode === 'edit' && event) {
      const updated = await updateEvent(event.id, payload);
      if (updated) closeEventDialog();
    } else {
      const created = await createEvent(payload);
      if (created) closeEventDialog();
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    const deleted = await deleteEvent(event.id);
    if (deleted) closeEventDialog();
  };

  return (
    <Dialog
      open={open}
      onClose={closeEventDialog}
      title={mode === 'edit' ? 'Edit Calendar Event' : 'New Calendar Event'}
      subtitle={
        mode === 'edit'
          ? 'Update scheduled timing, details, or category.'
          : 'Schedule a timed block or all-day event on your calendar.'
      }
      maxWidthClass="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Event Title"
          placeholder="e.g. Deep work: Q2 architecture spec"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (titleError) setTitleError(null);
          }}
          onClear={() => setTitle('')}
          error={titleError ?? undefined}
          maxLength={160}
          autoFocus
        />

        <div>
          <label
            htmlFor="event-description"
            className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
          >
            Description
          </label>
          <textarea
            id="event-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder="Optional agenda, location, or focus notes..."
            className="w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3.5 py-2.5 text-sm text-[#F2F2F2] placeholder:text-[#737378] transition-colors focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#A9C8E9]/70"
          />
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="event-category"
              className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
            >
              Category
            </label>
            <select
              id="event-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as TaskCategory)}
              className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#A9C8E9]/70"
            >
              {TASK_CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end pb-1">
            <Checkbox
              checked={allDay}
              onChange={() => {
                setAllDay((prev) => !prev);
                if (rangeError) setRangeError(null);
              }}
              shape="square"
              tone="blue"
              label="All-day event"
            />
          </div>
        </div>

        {allDay ? (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="event-allday-start"
                className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
              >
                Start Date
              </label>
              <input
                id="event-allday-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  const nextStart = e.target.value;
                  setStartDate(nextStart);
                  if (!endDate || endDate < nextStart) {
                    setEndDate(nextStart);
                  }
                  if (rangeError) setRangeError(null);
                }}
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 font-mono text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#A9C8E9]/70"
              />
            </div>

            <div>
              <label
                htmlFor="event-allday-end"
                className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
              >
                End Date
              </label>
              <input
                id="event-allday-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  if (rangeError) setRangeError(null);
                }}
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 font-mono text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#A9C8E9]/70"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="event-start-date"
                  className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
                >
                  Start Date
                </label>
                <input
                  id="event-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setStartDate(nextStart);
                    if (!endDate || endDate < nextStart) {
                      setEndDate(nextStart);
                    }
                    if (rangeError) setRangeError(null);
                  }}
                  className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 font-mono text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#A9C8E9]/70"
                />
              </div>

              <div>
                <label
                  htmlFor="event-start-time"
                  className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
                >
                  Start Time
                </label>
                <input
                  id="event-start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    if (rangeError) setRangeError(null);
                  }}
                  className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 font-mono text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#A9C8E9]/70"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="event-end-date"
                  className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
                >
                  End Date
                </label>
                <input
                  id="event-end-date"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    if (rangeError) setRangeError(null);
                  }}
                  className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 font-mono text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#A9C8E9]/70"
                />
              </div>

              <div>
                <label
                  htmlFor="event-end-time"
                  className="mb-1.5 block text-xs font-medium text-[#A3A3A8]"
                >
                  End Time
                </label>
                <input
                  id="event-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    if (rangeError) setRangeError(null);
                  }}
                  className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#262626] px-3 font-mono text-sm text-[#F2F2F2] focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-[#A9C8E9]/70"
                />
              </div>
            </div>
          </div>
        )}

        {rangeError && (
          <p className="rounded-xl border border-[#E06C75]/35 bg-[#E06C75]/10 px-3 py-2 text-xs text-[#E06C75]">
            {rangeError}
          </p>
        )}

        <div className="flex flex-col-reverse justify-between gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center">
          <div>
            {mode === 'edit' && event && (
              confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={isMutating}
                    onClick={handleDelete}
                  >
                    Confirm delete
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isMutating}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Keep
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leadingIcon={<Trash2 className="h-3.5 w-3.5" />}
                  disabled={isMutating}
                  onClick={() => setConfirmingDelete(true)}
                  className="text-[#E06C75] hover:bg-[#E06C75]/10 hover:text-[#E06C75]"
                >
                  Delete
                </Button>
              )
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isMutating}
              onClick={closeEventDialog}
            >
              Cancel
            </Button>
            <Button type="submit" variant="coral" size="sm" disabled={isMutating}>
              {isMutating
                ? mode === 'edit'
                  ? 'Saving...'
                  : 'Scheduling...'
                : mode === 'edit'
                  ? 'Save Changes'
                  : 'Create Event'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
