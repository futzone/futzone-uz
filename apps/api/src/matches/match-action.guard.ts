import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { CurrentUser } from '../auth/auth.types';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { MATCH_ACTION_KEY } from './match-action.decorator';
import {
  assistantMayEditFields,
  mayPerformMatchAction,
  type MatchAction,
  type MatchActorRole,
} from './match-permissions.policy';

@Injectable()
export class MatchActionGuard implements CanActivate {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.get<MatchAction>(MATCH_ACTION_KEY, context.getHandler());
    if (!action) throw new Error('MatchActionGuard requires @RequireMatchAction');
    const request = context.switchToHttp().getRequest<Request & { user: CurrentUser }>();
    const matchId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, deletedAt: null },
      select: {
        ownerId: true,
        participants: {
          where: {
            userId: request.user.id,
            ...(action === 'RATE_PARTICIPANT'
              ? { OR: [{ status: 'CONFIRMED' as const }, { attendanceRecord: { isNot: null } }] }
              : { status: 'CONFIRMED' as const }),
          },
          select: { role: true },
          take: 1,
        },
      },
    });
    if (!match) throw new AppException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
    const role: MatchActorRole =
      match.ownerId === request.user.id ? 'OWNER' : (match.participants[0]?.role ?? null);
    if (!mayPerformMatchAction(role, action))
      throw new AppException('FORBIDDEN', 'This match action is not permitted', HttpStatus.FORBIDDEN, {
        action,
      });
    if (role === 'ASSISTANT' && action === 'EDIT' && !assistantMayEditFields(Object.keys(request.body as object)))
      throw new AppException('FORBIDDEN', 'Assistants cannot edit match prices', HttpStatus.FORBIDDEN, {
        action,
      });
    return true;
  }
}
