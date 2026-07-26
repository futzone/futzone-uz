import { HttpStatus, Injectable } from '@nestjs/common';
import type { CreateRatingBody, RatablePlayer, Rating as RatingResponse, RatingReport } from '@futzone/contracts';
import { Prisma, type Rating, type Report } from '../generated/prisma';
import { v7 as uuidv7 } from 'uuid';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { isInsideRatingWindow } from './rating-window';
import { StatsQueueService } from '../stats/stats-queue.service';

const INELIGIBLE_ATTENDANCE = ['NO_SHOW', 'REMOVED_BY_OWNER'] as const;

// TODO(phase-3-stats): P3-04 should reuse this predicate when selecting ratings for aggregates.
export const ratingsThatCountWhere = {
  status: 'ACTIVE',
  deletedAt: null,
  rater: { status: { not: 'BANNED' } },
} satisfies Prisma.RatingWhereInput;

@Injectable()
export class RatingsService {
  public constructor(private readonly prisma: PrismaService, private readonly statsQueue: StatsQueueService) {}

  public async ratable(matchId: string, raterId: string, now = new Date()): Promise<RatablePlayer[]> {
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, deletedAt: null },
      select: {
        startsAt: true, durationMin: true, status: true,
        participants: {
          where: { attendanceRecord: { is: { status: { notIn: [...INELIGIBLE_ATTENDANCE] } } } },
          select: {
            userId: true,
            user: { select: { firstName: true, lastName: true, username: true } },
          },
        },
        ratings: { where: { raterId, deletedAt: null }, select: { id: true, rateeId: true } },
      },
    });
    if (!match) throw new AppException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
    this.assertWindow(match, now);
    if (!match.participants.some((participant) => participant.userId === raterId))
      throw new AppException('NOT_PARTICIPANT', 'Caller is not eligible to rate this match', HttpStatus.FORBIDDEN);
    const existing = new Map(match.ratings.map((rating) => [rating.rateeId, rating.id]));
    return match.participants
      .filter((participant) => participant.userId !== raterId)
      .map((participant) => ({
        userId: participant.userId,
        firstName: participant.user.firstName,
        lastName: participant.user.lastName,
        username: participant.user.username,
        alreadyRated: existing.has(participant.userId),
        ratingId: existing.get(participant.userId) ?? null,
      }));
  }

  public async create(matchId: string, raterId: string, body: CreateRatingBody, now = new Date()): Promise<RatingResponse> {
    if (raterId === body.rateeId)
      throw new AppException('SELF_RATING_FORBIDDEN', 'Players cannot rate themselves', HttpStatus.FORBIDDEN);
    try {
      const rating = await this.prisma.$transaction(async (tx) => {
        const match = await tx.match.findFirst({
          where: { id: matchId, deletedAt: null },
          select: { startsAt: true, durationMin: true, status: true },
        });
        if (!match) throw new AppException('NOT_FOUND', 'Match not found', HttpStatus.NOT_FOUND);
        this.assertWindow(match, now);
        const participants = await tx.matchParticipant.findMany({
          where: { matchId, userId: { in: [raterId, body.rateeId] } },
          select: { userId: true, attendanceRecord: { select: { status: true } } },
        });
        const eligible = new Set(participants
          .filter((participant) => participant.attendanceRecord && !INELIGIBLE_ATTENDANCE.includes(participant.attendanceRecord.status as typeof INELIGIBLE_ATTENDANCE[number]))
          .map((participant) => participant.userId));
        if (!eligible.has(raterId) || !eligible.has(body.rateeId))
          throw new AppException('NOT_PARTICIPANT', 'Both users must be eligible participants', HttpStatus.FORBIDDEN);
        const existing = await tx.rating.findUnique({
          where: { matchId_raterId_rateeId: { matchId, raterId, rateeId: body.rateeId } },
        });
        if (existing && !existing.deletedAt)
          throw new AppException('DUPLICATE_RATING', 'This participant has already been rated', HttpStatus.CONFLICT);
        const data = {
          discipline: body.discipline, punctuality: body.punctuality, fairPlay: body.fairPlay,
          teamPlay: body.teamPlay, overall: body.overall, comment: body.comment,
          status: 'ACTIVE' as const, deletedAt: null, createdAt: now,
        };
        if (existing) {
          await tx.report.deleteMany({ where: { ratingId: existing.id } });
          return tx.rating.update({ where: { id: existing.id }, data });
        }
        return tx.rating.create({ data: { id: uuidv7(), matchId, raterId, rateeId: body.rateeId, ...data } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      await this.statsQueue.ratingChanged(rating.rateeId);
      return this.ratingResponse(rating);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034'))
        throw new AppException('DUPLICATE_RATING', 'This participant has already been rated', HttpStatus.CONFLICT);
      throw error;
    }
  }

  public async remove(matchId: string, ratingId: string, raterId: string, now = new Date()): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const rating = await tx.rating.findFirst({
        where: { id: ratingId, matchId, deletedAt: null },
        include: { match: { select: { startsAt: true, durationMin: true, status: true } } },
      });
      if (!rating) throw new AppException('NOT_FOUND', 'Rating not found', HttpStatus.NOT_FOUND);
      if (rating.raterId !== raterId)
        throw new AppException('FORBIDDEN', 'Only the rating author may delete it', HttpStatus.FORBIDDEN);
      this.assertWindow(rating.match, now);
      await tx.rating.update({ where: { id: rating.id }, data: { deletedAt: now, status: 'REMOVED' } });
    });
    const removed = await this.prisma.rating.findUnique({ where: { id: ratingId }, select: { rateeId: true } });
    if (removed) await this.statsQueue.ratingChanged(removed.rateeId);
  }

  public async report(ratingId: string, reporterId: string, reason: string): Promise<RatingReport> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT id FROM ratings WHERE id = ${ratingId}::uuid AND status = 'ACTIVE' AND deleted_at IS NULL FOR UPDATE`,
        );
        if (!locked[0]) throw new AppException('NOT_FOUND', 'Rating not found', HttpStatus.NOT_FOUND);
        const existing = await tx.report.findUnique({ where: { ratingId_reporterId: { ratingId, reporterId } } });
        if (existing) throw new AppException('DUPLICATE_REPORT', 'This rating has already been reported by this user', HttpStatus.CONFLICT);
        const saved = await tx.report.create({ data: { id: uuidv7(), ratingId, reporterId, reason } });
        const distinctReports = await tx.report.count({ where: { ratingId } });
        const hidden = distinctReports >= 3
          ? (await tx.rating.updateMany({ where: { id: ratingId, status: 'ACTIVE', deletedAt: null }, data: { status: 'HIDDEN' } })).count > 0
          : false;
        const hiddenRating = hidden
          ? await tx.rating.findUnique({ where: { id: ratingId }, select: { rateeId: true } })
          : null;
        // Auto-hide is a moderator signal, wired with the moderation queue in P5-08 (not a user notification).
        return { saved, hiddenRateeId: hiddenRating?.rateeId ?? null };
      });
      if (result.hiddenRateeId) await this.statsQueue.ratingChanged(result.hiddenRateeId);
      return this.reportResponse(result.saved);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new AppException('DUPLICATE_REPORT', 'This rating has already been reported by this user', HttpStatus.CONFLICT);
      throw error;
    }
  }

  private assertWindow(match: { startsAt: Date; durationMin: number; status: string }, now: Date): void {
    if (match.status !== 'RATING_PENDING' || !isInsideRatingWindow(match.startsAt, match.durationMin, now))
      throw new AppException('RATING_WINDOW_CLOSED', 'Rating window is closed', HttpStatus.CONFLICT);
  }

  private ratingResponse(rating: Rating): RatingResponse {
    return {
      id: rating.id, matchId: rating.matchId, raterId: rating.raterId, rateeId: rating.rateeId,
      discipline: rating.discipline, punctuality: rating.punctuality, fairPlay: rating.fairPlay,
      teamPlay: rating.teamPlay, overall: rating.overall, comment: rating.comment,
      status: rating.status, createdAt: rating.createdAt.toISOString(),
    };
  }

  private reportResponse(report: Report): RatingReport {
    return {
      id: report.id, ratingId: report.ratingId, reporterId: report.reporterId,
      reason: report.reason, createdAt: report.createdAt.toISOString(),
    };
  }
}
