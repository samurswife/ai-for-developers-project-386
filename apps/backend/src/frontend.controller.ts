import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { Controller, Get, Header, NotFoundException, Req } from '@nestjs/common';
import type { Request } from 'express';

@Controller()
export class FrontendController {
  private readonly html = readFileSync(
    new URL('../../frontend/dist/index.html', import.meta.url),
    'utf8',
  );

  @Get('{*path}')
  @Header('Cache-Control', 'no-cache')
  getPage(@Req() request: Request): string {
    if (
      request.path === '/api' ||
      request.path.startsWith('/api/') ||
      request.path.startsWith('/assets/') ||
      extname(request.path)
    ) {
      throw new NotFoundException();
    }
    return this.html;
  }
}
