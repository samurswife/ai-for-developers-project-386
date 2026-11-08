import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { CreateMeetingTypeRequest, FieldError } from '@calendar/api-sdk';

@Injectable()
export class MeetingTypeInputPipe implements PipeTransform<unknown, CreateMeetingTypeRequest> {
  transform(value: unknown): CreateMeetingTypeRequest {
    const fieldErrors: FieldError[] = [];
    const invalid = (field: string, message: string) =>
      fieldErrors.push({ field, code: 'VALIDATION_ERROR', message });
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      invalid('body', 'Ожидается JSON-объект.');
    } else {
      const body: Record<string, unknown> = value as Record<string, unknown>;
      for (const field of Object.keys(body)) {
        if (!['name', 'description', 'durationMinutes'].includes(field))
          invalid(field, 'Неизвестное поле.');
      }
      if (
        typeof body.name !== 'string' ||
        Array.from(body.name.trim()).length < 1 ||
        Array.from(body.name.trim()).length > 100
      )
        invalid('name', 'Введите название от 1 до 100 символов.');
      if (
        'description' in body &&
        (typeof body.description !== 'string' || Array.from(body.description).length > 2000)
      )
        invalid('description', 'Описание должно быть строкой не длиннее 2000 символов.');
      if (
        typeof body.durationMinutes !== 'number' ||
        !Number.isInteger(body.durationMinutes) ||
        body.durationMinutes < 1 ||
        body.durationMinutes > 540
      )
        invalid('durationMinutes', 'Введите целое число от 1 до 540.');
      if (!fieldErrors.length)
        return {
          name: (body.name as string).trim(),
          description: (body.description as string | undefined) ?? '',
          durationMinutes: body.durationMinutes as number,
        };
    }
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Проверьте поля запроса.',
      fieldErrors,
    });
  }
}
