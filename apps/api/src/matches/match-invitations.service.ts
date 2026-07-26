import { randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  Invitation as InvitationResponse,
  InviteByUsernameBody,
  JoinMatchBody,
  JoinMatchResponse,
  ShareInvitation,
} from '@futzone/contracts';
import type { Invitation } from '../generated/prisma';
import { v7 as uuidv7 } from 'uuid';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MatchParticipationService } from './match-participation.service';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60_000;

@Injectable()
export class MatchInvitationsService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly participation: MatchParticipationService,
    private readonly notifications: NotificationsService,
  ) {}

  public async inviteByUsername(
    matchId: string,
    inviterId: string,
    body: InviteByUsernameBody,
  ): Promise<InvitationResponse> {
    const invitee = await this.prisma.user.findFirst({
      where: { username: body.username, deletedAt: null },
      select: { id: true },
    });
    if (!invitee) throw new AppException('NOT_FOUND', 'User not found', HttpStatus.NOT_FOUND);
    if (invitee.id === inviterId)
      throw new AppException('VALIDATION_ERROR', 'You cannot invite yourself');
    const invitation = await this.prisma.invitation.create({
      data: {
        id: uuidv7(),
        matchId,
        inviterId,
        inviteeId: invitee.id,
        token: this.token(),
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
    });
    await this.notifications.notify(
      invitee.id,
      'MATCH_INVITE',
      { invitationId: invitation.id, inviterId },
      { matchId },
    );
    return this.response(invitation);
  }

  public async mintShareLink(matchId: string, inviterId: string): Promise<ShareInvitation> {
    const invitation = await this.prisma.invitation.create({
      data: {
        id: uuidv7(),
        matchId,
        inviterId,
        token: this.token(),
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
    });
    return {
      ...this.response(invitation),
      token: invitation.token,
      url: `https://futzone.uz/join/${invitation.token}`,
    };
  }

  public async acceptToken(
    token: string,
    userId: string,
    body: Omit<JoinMatchBody, 'invitationToken'>,
  ): Promise<JoinMatchResponse> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      select: { matchId: true },
    });
    if (!invitation)
      throw new AppException('INVITATION_REQUIRED', 'Invitation is invalid', HttpStatus.FORBIDDEN);
    return this.participation.join(invitation.matchId, userId, { ...body, invitationToken: token });
  }

  private token(): string {
    return randomBytes(32).toString('base64url');
  }

  private response(invitation: Invitation): InvitationResponse {
    return {
      id: invitation.id,
      matchId: invitation.matchId,
      inviterId: invitation.inviterId,
      inviteeId: invitation.inviteeId,
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }
}
