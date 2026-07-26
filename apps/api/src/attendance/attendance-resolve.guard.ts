import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { CurrentUser } from '../auth/auth.types';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { MATCH_ACTIONS, mayPerformMatchAction, type MatchActorRole } from '../matches/match-permissions.policy';

@Injectable()
export class AttendanceResolveGuard implements CanActivate {
  public constructor(private readonly prisma: PrismaService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: CurrentUser }>();
    const recordId = Array.isArray(request.params.recordId) ? request.params.recordId[0] : request.params.recordId;
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      select: {
        disputeStatus: true,
        finalizedAt: true,
        match: {
          select: {
            ownerId: true,
            participants: {
              where: { userId: request.user.id, status: 'CONFIRMED' },
              select: { role: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!record) throw new AppException('NOT_FOUND', 'Attendance record not found', HttpStatus.NOT_FOUND);
    if (record.disputeStatus !== 'OPEN')
      throw new AppException('INVALID_STATE_TRANSITION', 'Only an open attendance dispute can be resolved', HttpStatus.CONFLICT);
    if (request.user.role === 'ADMIN') {
      return true;
    }
    if (record.finalizedAt)
      throw new AppException('ATTENDANCE_WINDOW_CLOSED', 'Only an admin may resolve an escalated finalized dispute', HttpStatus.CONFLICT);
    const role: MatchActorRole =
      record.match.ownerId === request.user.id ? 'OWNER' : (record.match.participants[0]?.role ?? null);
    if (!mayPerformMatchAction(role, MATCH_ACTIONS.RESOLVE_ATTENDANCE))
      throw new AppException('FORBIDDEN', 'Attendance resolution is not permitted', HttpStatus.FORBIDDEN);
    return true;
  }
}
