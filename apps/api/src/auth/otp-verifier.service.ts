import { Injectable } from '@nestjs/common';
import type { OtpRequest } from '../generated/prisma';
import { PasswordHasher } from './password-hasher.service';

export type OtpVerification = 'valid' | 'invalid' | 'expired' | 'exhausted' | 'consumed';

@Injectable()
export class OtpVerifier {
  public constructor(private readonly hasher: PasswordHasher) {}
  public async verify(record: OtpRequest, code: string, now = new Date()): Promise<OtpVerification> {
    if (record.consumedAt) return 'consumed';
    if (record.attempts >= 5) return 'exhausted';
    if (record.expiresAt <= now) return 'expired';
    return (await this.hasher.compare(code, record.codeHash)) ? 'valid' : 'invalid';
  }
}
