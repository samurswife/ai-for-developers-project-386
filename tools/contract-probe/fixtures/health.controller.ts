import { Controller, Get } from '@nestjs/common';
import type { HealthControllerMethods } from '@calendar/api-sdk/nestjs';
import type { GetHealthResponse } from '@calendar/api-sdk';

// Compile-only fixture: this is not the application backend.
@Controller('api')
export class HealthController implements HealthControllerMethods {
  @Get('health')
  async getHealth(): Promise<GetHealthResponse> {
    return { status: 'ok' };
  }
}
