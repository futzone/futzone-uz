import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { CurrentUser } from './auth.types';

export const CurrentUserParam = createParamDecorator((_data: unknown, context: ExecutionContext): CurrentUser => {
  return context.switchToHttp().getRequest<Request & { user: CurrentUser }>().user;
});
