import { Injectable } from '@nestjs/common';
import type { SmsProvider } from './sms.provider';

@Injectable()
export class EskizSmsProvider implements SmsProvider {
  // Eskiz credentials and production delivery integration are ops work after MVP.
  public async sendOtp(_phone: string, _code: string): Promise<void> {
    throw new Error('Eskiz SMS delivery is not configured');
  }
}
