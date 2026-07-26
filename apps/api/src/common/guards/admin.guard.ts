import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { CurrentUser } from '../../auth/auth.types';
import { AppException } from '../errors/app.exception';

@Injectable()
export class AdminGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<Request & { user: CurrentUser }>().user;
    if (user.role !== 'ADMIN') throw new AppException('FORBIDDEN', 'Administrator role required', HttpStatus.FORBIDDEN);
    return true;
  }
}
