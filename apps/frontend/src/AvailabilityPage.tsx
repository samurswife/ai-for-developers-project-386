import { useCallback, useState } from 'react';
import {
  meetingTypesGetMeetingType,
  meetingTypesGetSlots,
  type Availability,
  type MeetingType,
} from '@calendar/api-sdk';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { bookingDraft, navigate } from './booking-scenario';
import { useReadLifecycle } from './use-read-lifecycle';

type CalendarState =
  | { status: 'loading' | 'error' | 'not-found' }
  | {
      status: 'ready';
      item: MeetingType;
      availability: Availability;
      date: string;
      start: string | null;
    };

const dateLabel = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  dateStyle: 'long',
});
const shortDateLabel = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const timeLabel = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const intervalLabel = (slot: { startsAt: string; endsAt: string }) =>
  `${timeLabel.format(new Date(slot.startsAt))} – ${timeLabel.format(new Date(slot.endsAt))}`;

async function readCalendar(id: string, signal: AbortSignal): Promise<CalendarState> {
  try {
    const [type, slots] = await Promise.all([
      meetingTypesGetMeetingType({ client: api, path: { id }, signal }),
      meetingTypesGetSlots({ client: api, path: { id }, signal }),
    ]);
    if (
      type.error?.code === 'MEETING_TYPE_NOT_FOUND' ||
      slots.error?.code === 'MEETING_TYPE_NOT_FOUND'
    )
      return { status: 'not-found' };
    if (!type.data || !slots.data) return { status: 'error' };
    return {
      status: 'ready',
      item: type.data,
      availability: slots.data,
      date: (slots.data.days.find((day) => day.slots.length) ?? slots.data.days[0]).date,
      start: null,
    };
  } catch {
    return { status: 'error' };
  }
}

export function AvailabilityPage({ id }: { id: string }) {
  const [state, setState] = useState<CalendarState>({ status: 'loading' });
  const retry = useReadLifecycle(
    useCallback((signal: AbortSignal) => readCalendar(id, signal), [id]),
    () => setState({ status: 'loading' }),
    setState,
  );

  const selectedDay =
    state.status === 'ready'
      ? state.availability.days.find((day) => day.date === state.date)
      : undefined;
  const selectedSlot = selectedDay?.slots.find(
    (slot) => state.status === 'ready' && slot.startsAt === state.start,
  );
  return (
    <section aria-labelledby="calendar-title">
      <a href="/meeting-types" className="navigation-link text-primary underline">
        В каталог
      </a>
      <h1 id="calendar-title" className="mt-5 text-3xl font-semibold break-words sm:text-4xl">
        {state.status === 'ready'
          ? state.item.name
          : state.status === 'not-found'
            ? 'Тип встречи не найден'
            : 'Выберите время'}
      </h1>
      <div className="mt-6" aria-live="polite">
        {bookingDraft.message && (
          <p role="alert" className="mb-5">
            {bookingDraft.message}
          </p>
        )}
        {state.status === 'loading' && <output>Загружаем доступное время…</output>}
        {state.status === 'error' && (
          <div className="page-panel">
            <p role="alert">Не удалось загрузить доступное время.</p>
            <Button className="mt-4" onClick={retry}>
              Повторить
            </Button>
          </div>
        )}
        {state.status === 'not-found' && (
          <p>Этот тип встречи недоступен. Выберите другой в каталоге.</p>
        )}
        {state.status === 'ready' && selectedDay && (
          <>
            {state.item.description && (
              <p className="break-words whitespace-pre-wrap text-muted-foreground">
                {state.item.description}
              </p>
            )}
            <p className="mt-3">{state.item.durationMinutes} мин</p>
            <p className="mt-2 font-medium">Московское время (UTC+3)</p>
            <h2 className="mt-8 text-xl font-semibold">Выберите дату</h2>
            <fieldset
              aria-label="Даты записи"
              className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7"
            >
              {state.availability.days.map((day) => {
                const date = new Date(`${day.date}T12:00:00+03:00`);
                const selected = state.date === day.date;
                return (
                  <Button
                    key={day.date}
                    variant={selected ? 'default' : 'outline'}
                    aria-label={dateLabel.format(date)}
                    aria-pressed={selected}
                    onClick={() => setState({ ...state, date: day.date, start: null })}
                  >
                    {selected && <span aria-hidden="true">✓</span>}
                    {shortDateLabel.format(date)}
                  </Button>
                );
              })}
            </fieldset>
            {!state.availability.days.some((day) => day.slots.length) && (
              <p className="mt-6">В ближайшие 14 дней свободного времени нет</p>
            )}
            <h2 className="mt-8 text-xl font-semibold">
              {dateLabel.format(new Date(`${selectedDay.date}T12:00:00+03:00`))}
            </h2>
            {selectedDay.slots.length === 0 ? (
              <p className="mt-4">На эту дату свободного времени нет</p>
            ) : (
              <fieldset
                aria-label="Свободное время"
                className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4"
              >
                {selectedDay.slots.map((slot) => (
                  <Button
                    key={slot.startsAt}
                    variant={state.start === slot.startsAt ? 'default' : 'outline'}
                    aria-label={intervalLabel(slot)}
                    aria-pressed={state.start === slot.startsAt}
                    onClick={() => setState({ ...state, start: slot.startsAt })}
                  >
                    {state.start === slot.startsAt && <span aria-hidden="true">✓</span>}
                    {intervalLabel(slot)}
                  </Button>
                ))}
              </fieldset>
            )}
            <div className="page-panel mt-8">
              {selectedSlot && (
                <p className="mb-3 font-semibold">Выбрано: {intervalLabel(selectedSlot)}</p>
              )}
              <p className="text-muted-foreground">Выбор слота не удерживает время.</p>
              <Button
                className="mt-4"
                disabled={!selectedSlot}
                onClick={() => {
                  if (selectedSlot)
                    navigate(
                      `/meeting-types/${id}/book?start=${encodeURIComponent(selectedSlot.startsAt)}`,
                    );
                }}
              >
                Продолжить
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
