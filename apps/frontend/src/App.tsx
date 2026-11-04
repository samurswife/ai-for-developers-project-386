import { useState } from 'react'
import { getHealth } from '@calendar/api-sdk'
import { CalendarDays, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ConnectionStatus = 'idle' | 'checking' | 'success' | 'error'

const messages: Record<ConnectionStatus, string> = {
  idle: 'Соединение ещё не проверено.',
  checking: 'Проверяем соединение…',
  success: 'Сервер доступен.',
  error: 'Не удалось связаться с сервером. Попробуйте ещё раз.',
}

function App() {
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const checking = status === 'checking'

  async function checkConnection() {
    setStatus('checking')
    try {
      const result = await getHealth({
        baseUrl: window.location.origin,
        throwOnError: true,
        signal: AbortSignal.timeout(5000),
      })
      setStatus(result.data?.status === 'ok' ? 'success' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <main className="min-h-svh bg-muted/30 px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-xl">
        <header>
          <div className="inline-flex rounded-xl bg-primary p-3 text-primary-foreground">
            <CalendarDays className="size-6" aria-hidden="true" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
            Календарь звонков
          </h1>
          <p className="mt-3 text-muted-foreground">
            Запись на встречи в удобное время.
          </p>
        </header>

        <section
          aria-labelledby="connection-title"
          className="mt-10 rounded-2xl border bg-card p-6 shadow-sm sm:p-8"
        >
          <h2 id="connection-title" className="text-lg font-semibold">
            Проверка соединения
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Проверьте доступность сервера.
          </p>
          <Button
            type="button"
            size="lg"
            className="mt-6 w-full sm:w-auto"
            disabled={checking}
            aria-busy={checking}
            onClick={() => void checkConnection()}
          >
            {checking && (
              <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" />
            )}
            {checking ? 'Проверяем…' : 'Проверить соединение'}
          </Button>
          <p
            role="status"
            className={`mt-4 min-h-6 text-sm ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {messages[status]}
          </p>
        </section>
      </div>
    </main>
  )
}

export default App
