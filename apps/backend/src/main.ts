import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './api-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000), '127.0.0.1');
  Logger.log(`Backend listening at ${await app.getUrl()}`, 'Bootstrap');
}
await bootstrap();
