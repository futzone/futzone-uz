import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  AdminDisputeResolveBody,
  AdminModerationActionResponse,
  AdminModerationQueue,
  AdminReportActionBody,
  AdminStadiumDecisionBody,
} from '@futzone/contracts';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StatsQueueService } from '../stats/stats-queue.service';
import { AttendanceQueueService } from '../attendance/attendance-queue.service';
import { AuditService } from './audit.service';

const RATING_STATUS = { hide: 'HIDDEN', restore: 'ACTIVE', delete: 'REMOVED' } as const;

@Injectable()
export class AdminModerationService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly statsQueue: StatsQueueService,
    private readonly attendanceQueue: AttendanceQueueService,
    private readonly audit: AuditService,
  ) {}

  public async queue(): Promise<AdminModerationQueue> {
    const [reportedRatings, disputes, stadiums] = await Promise.all([
      this.prisma.rating.findMany({
        where: { reports: { some: {} }, status: { not: 'REMOVED' }, deletedAt: null },
        orderBy: { createdAt: 'desc' }, take: 100,
        include: { reports: { select: { reason: true } }, ratee: { select: { username: true } }, rater: { select: { username: true } } },
      }),
      this.prisma.attendanceRecord.findMany({
        where: { disputeStatus: 'OPEN' }, orderBy: { markedAt: 'desc' }, take: 100,
        include: { match: { select: { title: true } }, participant: { select: { user: { select: { username: true } } } } },
      }),
      this.prisma.stadium.findMany({
        where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 100,
        include: { city: { select: { nameUz: true } }, createdBy: { select: { username: true } } },
      }),
    ]);
    return {
      reports: reportedRatings.map((r) => ({
        ratingId: r.id, comment: r.comment, overall: r.overall, status: r.status,
        reportCount: r.reports.length, reasons: r.reports.map((x) => x.reason),
        rateeUsername: r.ratee.username, raterUsername: r.rater.username, createdAt: r.createdAt.toISOString(),
      })),
      disputes: disputes.map((d) => ({
        recordId: d.id, matchId: d.matchId, matchTitle: d.match.title,
        participantUsername: d.participant.user.username, status: d.status, disputeNote: d.disputeNote,
      })),
      stadiums: stadiums.map((s) => ({
        id: s.id, name: s.nameUz, cityName: s.city?.nameUz ?? null,
        submittedByUsername: s.createdBy.username, createdAt: s.createdAt.toISOString(),
      })),
    };
  }

  // Hide/restore/delete a reported rating-comment; notify each reporter that their report was actioned.
  public async resolveReport(actorId: string, ratingId: string, body: AdminReportActionBody): Promise<AdminModerationActionResponse> {
    const status = RATING_STATUS[body.action];
    const rateeId = await this.prisma.$transaction(async (tx) => {
      const rating = await tx.rating.findFirst({ where: { id: ratingId, deletedAt: null }, select: { status: true, rateeId: true } });
      if (!rating) throw new AppException('NOT_FOUND', 'Rating not found', HttpStatus.NOT_FOUND);
      await tx.rating.update({ where: { id: ratingId }, data: { status, deletedAt: body.action === 'delete' ? new Date() : null } });
      await this.audit.record(tx, { actorId, action: `RATING_${body.action.toUpperCase()}`, targetType: 'Rating', targetId: ratingId, before: { status: rating.status }, after: { status }, reason: body.reason });
      const reports = await tx.report.findMany({ where: { ratingId }, select: { id: true, reporterId: true } });
      for (const report of reports) await this.notifications.notify(report.reporterId, 'REPORT_RESOLVED', { reportId: report.id }, { tx });
      return rating.rateeId;
    });
    await this.statsQueue.ratingChanged(rateeId); // visibility change alters the ratee's aggregate
    return { resolved: true };
  }

  // Uphold/overturn an open attendance dispute; finalize the record and notify the participant.
  public async resolveDispute(actorId: string, recordId: string, body: AdminDisputeResolveBody): Promise<AdminModerationActionResponse> {
    const userId = await this.prisma.$transaction(async (tx) => {
      const record = await tx.attendanceRecord.findUnique({ where: { id: recordId }, include: { participant: { select: { userId: true } } } });
      if (!record) throw new AppException('NOT_FOUND', 'Attendance record not found', HttpStatus.NOT_FOUND);
      if (record.disputeStatus !== 'OPEN') throw new AppException('INVALID_STATE_TRANSITION', 'This dispute is not open', HttpStatus.CONFLICT);
      const disputeStatus = body.status === record.status ? 'UPHELD' : 'OVERTURNED';
      await tx.attendanceRecord.update({ where: { id: recordId }, data: { status: body.status, disputeStatus, disputeResolvedById: actorId, finalizedAt: new Date() } });
      await this.audit.record(tx, { actorId, action: 'ATTENDANCE_DISPUTE_RESOLVED', targetType: 'AttendanceRecord', targetId: recordId, before: { status: record.status }, after: { status: body.status, disputeStatus }, reason: body.reason });
      await this.notifications.notify(record.participant.userId, 'ATTENDANCE_DISPUTE_RESOLVED', { recordId, disputeStatus }, { matchId: record.matchId, tx });
      return record.participant.userId;
    });
    await this.attendanceQueue.cancelFinalization(recordId);
    await this.statsQueue.attendanceFinalized(userId);
    return { resolved: true };
  }

  // Approve/reject a pending stadium submission. No MVP notification type covers stadium submitters
  // (see DECISIONS.md ADR-037); the decision is audited and the stadium becomes (un)listable.
  public async resolveStadium(actorId: string, stadiumId: string, body: AdminStadiumDecisionBody): Promise<AdminModerationActionResponse> {
    await this.prisma.$transaction(async (tx) => {
      const stadium = await tx.stadium.findUnique({ where: { id: stadiumId }, select: { status: true } });
      if (!stadium) throw new AppException('NOT_FOUND', 'Stadium not found', HttpStatus.NOT_FOUND);
      if (stadium.status !== 'PENDING') throw new AppException('INVALID_STATE_TRANSITION', 'This stadium has already been reviewed', HttpStatus.CONFLICT);
      await tx.stadium.update({ where: { id: stadiumId }, data: { status: body.decision } });
      await this.audit.record(tx, { actorId, action: `STADIUM_${body.decision}`, targetType: 'Stadium', targetId: stadiumId, before: { status: stadium.status }, after: { status: body.decision }, reason: body.reason });
    });
    return { resolved: true };
  }
}
