import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { CreateBookingRequest, FieldError } from '@calendar/api-sdk';

@Injectable()
export class BookingInputPipe implements PipeTransform<unknown, CreateBookingRequest> {
  transform(value: unknown): CreateBookingRequest {
    const fieldErrors: FieldError[] = [];
    const invalid = (field: string, message: string) =>
      fieldErrors.push({ field, code: 'VALIDATION_ERROR', message });
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      invalid('body', 'Ожидается JSON-объект.');
    } else {
      const body = value as Record<string, unknown>;
      for (const key of Object.keys(body))
        if (!['meetingTypeId', 'startsAt', 'guestName', 'guestEmail'].includes(key))
          invalid(key, 'Неизвестное поле.');
      if (
        typeof body.meetingTypeId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.meetingTypeId)
      )
        invalid('meetingTypeId', 'Ожидается UUID типа встречи.');
      if (typeof body.startsAt !== 'string') invalid('startsAt', 'Ожидается строка времени.');
      if (
        typeof body.guestName !== 'string' ||
        Array.from(body.guestName.trim()).length < 1 ||
        Array.from(body.guestName.trim()).length > 100
      )
        invalid('guestName', 'Введите имя от 1 до 100 символов.');
      if (
        typeof body.guestEmail !== 'string' ||
        body.guestEmail.trim().length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.guestEmail.trim())
      )
        invalid('guestEmail', 'Введите корректную электронную почту не длиннее 254 символов.');
      if (!fieldErrors.length)
        return {
          meetingTypeId: (body.meetingTypeId as string).toLowerCase(),
          startsAt: body.startsAt as string,
          guestName: (body.guestName as string).trim(),
          guestEmail: (body.guestEmail as string).trim(),
        };
    }
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Проверьте поля запроса.',
      fieldErrors,
    });
  }
}
