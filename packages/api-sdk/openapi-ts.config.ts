import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../../specs/generated/openapi.json',
  output: './src/generated',
  plugins: [
    '@hey-api/typescript',
    '@hey-api/client-fetch',
    '@hey-api/sdk',
    'nestjs',
  ],
});
