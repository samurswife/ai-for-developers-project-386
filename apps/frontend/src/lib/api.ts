import { createClient, createConfig } from '@calendar/api-sdk';

// Use the application's same-origin API proxy in development and preview.
export const api = createClient(createConfig({ baseUrl: window.location.origin }));
