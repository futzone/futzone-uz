import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import { AppException } from '../errors/app.exception';
import { mapException } from './api-exception.filter';

describe('mapException', () => {
  it.each([
    [new UnauthorizedException(), 'UNAUTHORIZED', 401],
    [new ForbiddenException(), 'FORBIDDEN', 403],
    [new NotFoundException(), 'NOT_FOUND', 404],
    [new AppException('MATCH_FULL', 'full', 409), 'MATCH_FULL', 409],
    [z.object({ name: z.string() }).safeParse({ name: 1 }), 'VALIDATION_ERROR', 400],
    [new Error('secret stack'), 'INTERNAL_ERROR', 500],
  ])('maps an error to %s', (input, code, status) => {
    const exception = typeof input === 'object' && input !== null && 'success' in input && input.success === false ? input.error : input;
    expect(mapException(exception)).toEqual(expect.objectContaining({ code, status }));
  });
});
