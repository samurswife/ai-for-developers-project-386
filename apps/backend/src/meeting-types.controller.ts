import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, Post } from '@nestjs/common';
import type {
  CreateMeetingTypeRequest,
  MeetingType,
  MeetingTypesCreateMeetingTypeResponse,
  MeetingTypesListMeetingTypesResponse,
} from '@calendar/api-sdk';
import type { MeetingTypesControllerMethods } from '@calendar/api-sdk/nestjs';
import { MeetingTypeInputPipe } from './meeting-type-input.pipe.js';

@Controller('api/meeting-types')
export class MeetingTypesController implements MeetingTypesControllerMethods {
  private readonly items: MeetingType[] = [];

  @Get()
  async meetingTypesListMeetingTypes(): Promise<MeetingTypesListMeetingTypesResponse> {
    return { items: this.items };
  }

  @Post()
  async meetingTypesCreateMeetingType(
    @Body(MeetingTypeInputPipe) body: CreateMeetingTypeRequest,
  ): Promise<MeetingTypesCreateMeetingTypeResponse> {
    const item = {
      id: randomUUID(),
      name: body.name.trim(),
      description: body.description ?? '',
      durationMinutes: body.durationMinutes,
    };
    this.items.push(item);
    return item;
  }
}
