import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import {
  bookingsCreateBooking,
  meetingTypesGetMeetingType,
  meetingTypesGetSlots,
  type MeetingType,
  type Slot,
  type FieldError,
} from '@calendar/api-sdk';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { BookingDetails } from './BookingDetails';
import { bookingDraft, navigate, resetBookingDraft, updateBookingDraft } from './booking-scenario';

async function readSelection(id: string, start: string | null, signal: AbortSignal) {
  try {
    const [type, slots] = await Promise.all([
      meetingTypesGetMeetingType({ client: api, path: { id }, signal }),
      meetingTypesGetSlots({ client: api, path: { id }, signal }),
    ]);
    if (
      type.error?.code === 'MEETING_TYPE_NOT_FOUND' ||
      slots.error?.code === 'MEETING_TYPE_NOT_FOUND'
    )
      return { status: 'not-found' as const };
    if (!type.data || !slots.data) return { status: 'error' as const };
    const slot = slots.data.days
      .flatMap((day) => day.slots)
      .find((candidate) => candidate.startsAt === start);
    if (!slot) {
      if (!signal.aborted) {
        updateBookingDraft({ message: 'Выбранное время больше недоступно. Выберите другой слот.' });
        navigate(`/meeting-types/${id}`);
      }
      return { status: 'error' as const };
    }
    return { status: 'ready' as const, meetingType: type.data, slot };
  } catch {
    return { status: 'error' as const };
  }
}

export function BookingPage({ id }: { id: string }) {
  const start = new URLSearchParams(location.search).get('start');
  const [selection, setSelection] = useState<{ meetingType: MeetingType; slot: Slot }>();
  const [readState, setReadState] = useState<'loading' | 'ready' | 'error' | 'not-found'>(
    'loading',
  );
  const currentRead = useRef<AbortController | null>(null);
  const [guestName, setGuestName] = useState(bookingDraft.guestName);
  const [guestEmail, setGuestEmail] = useState(bookingDraft.guestEmail);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [sending, setSending] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const inFlight = useRef(false);
  const fieldError = (field: string) => errors.find((error) => error.field === field)?.message;
  useEffect(() => {
    const controller = new AbortController();
    currentRead.current = controller;
    void readSelection(id, start, controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        if (result.status === 'ready') setSelection(result);
        setReadState(result.status);
      }
      return undefined;
    });
    return () => currentRead.current?.abort();
  }, [id, start]);
  function retry() {
    currentRead.current?.abort();
    const controller = new AbortController();
    currentRead.current = controller;
    setReadState('loading');
    void readSelection(id, start, controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        if (result.status === 'ready') setSelection(result);
        setReadState(result.status);
      }
      return undefined;
    });
  }
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection || inFlight.current || unknown) return;
    inFlight.current = true;
    setSending(true);
    setErrors([]);
    try {
      const result = await bookingsCreateBooking({
        client: api,
        body: { meetingTypeId: id, startsAt: selection.slot.startsAt, guestName, guestEmail },
      });
      if (result.response?.status === 201 && result.data) {
        sessionStorage.setItem(`booking:${result.data.id}`, JSON.stringify(result.data));
        resetBookingDraft();
        navigate(`/bookings/${result.data.id}/confirmation`);
      } else if (result.error?.code === 'VALIDATION_ERROR')
        setErrors(result.error.fieldErrors ?? []);
      else if (result.error?.code === 'MEETING_TYPE_NOT_FOUND') setReadState('not-found');
      else if (result.error?.code === 'SLOT_CONFLICT' || result.error?.code === 'INVALID_TIME') {
        updateBookingDraft({
          message:
            result.error.code === 'SLOT_CONFLICT'
              ? 'Это время уже занято. Выберите другой слот'
              : 'Выбранное время больше недоступно: старт наступил или дата вышла из окна записи. Выберите другой слот.',
        });
        navigate(`/meeting-types/${id}`);
      } else reportUnknown();
    } catch {
      reportUnknown();
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }
  function reportUnknown() {
    updateBookingDraft({
      message:
        'Результат записи неизвестен. Запись могла сохраниться. Перед новой попыткой учтите возможную предыдущую запись. Занятость времени не подтверждает, что запись принадлежит вам.',
    });
    setUnknown(true);
  }
  return (
    <section className="max-w-2xl">
      <h1 className="text-3xl font-semibold">
        {readState === 'not-found' ? 'Тип встречи не найден' : 'Подтвердите запись'}
      </h1>
      {readState === 'loading' && (
        <output className="mt-6 block">Проверяем выбранное время…</output>
      )}
      {readState === 'error' && (
        <div className="page-panel mt-6">
          <p role="alert">Не удалось проверить выбранное время.</p>
          <Button className="mt-4" onClick={retry}>
            Повторить
          </Button>
        </div>
      )}
      {readState === 'not-found' && (
        <p className="mt-6">
          Этот тип встречи недоступен.{' '}
          <a href="/meeting-types" className="navigation-link text-primary underline">
            В каталог
          </a>
        </p>
      )}
      {readState === 'ready' && selection && (
        <div className="page-panel mt-6">
          <BookingDetails meetingType={selection.meetingType} {...selection.slot} />
          <form className="mt-6 space-y-5" onSubmit={submit} noValidate aria-busy={sending}>
            <div>
              <label htmlFor="guest-name">Имя</label>
              <input
                id="guest-name"
                value={guestName}
                onChange={(event) => {
                  setGuestName(event.target.value);
                  updateBookingDraft({ guestName: event.target.value });
                }}
                aria-invalid={!!fieldError('guestName')}
                aria-describedby={fieldError('guestName') ? 'guest-name-error' : undefined}
                required
              />
              <p id="guest-name-error" className="field-error">
                {fieldError('guestName')}
              </p>
            </div>
            <div>
              <label htmlFor="guest-email">Электронная почта</label>
              <input
                id="guest-email"
                type="email"
                value={guestEmail}
                onChange={(event) => {
                  setGuestEmail(event.target.value);
                  updateBookingDraft({ guestEmail: event.target.value });
                }}
                aria-invalid={!!fieldError('guestEmail')}
                aria-describedby={fieldError('guestEmail') ? 'guest-email-error' : undefined}
                required
              />
              <p id="guest-email-error" className="field-error">
                {fieldError('guestEmail')}
              </p>
            </div>
            <Button type="submit" disabled={sending || unknown}>
              {sending ? 'Отправляем…' : 'Подтвердить запись'}
            </Button>
          </form>
          {unknown && (
            <p role="alert" className="mt-5">
              {bookingDraft.message} Вернитесь к выбору времени.
            </p>
          )}
          <a
            href={`/meeting-types/${id}`}
            className="navigation-link mt-5 inline-block text-primary underline"
          >
            Изменить время
          </a>
        </div>
      )}
    </section>
  );
}
