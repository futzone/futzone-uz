import { Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OtpRequestBodySchema, OtpVerifyBodySchema, RegisterBodySchema, UsernameAvailableQuerySchema, type AuthUser, type OtpRequestBody, type OtpVerifyBody, type RegisterBody, type TokenResponse } from '@futzone/contracts';
import type { Request, Response } from 'express';
import { ZodBody } from '../common/validation/zod-body.decorator';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { AuthGuard } from './auth.guard';
import { AuthService, type IssuedTokens, type RequestMetadata } from './auth.service';
import { CurrentUserParam } from './current-user.decorator';
import type { CurrentUser } from './auth.types';

const REFRESH_COOKIE = 'futzone_refresh';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  public constructor(private readonly auth: AuthService) {}

  @Post('otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request a phone verification code' })
  @ApiBody({ schema: { $ref: '#/components/schemas/OtpRequestBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/OtpRequestResponse' } })
  public requestOtp(@ZodBody(OtpRequestBodySchema) body: OtpRequestBody, @Req() request: Request): Promise<{ accepted: true }> {
    return this.auth.requestOtp(body, this.metadata(request));
  }

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify a code and log in or begin registration' })
  @ApiBody({ schema: { $ref: '#/components/schemas/OtpVerifyBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/VerifyResponse' } })
  public async verify(@ZodBody(OtpVerifyBodySchema) body: OtpVerifyBody, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<({ needsRegistration: true; registrationToken: string } | ({ needsRegistration: false } & TokenResponse))> {
    const result = await this.auth.verifyOtp(body, this.metadata(request));
    if (result.needsRegistration) return result;
    this.setRefreshCookie(response, result);
    return { needsRegistration: false, accessToken: result.accessToken, user: result.user };
  }

  @Post('register')
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete registration' })
  @ApiBody({ schema: { $ref: '#/components/schemas/RegisterBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/TokenResponse' } })
  public async register(@ZodBody(RegisterBodySchema) body: RegisterBody, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<TokenResponse> {
    const result = await this.auth.register(body, this.metadata(request));
    this.setRefreshCookie(response, result);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Get('username-available')
  @ApiOperation({ summary: 'Check username availability' })
  @ApiQuery({ name: 'username', schema: { type: 'string', pattern: '^[a-z0-9_]{3,20}$' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/UsernameAvailableResponse' } })
  public usernameAvailable(@Query(new ZodValidationPipe(UsernameAvailableQuerySchema)) query: { username: string }): Promise<{ available: boolean; suggestions: string[] }> {
    return this.auth.usernameAvailable(query.username);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Rotate a refresh token' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/TokenResponse' } })
  public async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<TokenResponse> {
    const result = await this.auth.refresh(this.cookie(request, REFRESH_COOKIE), this.metadata(request));
    this.setRefreshCookie(response, result);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Revoke the current refresh session' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/LogoutResponse' } })
  public async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<{ loggedOut: true }> {
    await this.auth.logout(this.cookie(request, REFRESH_COOKIE));
    response.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/auth' });
    return { loggedOut: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AuthUser' } })
  public me(@CurrentUserParam() user: CurrentUser): Promise<AuthUser> { return this.auth.me(user.id); }

  private metadata(request: Request): RequestMetadata { return { ip: request.ip ?? request.socket.remoteAddress ?? 'unknown', userAgent: request.header('user-agent') }; }
  private setRefreshCookie(response: Response, result: IssuedTokens): void {
    response.cookie(REFRESH_COOKIE, result.refreshToken, { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/auth', expires: result.refreshExpiresAt });
  }
  private cookie(request: Request, name: string): string | undefined {
    for (const part of (request.header('cookie') ?? '').split(';')) {
      const [key, ...value] = part.trim().split('=');
      if (key === name) return decodeURIComponent(value.join('='));
    }
    return undefined;
  }
}
