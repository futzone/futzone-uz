import { Body } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

export function ZodBody(schema: ZodType): ParameterDecorator {
  return Body(new ZodValidationPipe(schema));
}
