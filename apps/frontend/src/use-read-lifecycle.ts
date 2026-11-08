import { useCallback, useEffect, useRef } from 'react';

/** Initial and manual reads cancel their predecessor and cannot update an unmounted page. */
export function useReadLifecycle<T>(
  read: (signal: AbortSignal) => Promise<T>,
  loading: () => void,
  receive: (result: T) => void,
) {
  const currentRead = useRef<AbortController | null>(null);
  const callbacks = useRef({ loading, receive });
  useEffect(() => {
    callbacks.current = { loading, receive };
  }, [loading, receive]);
  const load = useCallback(() => {
    currentRead.current?.abort();
    const controller = new AbortController();
    currentRead.current = controller;
    callbacks.current.loading();
    void read(controller.signal).then((result) => {
      if (!controller.signal.aborted) callbacks.current.receive(result);
      return undefined;
    });
  }, [read]);
  useEffect(() => {
    load();
    return () => currentRead.current?.abort();
  }, [load]);

  return load;
}
