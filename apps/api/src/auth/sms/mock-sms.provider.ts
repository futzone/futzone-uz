import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import type { SmsProvider } from './sms.provider';

@Injectable()
export class MockSmsProvider implements SmsProvider {
  public constructor(private readonly config: ConfigService) {}
  public async sendOtp(phone: string, code: string): Promise<void> {
    const response = await fetch(`${this.config.get('MOCK_SMS_URL')}/sms`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone, message: `Futzone verification code: ${code}` }),
    });
    if (!response.ok) throw new Error(`Mock SMS rejected delivery with status ${response.status}`);
  }
}
