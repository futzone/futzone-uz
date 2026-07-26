import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessClaims, CurrentUser } from './auth.types';

/**
 * Populates `request.user` when a valid access token is present, but never rejects: an
 * anonymous request proceeds without a user. Suspended/banned or unknown users are treated
 * as anonymous. Used on otherwise-public endpoints that offer a personalized variant
 * (e.g. `GET /matches?favoritesOnly=true`).
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  public constructor(private readonly jwt: JwtService, private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: CurrentUser }>();
    const [scheme, token] = request.header('authorization')?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) return true;
    try {
      const claims = await this.jwt.verifyAsync<AccessClaims>(token, { secret: this.config.get('JWT_ACCESS_SECRET') });
      if (claims.type !== 'access') return true;
      const user = await this.prisma.user.findFirst({ where: { id: claims.sub, deletedAt: null }, select: { id: true, role: true, status: true } });
      if (user && user.status === 'ACTIVE') request.user = user;
    } catch {
      // Invalid/expired token → proceed anonymously.
    }
    return true;
  }
}
