import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { fileURLToPath } from 'node:url';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './api-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  if (process.env.NODE_ENV === 'production') {
    app.useStaticAssets(fileURLToPath(new URL('../../frontend/dist/', import.meta.url)), {
      index: false,
      redirect: false,
    });
  }
  await app.listen(Number(process.env.PORT ?? 3000), process.env.HOST ?? '127.0.0.1');
  Logger.log(`Backend listening at ${await app.getUrl()}`, 'Bootstrap');
}
await bootstrap();
