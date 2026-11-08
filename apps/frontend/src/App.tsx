import { ArrowRight, CalendarClock } from 'lucide-react';
import { OwnerPage } from './OwnerPage';
import { MeetingTypesPage } from './MeetingTypesPage';

function App() {
  return (
    <div className="home-surface min-h-svh">
      <header className="border-b border-border/70 bg-background/90">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-10 gap-y-5 px-6 py-5 sm:px-8">
          <a
            href="/"
            className="inline-flex items-center gap-3 rounded-lg text-base font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:text-lg"
          >
            <CalendarClock className="size-6 shrink-0 text-primary" aria-hidden="true" />
            Запись на звонок
          </a>
          <nav aria-label="Основная навигация" className="flex flex-wrap gap-x-7 gap-y-4">
            <a
              className="navigation-link"
              href="/meeting-types"
              aria-current={location.pathname === '/meeting-types' ? 'page' : undefined}
            >
              Записаться
            </a>
            <a
              className="navigation-link"
              href="/owner"
              aria-current={location.pathname === '/owner' ? 'page' : undefined}
            >
              Управление встречами
            </a>
          </nav>
        </div>
      </header>

      {location.pathname === '/' ? (
        <main className="mx-auto grid max-w-[1200px] items-start gap-10 px-6 py-12 sm:px-8 sm:py-16 lg:grid-cols-2 lg:gap-16">
          <section aria-labelledby="home-title">
            <h1
              id="home-title"
              className="max-w-[12ch] text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl lg:text-6xl"
            >
              Запись на звонок
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Выберите тип встречи и удобное время. Запишитесь на звонок без регистрации.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3">
              <a
                href="/meeting-types"
                className="navigation-link inline-flex h-12 items-center gap-3 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground"
              >
                Записаться
                <ArrowRight aria-hidden="true" />
              </a>
            </div>
          </section>

          <section
            aria-labelledby="features-title"
            className="rounded-2xl border border-border bg-card/90 p-6 shadow-sm sm:p-8"
          >
            <h2 id="features-title" className="text-xl font-semibold tracking-tight">
              Возможности
            </h2>
            <ul className="mt-5 list-disc space-y-4 pl-5 text-base leading-relaxed text-muted-foreground marker:text-primary">
              <li>Выбор типа встречи и свободного времени.</li>
              <li>Запись на звонок без регистрации.</li>
              <li>Управление типами встреч и просмотр предстоящих встреч.</li>
            </ul>
          </section>
        </main>
      ) : (
        <main className="mx-auto max-w-[1200px] px-6 py-12 sm:px-8 sm:py-16">
          {location.pathname === '/owner' ? (
            <OwnerPage />
          ) : location.pathname === '/meeting-types' ? (
            <MeetingTypesPage />
          ) : (
            <section className="page-panel">
              <h1 className="text-3xl font-semibold">Страница не найдена</h1>
              <p className="mt-4">Такого адреса нет. Вернитесь на главную, чтобы продолжить.</p>
              <a className="navigation-link mt-6 inline-block text-primary underline" href="/">
                На главную
              </a>
            </section>
          )}
        </main>
      )}
    </div>
  );
}

export default App;
