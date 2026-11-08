import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const response = host
      .switchToHttp()
      .getResponse<{ status: (status: number) => { json: (body: unknown) => void } }>();
    let body: unknown = exception instanceof HttpException ? exception.getResponse() : undefined;
    if (status >= 500) {
      Logger.error(exception, undefined, 'API');
      body = { code: 'INTERNAL_ERROR', message: 'Не удалось выполнить запрос.' };
    } else if (status === 400 && !(body && typeof body === 'object' && 'code' in body)) {
      body = {
        code: 'VALIDATION_ERROR',
        message: 'Проверьте поля запроса.',
        fieldErrors: [
          { field: 'body', code: 'VALIDATION_ERROR', message: 'Ожидается корректный JSON-объект.' },
        ],
      };
    }
    response.status(status).json(body);
  }
}
