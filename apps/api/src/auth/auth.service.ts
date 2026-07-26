import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser, OtpRequestBody, OtpVerifyBody, RegisterBody, TokenResponse } from '@futzone/contracts';
import { randomInt, randomUUID } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import { AppException } from '../common/errors/app.exception';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { RegistrationClaims, RefreshClaims } from './auth.types';
import { OtpRateLimitService } from './otp-rate-limit.service';
import { OtpVerifier } from './otp-verifier.service';
import { PasswordHasher } from './password-hasher.service';
import { SMS_PROVIDER, type SmsProvider } from './sms/sms.provider';

export type RequestMetadata = { ip: string; userAgent?: string };
export type IssuedTokens = TokenResponse & { refreshToken: string; refreshExpiresAt: Date };
const MINUTE = 60_000;
function durationSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error(`Unsupported token TTL format: ${value}`);
  const amount = Number(match[1]);
  const multipliers = { s: 1, m: 60, h: 3_600, d: 86_400 } as const;
  return amount * multipliers[match[2] as keyof typeof multipliers];
}

@Injectable()
export class AuthService {
  public constructor(
    private readonly prisma: PrismaService, private readonly redis: RedisService,
    private readonly jwt: JwtService, private readonly config: ConfigService,
    private readonly hasher: PasswordHasher, private readonly verifier: OtpVerifier,
    private readonly rateLimit: OtpRateLimitService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  public async requestOtp(body: OtpRequestBody, metadata: RequestMetadata): Promise<{ accepted: true }> {
    const phone = body.phone.trim();
    const retryAfterSec = await this.rateLimit.consume(phone, metadata.ip);
    if (retryAfterSec > 0) throw new AppException('OTP_RATE_LIMITED', 'OTP request rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS, { retryAfterSec });
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = await this.hasher.hash(code);
    await this.prisma.otpRequest.create({ data: {
      id: uuidv7(), phone, purpose: body.purpose, codeHash, ip: metadata.ip,
      expiresAt: new Date(Date.now() + 2 * MINUTE),
    } });
    await this.sms.sendOtp(phone, code);
    return { accepted: true };
  }

  public async verifyOtp(body: OtpVerifyBody, metadata: RequestMetadata): Promise<({ needsRegistration: true; registrationToken: string } | ({ needsRegistration: false } & IssuedTokens))> {
    const record = await this.prisma.otpRequest.findFirst({ where: { phone: body.phone }, orderBy: { createdAt: 'desc' } });
    if (!record) throw new AppException('OTP_INVALID', 'Invalid verification code', HttpStatus.UNAUTHORIZED);
    const result = await this.verifier.verify(record, body.code);
    if (result === 'expired') throw new AppException('OTP_EXPIRED', 'Verification code expired', HttpStatus.UNAUTHORIZED);
    if (result === 'exhausted') throw new AppException('OTP_ATTEMPTS_EXCEEDED', 'Verification attempts exceeded', HttpStatus.TOO_MANY_REQUESTS);
    if (result === 'consumed') throw new AppException('OTP_INVALID', 'Verification code already used', HttpStatus.UNAUTHORIZED);
    if (result === 'invalid') {
      const updated = await this.prisma.otpRequest.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      if (updated.attempts >= 5) throw new AppException('OTP_ATTEMPTS_EXCEEDED', 'Verification attempts exceeded', HttpStatus.TOO_MANY_REQUESTS);
      throw new AppException('OTP_INVALID', 'Invalid verification code', HttpStatus.UNAUTHORIZED);
    }
    await this.prisma.otpRequest.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    const user = await this.prisma.user.findFirst({ where: { phone: body.phone, deletedAt: null } });
    if (user) return { needsRegistration: false, ...(await this.issueTokens(user, metadata)) };
    const jti = randomUUID();
    await this.redis.client.set(`registration:${jti}`, body.phone, 'EX', 15 * 60);
    const registrationToken = await this.jwt.signAsync<RegistrationClaims>({ jti, type: 'registration' }, { secret: this.config.get('JWT_REFRESH_SECRET'), expiresIn: '15m' });
    return { needsRegistration: true, registrationToken };
  }

  public async register(body: RegisterBody, metadata: RequestMetadata): Promise<IssuedTokens> {
    let claims: RegistrationClaims;
    try { claims = await this.jwt.verifyAsync<RegistrationClaims>(body.registrationToken, { secret: this.config.get('JWT_REFRESH_SECRET') }); }
    catch { throw new AppException('UNAUTHORIZED', 'Invalid registration token', HttpStatus.UNAUTHORIZED); }
    if (claims.type !== 'registration') throw new AppException('UNAUTHORIZED', 'Invalid registration token', HttpStatus.UNAUTHORIZED);
    const phone = await this.redis.client.getdel(`registration:${claims.jti}`);
    if (!phone) throw new AppException('UNAUTHORIZED', 'Registration token expired or already used', HttpStatus.UNAUTHORIZED);
    const exists = await this.prisma.user.findUnique({ where: { username: body.username } });
    if (exists) throw new AppException('USERNAME_TAKEN', 'Username is already taken', HttpStatus.CONFLICT);
    try {
      const user = await this.prisma.user.create({ data: {
        id: uuidv7(), phone, phoneVerifiedAt: new Date(), firstName: body.firstName,
        lastName: body.lastName, username: body.username,
      } });
      return this.issueTokens(user, metadata);
    } catch (error: unknown) {
      if (this.isUniqueConstraint(error)) throw new AppException('USERNAME_TAKEN', 'Username is already taken', HttpStatus.CONFLICT);
      throw error;
    }
  }

  public async usernameAvailable(username: string): Promise<{ available: boolean; suggestions: string[] }> {
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (!existing) return { available: true, suggestions: [] };
    const rows = await this.prisma.$queryRaw<Array<{ username: string }>>`
      SELECT username FROM users WHERE deleted_at IS NULL AND username <> ${username}
      ORDER BY similarity(username, ${username}) DESC, username ASC LIMIT 3`;
    const suggestions = rows.map((row) => row.username);
    for (let suffix = 1; suggestions.length < 3; suffix += 1) {
      const candidate = `${username.slice(0, Math.max(3, 20 - String(suffix).length))}${suffix}`;
      if (!suggestions.includes(candidate)) suggestions.push(candidate);
    }
    return { available: false, suggestions };
  }

  public async refresh(token: string | undefined, metadata: RequestMetadata): Promise<IssuedTokens> {
    if (!token) throw new AppException('UNAUTHORIZED', 'Refresh token required', HttpStatus.UNAUTHORIZED);
    let claims: RefreshClaims;
    try { claims = await this.jwt.verifyAsync<RefreshClaims>(token, { secret: this.config.get('JWT_REFRESH_SECRET') }); }
    catch { throw new AppException('UNAUTHORIZED', 'Invalid refresh token', HttpStatus.UNAUTHORIZED); }
    if (claims.type !== 'refresh') throw new AppException('UNAUTHORIZED', 'Invalid refresh token', HttpStatus.UNAUTHORIZED);
    const session = await this.prisma.session.findUnique({ where: { id: claims.sid }, include: { user: true } });
    if (!session || session.family !== claims.family) throw new AppException('UNAUTHORIZED', 'Invalid refresh session', HttpStatus.UNAUTHORIZED);
    if (session.revokedAt || !(await this.hasher.compare(token, session.refreshTokenHash))) {
      await this.prisma.session.updateMany({ where: { family: claims.family, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new AppException('UNAUTHORIZED', 'Refresh token reuse detected', HttpStatus.UNAUTHORIZED);
    }
    if (session.expiresAt <= new Date()) throw new AppException('UNAUTHORIZED', 'Refresh token expired', HttpStatus.UNAUTHORIZED);
    this.assertTokenEligible(session.user);
    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(session.user, metadata, session.family);
  }

  public async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    try {
      const claims = await this.jwt.verifyAsync<RefreshClaims>(token, { secret: this.config.get('JWT_REFRESH_SECRET'), ignoreExpiration: true });
      if (claims.type === 'refresh') await this.prisma.session.updateMany({ where: { id: claims.sid }, data: { revokedAt: new Date() } });
    } catch { return; }
  }

  public async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new AppException('UNAUTHORIZED', 'User no longer exists', HttpStatus.UNAUTHORIZED);
    return this.publicUser(user);
  }

  private async issueTokens(user: { id: string; firstName: string; lastName: string; username: string; role: 'USER'|'MODERATOR'|'ADMIN'; status: 'ACTIVE'|'WARNED'|'SUSPENDED'|'BANNED'; suspendedUntil: Date|null }, metadata: RequestMetadata, family = uuidv7()): Promise<IssuedTokens> {
    this.assertTokenEligible(user);
    const sessionId = uuidv7();
    const refreshTtlSec = durationSeconds(this.config.get('JWT_REFRESH_TTL'));
    const refreshExpiresAt = new Date(Date.now() + refreshTtlSec * 1_000);
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role, status: user.status, type: 'access' }, { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: durationSeconds(this.config.get('JWT_ACCESS_TTL')) });
    const refreshToken = await this.jwt.signAsync<RefreshClaims>({ sub: user.id, sid: sessionId, family, type: 'refresh' }, { secret: this.config.get('JWT_REFRESH_SECRET'), expiresIn: refreshTtlSec });
    await this.prisma.session.create({ data: { id: sessionId, userId: user.id, family, refreshTokenHash: await this.hasher.hash(refreshToken), expiresAt: refreshExpiresAt, ip: metadata.ip, userAgent: metadata.userAgent } });
    return { accessToken, refreshToken, refreshExpiresAt, user: this.publicUser(user) };
  }

  private assertTokenEligible(user: { status: string; suspendedUntil: Date|null }): void {
    if (user.status === 'BANNED') throw new AppException('USER_BANNED', 'User is banned', HttpStatus.FORBIDDEN);
    if (user.status === 'SUSPENDED') throw new AppException('USER_SUSPENDED', 'User is suspended', HttpStatus.FORBIDDEN);
  }
  private publicUser(user: { id: string; firstName: string; lastName: string; username: string; role: 'USER'|'MODERATOR'|'ADMIN'; status: 'ACTIVE'|'WARNED'|'SUSPENDED'|'BANNED' }): AuthUser {
    return { id: user.id, firstName: user.firstName, lastName: user.lastName, username: user.username, role: user.role, status: user.status };
  }
  private isUniqueConstraint(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'; }
}
