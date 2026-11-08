import { useRef, useState, type SubmitEvent } from 'react';
import {
  meetingTypesCreateMeetingType,
  type FieldError,
  type MeetingType,
} from '@calendar/api-sdk';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { UpcomingMeetings } from './UpcomingMeetings';

export function OwnerPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'unknown'>('idle');
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [message, setMessage] = useState('');
  const [created, setCreated] = useState<MeetingType>();
  const sending = useRef(false);
  const fieldError = (field: string) => errors.find((error) => error.field === field)?.message;

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || state === 'unknown') return;
    sending.current = true;
    setState('sending');
    setErrors([]);
    setMessage('');
    setCreated(undefined);
    try {
      const result = await meetingTypesCreateMeetingType({
        client: api,
        body: { name, description, durationMinutes: Number(duration) },
      });
      if (result.data) {
        setCreated(result.data);
        setName('');
        setDescription('');
        setDuration('');
        setState('idle');
      } else if (result.error?.code === 'VALIDATION_ERROR') {
        setErrors(result.error.fieldErrors ?? []);
        setMessage(result.error.message);
        setState('idle');
      } else {
        setState('unknown');
      }
    } catch {
      setState('unknown');
    } finally {
      sending.current = false;
    }
  }

  return (
    <section className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Управление встречами</h1>
      <div className="page-panel mt-8">
        <h2 className="text-xl font-semibold">Создать тип встречи</h2>
        <p className="mt-2 text-muted-foreground">
          Укажите, какой звонок гости смогут выбрать в каталоге.
        </p>
        <form
          className="mt-6 space-y-5"
          noValidate
          onSubmit={submit}
          aria-busy={state === 'sending'}
        >
          <div>
            <label htmlFor="name">Название</label>
            <input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={!!fieldError('name')}
              aria-describedby={fieldError('name') ? 'name-error' : undefined}
              required
            />
            <p id="name-error" className="field-error">
              {fieldError('name')}
            </p>
          </div>
          <div>
            <label htmlFor="description">Описание (необязательно)</label>
            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              aria-invalid={!!fieldError('description')}
              aria-describedby={fieldError('description') ? 'description-error' : undefined}
            />
            <p id="description-error" className="field-error">
              {fieldError('description')}
            </p>
          </div>
          <div>
            <label htmlFor="duration">Длительность в минутах</label>
            <input
              id="duration"
              type="number"
              min="1"
              max="540"
              step="1"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              aria-invalid={!!fieldError('durationMinutes')}
              aria-describedby="duration-help duration-error"
              required
            />
            <p id="duration-help" className="mt-2 text-sm text-muted-foreground">
              Целое число от 1 до 540.
            </p>
            <p id="duration-error" className="field-error">
              {fieldError('durationMinutes')}
            </p>
          </div>
          {message && <p role="alert">{message}</p>}
          <Button type="submit" size="lg" disabled={state !== 'idle'}>
            {state === 'sending' ? 'Создаём…' : 'Создать тип встречи'}
          </Button>
        </form>
        {state === 'unknown' && (
          <div role="alert" className="mt-6 space-y-3 rounded-xl border border-border p-4">
            <p>
              Результат создания неизвестен. Тип встречи мог сохраниться. Проверьте каталог перед
              новым созданием.
            </p>
            <a
              className="navigation-link inline-block text-primary underline"
              href="/meeting-types"
            >
              Посмотреть в каталоге
            </a>
            <div>
              <Button variant="outline" onClick={() => setState('idle')}>
                Начать новое создание
              </Button>
            </div>
          </div>
        )}
        {created && (
          <div className="mt-6 space-y-3 rounded-xl border border-border p-4">
            <output className="block font-semibold">Тип встречи создан</output>
            <p className="break-words">
              {created.name} · {created.durationMinutes} мин
            </p>
            {created.description && (
              <p className="break-words whitespace-pre-wrap">{created.description}</p>
            )}
            <a
              className="navigation-link inline-block text-primary underline"
              href="/meeting-types"
            >
              Посмотреть в каталоге
            </a>
          </div>
        )}
      </div>
      <UpcomingMeetings />
    </section>
  );
}
