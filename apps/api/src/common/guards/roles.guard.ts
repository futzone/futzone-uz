import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { UserRole } from '@futzone/contracts';
import type { CurrentUser } from '../../auth/auth.types';
import { AppException } from '../errors/app.exception';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  public constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles || roles.length === 0) return true;
    const user = context.switchToHttp().getRequest<Request & { user?: CurrentUser }>().user;
    if (!user || !roles.includes(user.role))
      throw new AppException('FORBIDDEN', 'You do not have permission to perform this action', HttpStatus.FORBIDDEN, { requiredRoles: roles });
    return true;
  }
}
