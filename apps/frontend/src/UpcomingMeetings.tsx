import { useState } from 'react';
import { bookingsListUpcomingBookings, type Booking } from '@calendar/api-sdk';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { BookingDetails } from './BookingDetails';
import { useReadLifecycle } from './use-read-lifecycle';

type MeetingsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: Booking[] };

async function readMeetings(signal: AbortSignal): Promise<MeetingsState> {
  try {
    const result = await bookingsListUpcomingBookings({ client: api, signal });
    return result.data ? { status: 'ready', items: result.data.items } : { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}

export function UpcomingMeetings() {
  const [state, setState] = useState<MeetingsState>({ status: 'loading' });
  const refresh = useReadLifecycle(readMeetings, () => setState({ status: 'loading' }), setState);

  return (
    <section className="mt-10" aria-labelledby="upcoming-title">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="upcoming-title" className="text-xl font-semibold">
          Предстоящие встречи
        </h2>
        <Button variant="outline" onClick={refresh} disabled={state.status === 'loading'}>
          Обновить
        </Button>
      </div>
      <div className="mt-5" aria-live="polite" aria-busy={state.status === 'loading'}>
        {state.status === 'loading' && <output>Загружаем предстоящие встречи…</output>}
        {state.status === 'error' && (
          <div className="page-panel">
            <p role="alert">Не удалось загрузить предстоящие встречи.</p>
            <Button className="mt-4" onClick={refresh}>
              Повторить
            </Button>
          </div>
        )}
        {state.status === 'ready' &&
          (state.items.length === 0 ? (
            <p className="page-panel">Предстоящих встреч пока нет</p>
          ) : (
            <ul className="space-y-5">
              {state.items.map((booking) => (
                <li className="page-panel min-w-0 break-words" key={booking.id}>
                  <BookingDetails {...booking} />
                  <p className="mt-4">{booking.guestName}</p>
                  <p className="mt-1">{booking.guestEmail}</p>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </section>
  );
}
