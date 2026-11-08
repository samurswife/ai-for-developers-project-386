import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';

const root = fileURLToPath(new URL('../../', import.meta.url));

/** Each scenario owns a fresh genuine application and an OS-assigned port. */
export async function startBackend(nodeArguments: string[] = []) {
  const child = spawn(
    process.execPath,
    [...nodeArguments, join(root, 'apps/backend/dist/main.js')],
    {
      cwd: root,
      env: { ...process.env, PORT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
  let output = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function close() {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    const shutdownTimer = setTimeout(() => child.kill('SIGKILL'), 3000);
    try {
      await closed;
    } finally {
      clearTimeout(shutdownTimer);
    }
  }
  try {
    const url = await new Promise<string>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`Backend startup timeout:\n${output}`)), 10_000);
      const collect = (chunk: Buffer) => {
        output += chunk.toString();
        const address = output.match(/Backend listening at (http:\/\/127\.0\.0\.1:\d+)/);
        if (address) resolve(address[1]);
      };
      child.stdout.on('data', collect);
      child.stderr.on('data', collect);
      child.once('error', reject);
      child.once('exit', (code) => reject(new Error(`Backend exited (${code}):\n${output}`)));
    });
    return { url, close };
  } catch (error) {
    await close();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function startFrontend(backendUrl: string) {
  const frontend = await preview({
    root: join(root, 'apps/frontend'),
    preview: {
      host: '127.0.0.1',
      port: 0,
      proxy: { '/api': { target: backendUrl, changeOrigin: true } },
    },
  });
  const address = frontend.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Frontend did not open a TCP port');
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        frontend.httpServer.close((error) => (error ? reject(error) : resolve()));
        if ('closeAllConnections' in frontend.httpServer) frontend.httpServer.closeAllConnections();
      }),
  };
}
