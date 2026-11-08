import type { Availability } from '@calendar/api-sdk';
import { calendar } from './calendar.js';

export function availability(durationMinutes: number, currentTime: number): Availability {
  const firstDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(currentTime);
  const firstDay = Date.parse(`${firstDate}T00:00:00Z`);
  const days: Availability['days'] = [];
  for (let offset = 0; offset < 14; offset++) {
    const day = new Date(firstDay + offset * 86_400_000);
    const date = day.toISOString().slice(0, 10);
    const slots: Availability['days'][number]['slots'] = [];
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) {
      const opening = Date.parse(`${date}T09:00:00+03:00`);
      const closing = Date.parse(`${date}T18:00:00+03:00`);
      for (let start = opening; start + durationMinutes * 60_000 <= closing; start += 15 * 60_000) {
        if (start <= currentTime) continue;
        const end = start + durationMinutes * 60_000;
        if (
          calendar.bookings.some(
            (booking) => start < Date.parse(booking.endsAt) && Date.parse(booking.startsAt) < end,
          )
        )
          continue;
        slots.push({
          startsAt: new Date(start).toISOString(),
          endsAt: new Date(start + durationMinutes * 60_000).toISOString(),
        });
      }
    }
    days.push({ date, slots });
  }
  return {
    currentTime: new Date(currentTime).toISOString(),
    timeZone: 'Europe/Moscow',
    windowStartDate: days[0].date,
    windowEndDate: days[13].date,
    days,
  };
}
