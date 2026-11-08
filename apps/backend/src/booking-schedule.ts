/** The current Moscow booking window, including dates without eligible starts. */
export function scheduledDays(durationMinutes: number, currentTime: number) {
  const firstDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(currentTime);
  const firstDay = Date.parse(`${firstDate}T00:00:00Z`);
  return Array.from({ length: 14 }, (_, offset) => {
    const day = new Date(firstDay + offset * 86_400_000);
    const date = day.toISOString().slice(0, 10);
    const starts: number[] = [];
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) {
      const opening = Date.parse(`${date}T09:00:00+03:00`);
      const closing = Date.parse(`${date}T18:00:00+03:00`);
      for (let start = opening; start + durationMinutes * 60_000 <= closing; start += 15 * 60_000)
        if (start > currentTime) starts.push(start);
    }
    return { date, starts };
  });
}

export function isOccupied(
  start: number,
  end: number,
  bookings: readonly { startsAt: string; endsAt: string }[],
) {
  return bookings.some(
    (booking) => start < Date.parse(booking.endsAt) && Date.parse(booking.startsAt) < end,
  );
}
