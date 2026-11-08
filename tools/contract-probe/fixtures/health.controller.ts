import { Body, Controller, Get, Post } from '@nestjs/common';
import type {
  HealthControllerMethods,
  MeetingTypesControllerMethods,
} from '@calendar/api-sdk/nestjs';
import type {
  GetHealthResponse,
  CreateMeetingTypeRequest,
  MeetingTypesCreateMeetingTypeResponse,
  MeetingTypesListMeetingTypesResponse,
} from '@calendar/api-sdk';

// Compile-only fixture: this is not the application backend.
@Controller('api')
export class HealthController implements HealthControllerMethods {
  @Get('health')
  async getHealth(): Promise<GetHealthResponse> {
    return { status: 'ok' };
  }
}

@Controller('api/meeting-types')
export class MeetingTypesController implements MeetingTypesControllerMethods {
  @Get()
  async meetingTypesListMeetingTypes(): Promise<MeetingTypesListMeetingTypesResponse> {
    return { items: [] };
  }

  @Post()
  async meetingTypesCreateMeetingType(
    @Body() body: CreateMeetingTypeRequest,
  ): Promise<MeetingTypesCreateMeetingTypeResponse> {
    return {
      id: '7d09f511-e6bb-4fda-8b7a-5602543d6790',
      name: body.name,
      description: body.description ?? '',
      durationMinutes: body.durationMinutes,
    };
  }
}
