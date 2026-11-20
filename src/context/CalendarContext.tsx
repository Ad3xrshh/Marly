import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  CalendarApiError,
  createCalendarEventRequest,
  deleteCalendarEventRequest,
  fetchCalendarEvents,
  updateCalendarEventRequest,
} from '../services/calendarApi';
import type {
  CalendarEvent,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from '../types/calendar';
import { getTodayLocalDate, toLocalDateString } from '../types/task';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

export interface CalendarEventDialogState {
  open: boolean;
  mode: 'create' | 'edit';
  event: CalendarEvent | null;
  defaultDate: string;
  defaultStartHour: number | null;
}

interface CalendarContextValue {
  events: CalendarEvent[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  dialogState: CalendarEventDialogState;
  refreshEvents: () => Promise<void>;
  createEvent: (input: CreateCalendarEventInput) => Promise<CalendarEvent | null>;
  updateEvent: (eventId: number, patch: UpdateCalendarEventInput) => Promise<CalendarEvent | null>;
  deleteEvent: (eventId: number) => Promise<boolean>;
  openCreateEvent: (options?: { defaultDate?: string; defaultStartHour?: number | null }) => void;
  openEditEvent: (event: CalendarEvent) => void;
  closeEventDialog: () => void;
}

const getInitialDialogState = (): CalendarEventDialogState => ({
  open: false,
  mode: 'create',
  event: null,
  defaultDate: getTodayLocalDate(),
  defaultStartHour: null,
});

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthLoading, getAccessToken } = useAuth();
  const { pushToast } = useToast();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<CalendarEventDialogState>(getInitialDialogState);

  const refreshEvents = useCallback(async () => {
    if (!user) {
      setEvents([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) {
        setEvents([]);
        return;
      }
      const nextEvents = await fetchCalendarEvents(token);
      setEvents(nextEvents);
    } catch (err) {
      const message =
        err instanceof CalendarApiError
          ? err.message
          : 'Unable to load calendar events right now. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [user, getAccessToken]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      setEvents([]);
      setError(null);
      setIsLoading(false);
      setDialogState(getInitialDialogState());
      return;
    }
    void refreshEvents();
  }, [user, isAuthLoading, refreshEvents]);

  const createEvent = useCallback(
    async (input: CreateCalendarEventInput): Promise<CalendarEvent | null> => {
      const token = await getAccessToken();
      if (!token) {
        pushToast({
          title: 'Sign in required',
          description: 'Sign in with Google to save calendar events.',
          variant: 'info',
        });
        return null;
      }

      setIsMutating(true);
      try {
        const created = await createCalendarEventRequest(token, input);
        setEvents((prev) => [...prev, created]);
        pushToast({
          title: 'Event scheduled',
          description: created.title,
          variant: 'success',
        });
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to create event.';
        pushToast({
          title: 'Could not create event',
          description: message,
          variant: 'warning',
        });
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, pushToast]
  );

  const updateEvent = useCallback(
    async (eventId: number, patch: UpdateCalendarEventInput): Promise<CalendarEvent | null> => {
      const token = await getAccessToken();
      if (!token) return null;

      setIsMutating(true);
      try {
        const updated = await updateCalendarEventRequest(token, eventId, patch);
        setEvents((prev) => prev.map((item) => (item.id === eventId ? updated : item)));
        pushToast({
          title: 'Event updated',
          description: updated.title,
          variant: 'success',
        });
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to update event.';
        pushToast({
          title: 'Could not update event',
          description: message,
          variant: 'warning',
        });
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, pushToast]
  );

  const deleteEvent = useCallback(
    async (eventId: number): Promise<boolean> => {
      const token = await getAccessToken();
      if (!token) return false;

      const target = events.find((e) => e.id === eventId);
      setIsMutating(true);
      try {
        await deleteCalendarEventRequest(token, eventId);
        setEvents((prev) => prev.filter((item) => item.id !== eventId));
        pushToast({
          title: 'Event deleted',
          description: target ? target.title : 'Removed from your calendar.',
          variant: 'info',
        });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to delete event.';
        pushToast({
          title: 'Could not delete event',
          description: message,
          variant: 'warning',
        });
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [getAccessToken, events, pushToast]
  );

  const openCreateEvent = useCallback(
    (options?: { defaultDate?: string; defaultStartHour?: number | null }) => {
      setDialogState({
        open: true,
        mode: 'create',
        event: null,
        defaultDate: options?.defaultDate ?? getTodayLocalDate(),
        defaultStartHour: options?.defaultStartHour ?? null,
      });
    },
    []
  );

  const openEditEvent = useCallback((event: CalendarEvent) => {
    const fallbackDate = event.startDate
      ? event.startDate
      : event.startAt
        ? toLocalDateString(new Date(event.startAt))
        : getTodayLocalDate();

    setDialogState({
      open: true,
      mode: 'edit',
      event,
      defaultDate: fallbackDate,
      defaultStartHour: null,
    });
  }, []);

  const closeEventDialog = useCallback(() => {
    setDialogState((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <CalendarContext.Provider
      value={{
        events,
        isLoading,
        isMutating,
        error,
        dialogState,
        refreshEvents,
        createEvent,
        updateEvent,
        deleteEvent,
        openCreateEvent,
        openEditEvent,
        closeEventDialog,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendarContext() {
  const ctx = useContext(CalendarContext);
  if (!ctx) {
    throw new Error('useCalendarContext must be used within CalendarProvider');
  }
  return ctx;
}
