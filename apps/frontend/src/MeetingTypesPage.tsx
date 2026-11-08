import { useState } from 'react';
import { meetingTypesListMeetingTypes, type MeetingType } from '@calendar/api-sdk';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useReadLifecycle } from './use-read-lifecycle';

type CatalogState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: MeetingType[] };

async function readCatalog(signal: AbortSignal): Promise<CatalogState> {
  try {
    const result = await meetingTypesListMeetingTypes({ client: api, signal });
    return result.data ? { status: 'ready', items: result.data.items } : { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}

export function MeetingTypesPage() {
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  const retry = useReadLifecycle(readCatalog, () => setState({ status: 'loading' }), setState);

  return (
    <section aria-labelledby="catalog-title">
      <h1 id="catalog-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Типы встреч
      </h1>
      <p className="mt-3 text-muted-foreground">Выберите подходящий формат звонка.</p>
      <div className="mt-8" aria-live="polite">
        {state.status === 'loading' && <output>Загружаем типы встреч…</output>}
        {state.status === 'error' && (
          <div className="page-panel">
            <p role="alert">Не удалось загрузить типы встреч.</p>
            <Button className="mt-4" onClick={retry}>
              Повторить
            </Button>
          </div>
        )}
        {state.status === 'ready' &&
          (state.items.length === 0 ? (
            <p className="page-panel">Типов встреч пока нет</p>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {state.items.map((item) => (
                <li className="page-panel flex min-w-0 flex-col items-start" key={item.id}>
                  <h2 className="w-full text-xl font-semibold break-words">{item.name}</h2>
                  {item.description && (
                    <p className="mt-3 w-full break-words whitespace-pre-wrap text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  <p className="mt-4">{item.durationMinutes} мин</p>
                  <div className="mt-auto pt-6">
                    <a
                      className="navigation-link inline-flex min-h-10 items-center rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground"
                      href={`/meeting-types/${item.id}`}
                    >
                      Выбрать время
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </section>
  );
}
