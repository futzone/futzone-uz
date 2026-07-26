import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '../config/config.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { OptionalAuthGuard } from './optional-auth.guard';
import { AuthService } from './auth.service';
import { OtpRateLimitService } from './otp-rate-limit.service';
import { OtpVerifier } from './otp-verifier.service';
import { PasswordHasher } from './password-hasher.service';
import { EskizSmsProvider } from './sms/eskiz-sms.provider';
import { MockSmsProvider } from './sms/mock-sms.provider';
import { SMS_PROVIDER, type SmsProvider } from './sms/sms.provider';

@Module({
  imports: [JwtModule.register({})], controllers: [AuthController],
  providers: [AuthService, AuthGuard, OptionalAuthGuard, OtpRateLimitService, OtpVerifier, PasswordHasher, MockSmsProvider, EskizSmsProvider, {
    provide: SMS_PROVIDER, inject: [ConfigService, MockSmsProvider, EskizSmsProvider],
    useFactory: (config: ConfigService, mock: MockSmsProvider, eskiz: EskizSmsProvider): SmsProvider => config.get('SMS_PROVIDER') === 'eskiz' ? eskiz : mock,
  }], exports: [AuthGuard, OptionalAuthGuard, JwtModule],
})
export class AuthModule {}
