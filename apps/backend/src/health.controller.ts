import { Controller, Get } from '@nestjs/common';
import type { GetHealthResponse } from '@calendar/api-sdk';
import type { HealthControllerMethods } from '@calendar/api-sdk/nestjs';

@Controller('api')
export class HealthController implements HealthControllerMethods {
  @Get('health')
  async getHealth(): Promise<GetHealthResponse> {
    return { status: 'ok' };
  }
}
