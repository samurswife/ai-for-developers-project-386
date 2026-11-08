import { Body, Controller, Get, Post, Param } from '@nestjs/common';
import type {
  HealthControllerMethods,
  MeetingTypesControllerMethods,
  BookingsControllerMethods,
} from '@calendar/api-sdk/nestjs';
import type {
  GetHealthResponse,
  MeetingTypesGetMeetingTypeResponse,
  MeetingTypesGetSlotsResponse,
  CreateMeetingTypeRequest,
  MeetingTypesCreateMeetingTypeResponse,
  MeetingTypesListMeetingTypesResponse,
  CreateBookingRequest,
  BookingsCreateBookingResponse,
} from '@calendar/api-sdk';

@Controller('api/bookings')
export class BookingsController implements BookingsControllerMethods {
  @Post()
  async bookingsCreateBooking(
    @Body() _body: CreateBookingRequest,
  ): Promise<BookingsCreateBookingResponse> {
    throw new Error('Compile-only fixture');
  }
}

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

  @Get(':id')
  async meetingTypesGetMeetingType(
    @Param() _path: { id: string },
  ): Promise<MeetingTypesGetMeetingTypeResponse> {
    throw new Error('Compile-only fixture');
  }

  @Get(':id/slots')
  async meetingTypesGetSlots(
    @Param() _path: { id: string },
  ): Promise<MeetingTypesGetSlotsResponse> {
    throw new Error('Compile-only fixture');
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
