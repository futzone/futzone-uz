import { Injectable } from '@nestjs/common';
import type { MatchTransitionJobPayload, WaitlistPromotionExpiryJobPayload } from '@futzone/contracts';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { MatchParticipationService } from './match-participation.service';
import { MatchStateService } from './match-state.service';
import { AttendanceService } from '../attendance/attendance.service';
import { AttendanceQueueService } from '../attendance/attendance-queue.service';
import type { AttendanceFallbackJobPayload, AttendanceFinalizeJobPayload } from '@futzone/contracts';
import type { RatingWindowCloseJobPayload } from '@futzone/contracts';
import { ratingWindowClosesAt } from '../ratings/rating-window';

@Injectable()
export class MatchJobProcessorService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly states: MatchStateService,
    private readonly participation: MatchParticipationService,
    private readonly attendance: AttendanceService,
    private readonly attendanceQueue: AttendanceQueueService,
  ) {}

  public async start(payload: MatchTransitionJobPayload): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ status: string }>>(
        Prisma.sql`SELECT status FROM matches WHERE id = ${payload.matchId}::uuid AND deleted_at IS NULL FOR UPDATE`,
      );
      const status = rows[0]?.status;
      if (status !== 'PUBLISHED' && status !== 'FULL') return;
      await this.states.transition(tx, payload.matchId, status, 'STARTED');
    });
  }

  public async finish(payload: MatchTransitionJobPayload): Promise<void> {
    const attendancePending = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ status: string }>>(
        Prisma.sql`SELECT status FROM matches WHERE id = ${payload.matchId}::uuid AND deleted_at IS NULL FOR UPDATE`,
      );
      if (rows[0]?.status === 'STARTED') {
        await this.states.transition(tx, payload.matchId, 'STARTED', 'FINISHED');
        await this.states.transition(tx, payload.matchId, 'FINISHED', 'ATTENDANCE_PENDING');
        return true;
      }
      // A retry after the transaction committed but queue scheduling failed must repair
      // the deterministic fallback job without repeating either state transition.
      return rows[0]?.status === 'ATTENDANCE_PENDING';
    });
    if (attendancePending) await this.attendanceQueue.scheduleFallback(payload.matchId);
  }

  public expirePromotion(payload: WaitlistPromotionExpiryJobPayload): Promise<void> {
    return this.participation.expirePromotion(payload);
  }
  public fallback(payload: AttendanceFallbackJobPayload): Promise<void> { return this.attendance.fallback(payload.matchId); }
  public finalize(payload: AttendanceFinalizeJobPayload): Promise<void> { return this.attendance.finalize(payload.recordId); }
  public async closeRatingWindow(payload: RatingWindowCloseJobPayload, now = new Date()): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ status: string; startsAt: Date; durationMin: number }>>(
        Prisma.sql`SELECT status, starts_at AS "startsAt", duration_min AS "durationMin" FROM matches WHERE id = ${payload.matchId}::uuid AND deleted_at IS NULL FOR UPDATE`,
      );
      const match = rows[0];
      if (!match || match.status !== 'RATING_PENDING') return;
      if (ratingWindowClosesAt(match.startsAt, match.durationMin) > now) return;
      await this.states.transition(tx, payload.matchId, 'RATING_PENDING', 'COMPLETED');
    });
  }
}
