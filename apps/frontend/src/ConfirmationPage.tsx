import type { Booking } from '@calendar/api-sdk';
import { BookingDetails } from './BookingDetails';
import { resetBookingDraft } from './booking-scenario';

export function ConfirmationPage({ id }: { id: string }) {
  let booking: Booking | undefined;
  try {
    const saved = JSON.parse(sessionStorage.getItem(`booking:${id}`) ?? 'null');
    if (saved?.id === id) booking = saved;
  } catch {
    /* Missing or unreadable tab data does not cancel a booking. */
  }
  if (!booking)
    return (
      <section className="page-panel">
        <h1 className="text-3xl font-semibold">Данные подтверждения недоступны</h1>
        <p className="mt-4">
          В этой вкладке нет сведений о записи. Это не означает отмену встречи.
        </p>
        <a
          href="/meeting-types"
          className="navigation-link mt-4 inline-block text-primary underline"
        >
          В каталог
        </a>
      </section>
    );
  return (
    <section className="max-w-2xl">
      <h1 className="text-3xl font-semibold">Вы записаны</h1>
      <div className="page-panel mt-6 space-y-5">
        <BookingDetails {...booking} />
        <p className="break-words">{booking.guestName}</p>
        <p className="break-all">{booking.guestEmail}</p>
        <a
          href="/meeting-types"
          onClick={resetBookingDraft}
          className="navigation-link inline-block text-primary underline"
        >
          Записаться снова
        </a>
      </div>
    </section>
  );
}
