import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, Post, Param, HttpException } from '@nestjs/common';
import type {
  CreateMeetingTypeRequest,
  MeetingTypesGetMeetingTypeResponse,
  MeetingTypesGetSlotsResponse,
  MeetingTypesCreateMeetingTypeResponse,
  MeetingTypesListMeetingTypesResponse,
} from '@calendar/api-sdk';
import type { MeetingTypesControllerMethods } from '@calendar/api-sdk/nestjs';
import { calendar } from './calendar.js';
import { availability } from './availability.js';
import { MeetingTypeInputPipe } from './meeting-type-input.pipe.js';

@Controller('api/meeting-types')
export class MeetingTypesController implements MeetingTypesControllerMethods {
  @Get()
  async meetingTypesListMeetingTypes(): Promise<MeetingTypesListMeetingTypesResponse> {
    return { items: calendar.meetingTypes };
  }

  @Get(':id')
  async meetingTypesGetMeetingType(
    @Param() path: { id: string },
  ): Promise<MeetingTypesGetMeetingTypeResponse> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path.id)) {
      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'Некорректный ID.',
          fieldErrors: [{ field: 'id', code: 'VALIDATION_ERROR', message: 'Ожидается UUID.' }],
        },
        400,
      );
    }
    const item = calendar.meetingTypes.find((candidate) => candidate.id === path.id.toLowerCase());
    if (!item)
      throw new HttpException(
        { code: 'MEETING_TYPE_NOT_FOUND', message: 'Тип встречи не найден.' },
        404,
      );
    return item;
  }

  @Get(':id/slots')
  async meetingTypesGetSlots(@Param() path: { id: string }): Promise<MeetingTypesGetSlotsResponse> {
    const item = await this.meetingTypesGetMeetingType(path);
    const currentTime = Date.now();
    return availability(item.durationMinutes, currentTime);
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
    calendar.meetingTypes.push(item);
    return item;
  }
}
