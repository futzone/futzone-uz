import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ZodError } from 'zod';
import { AppException } from '../errors/app.exception';

export type ValidationDetails = Array<{ field: string; message: string }>;

export function zodErrorDetails(error: ZodError): ValidationDetails {
  return error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
}

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  public constructor(private readonly schema?: ZodType) {}

  public transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    if (!this.schema) return value;
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new AppException('VALIDATION_ERROR', 'Request validation failed', 400, zodErrorDetails(result.error));
  }
}
