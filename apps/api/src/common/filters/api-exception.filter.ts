import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { ApiError, ErrorCode } from '@futzone/contracts';
import type { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { AppException } from '../errors/app.exception';
import { zodErrorDetails } from '../validation/zod-validation.pipe';

type ErrorMapping = { code: ErrorCode; status: number; message: string; details?: unknown };

export function mapException(exception: unknown): ErrorMapping {
  if (exception instanceof AppException) {
    return { code: exception.code, status: exception.status, message: exception.message, details: exception.details };
  }
  if (exception instanceof ZodError) {
    return { code: 'VALIDATION_ERROR', status: 400, message: 'Request validation failed', details: zodErrorDetails(exception) };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code: ErrorCode = status === HttpStatus.UNAUTHORIZED ? 'UNAUTHORIZED'
      : status === HttpStatus.FORBIDDEN ? 'FORBIDDEN'
      : status === HttpStatus.NOT_FOUND ? 'NOT_FOUND'
      : status === HttpStatus.BAD_REQUEST ? 'VALIDATION_ERROR'
      : 'INTERNAL_ERROR';
    const response = exception.getResponse();
    return { code, status, message: exception.message, details: typeof response === 'string' ? undefined : response };
  }
  return { code: 'INTERNAL_ERROR', status: 500, message: 'An unexpected error occurred' };
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  public constructor(private readonly logger: Logger) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request & { id?: string }>();
    const response = context.getResponse<Response>();
    const mapped = mapException(exception);
    const requestId = request.id ?? request.header('x-request-id') ?? randomUUID();

    if (mapped.code === 'INTERNAL_ERROR') this.logger.error({ err: exception, requestId, context: ApiExceptionFilter.name }, 'Unhandled request error');

    // message is developer-facing diagnostic text; clients localise the stable code for display.
    const body: ApiError = { code: mapped.code, message: mapped.message, requestId };
    if (mapped.details !== undefined) body.details = mapped.details;
    response.status(mapped.status).json(body);
  }
}
