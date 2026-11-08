import type { Availability } from '@calendar/api-sdk';
import { calendar } from './calendar.js';
import { isOccupied, scheduledDays } from './booking-schedule.js';

export function availability(durationMinutes: number, currentTime: number): Availability {
  const days = scheduledDays(durationMinutes, currentTime).map(({ date, starts }) => ({
    date,
    slots: starts
      .filter((start) => !isOccupied(start, start + durationMinutes * 60_000, calendar.bookings))
      .map((start) => ({
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(start + durationMinutes * 60_000).toISOString(),
      })),
  }));
  return {
    currentTime: new Date(currentTime).toISOString(),
    timeZone: 'Europe/Moscow',
    windowStartDate: days[0].date,
    windowEndDate: days[13].date,
    days,
  };
}
