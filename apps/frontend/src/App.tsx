import { ArrowRight, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
            <div className="flex flex-col items-start gap-1">
              <Button
                variant="ghost"
                disabled
                aria-describedby="booking-navigation-note"
                className="h-auto rounded-none p-0 text-foreground disabled:opacity-100"
              >
                Записаться
              </Button>
              <span id="booking-navigation-note" className="text-xs text-muted-foreground">
                Раздел готовится
              </span>
            </div>
            <div className="flex flex-col items-start gap-1">
              <Button
                variant="ghost"
                disabled
                aria-describedby="owner-navigation-note"
                className="h-auto rounded-none p-0 text-foreground disabled:opacity-100"
              >
                Управление встречами
              </Button>
              <span id="owner-navigation-note" className="text-xs text-muted-foreground">
                Раздел готовится
              </span>
            </div>
          </nav>
        </div>
      </header>

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
            <Button
              size="lg"
              disabled
              aria-describedby="booking-action-note"
              className="h-12 gap-3 rounded-xl px-6 text-base font-semibold disabled:opacity-100"
            >
              Записаться
              <ArrowRight aria-hidden="true" />
            </Button>
            <span id="booking-action-note" className="text-sm text-muted-foreground">
              Раздел готовится
            </span>
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
    </div>
  );
}

export default App;
