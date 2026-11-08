import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, Post, HttpException } from '@nestjs/common';
import type {
  BookingsCreateBookingResponse,
  BookingsListUpcomingBookingsResponse,
  CreateBookingRequest,
} from '@calendar/api-sdk';
import type { BookingsControllerMethods } from '@calendar/api-sdk/nestjs';
import { calendar } from './calendar.js';
import { BookingInputPipe } from './booking-input.pipe.js';

@Controller('api/bookings')
export class BookingsController implements BookingsControllerMethods {
  @Get('upcoming')
  async bookingsListUpcomingBookings(): Promise<BookingsListUpcomingBookingsResponse> {
    const currentTime = Date.now();
    return {
      items: calendar.bookings
        .filter((booking) => Date.parse(booking.startsAt) > currentTime)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
        .map(({ meetingTypeId, ...booking }) => ({
          ...booking,
          meetingType: calendar.meetingTypes.find((item) => item.id === meetingTypeId)!,
        })),
    };
  }

  @Post()
  async bookingsCreateBooking(
    @Body(BookingInputPipe) body: CreateBookingRequest,
  ): Promise<BookingsCreateBookingResponse> {
    // No await or I/O between rechecking the type/time and inserting into the shared store.
    const currentTime = Date.now();
    const meetingType = calendar.meetingTypes.find((item) => item.id === body.meetingTypeId);
    if (!meetingType)
      throw new HttpException(
        { code: 'MEETING_TYPE_NOT_FOUND', message: 'Тип встречи не найден.' },
        404,
      );
    const parsed =
      /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::00(?:\.0+)?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(
        body.startsAt,
      );
    const start = Date.parse(body.startsAt);
    const end = start + meetingType.durationMinutes * 60_000;
    const moscow = new Date(start + 3 * 60 * 60_000);
    const firstDate = new Date(currentTime + 3 * 60 * 60_000).toISOString().slice(0, 10);
    const firstDay = Date.parse(`${firstDate}T00:00:00Z`);
    const date = Number.isFinite(start) ? moscow.toISOString().slice(0, 10) : '';
    if (
      !parsed ||
      !Number.isFinite(start) ||
      new Date(`${parsed[1]}T00:00:00Z`).toISOString().slice(0, 10) !== parsed[1] ||
      start <= currentTime ||
      Date.parse(`${date}T00:00:00Z`) < firstDay ||
      Date.parse(`${date}T00:00:00Z`) >= firstDay + 14 * 86_400_000 ||
      [0, 6].includes(moscow.getUTCDay()) ||
      moscow.getUTCMinutes() % 15 !== 0 ||
      moscow.getUTCHours() < 9 ||
      end > Date.parse(`${date}T18:00:00+03:00`)
    ) {
      throw new HttpException(
        {
          code: 'INVALID_TIME',
          message:
            'Выбранное время недопустимо: старт должен быть в будущем, в текущем окне записи и по рабочему расписанию.',
        },
        400,
      );
    }
    if (
      calendar.bookings.some(
        (booking) => start < Date.parse(booking.endsAt) && Date.parse(booking.startsAt) < end,
      )
    ) {
      throw new HttpException(
        { code: 'SLOT_CONFLICT', message: 'Это время уже занято. Выберите другой слот' },
        409,
      );
    }
    const booking = {
      id: randomUUID(),
      meetingTypeId: meetingType.id,
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
      guestName: body.guestName,
      guestEmail: body.guestEmail,
    };
    calendar.bookings.push(booking);
    const { meetingTypeId: _, ...fields } = booking;
    return { ...fields, meetingType };
  }
}
