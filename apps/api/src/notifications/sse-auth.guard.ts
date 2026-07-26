import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppException } from '../common/errors/app.exception';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessClaims, CurrentUser } from '../auth/auth.types';

// EventSource cannot set an Authorization header, so the SSE route authenticates via a short-lived
// access token in the query string. Same verification as AuthGuard otherwise (see DECISIONS.md ADR-038).
@Injectable()
export class SseAuthGuard implements CanActivate {
  public constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: CurrentUser }>();
    const raw = request.query.token;
    const token = Array.isArray(raw) ? raw[0] : raw;
    if (typeof token !== 'string' || !token) throw new AppException('UNAUTHORIZED', 'Authentication required', HttpStatus.UNAUTHORIZED);
    let claims: AccessClaims;
    try { claims = await this.jwt.verifyAsync<AccessClaims>(token, { secret: this.config.get('JWT_ACCESS_SECRET') }); }
    catch { throw new AppException('UNAUTHORIZED', 'Invalid access token', HttpStatus.UNAUTHORIZED); }
    if (claims.type !== 'access') throw new AppException('UNAUTHORIZED', 'Invalid access token', HttpStatus.UNAUTHORIZED);
    const user = await this.prisma.user.findFirst({ where: { id: claims.sub, deletedAt: null }, select: { id: true, role: true, status: true } });
    if (!user) throw new AppException('UNAUTHORIZED', 'User no longer exists', HttpStatus.UNAUTHORIZED);
    if (user.status === 'SUSPENDED') throw new AppException('USER_SUSPENDED', 'User is suspended', HttpStatus.FORBIDDEN);
    if (user.status === 'BANNED') throw new AppException('USER_BANNED', 'User is banned', HttpStatus.FORBIDDEN);
    request.user = user;
    return true;
  }
}
