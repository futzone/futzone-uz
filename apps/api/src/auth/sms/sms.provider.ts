export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
export interface SmsProvider { sendOtp(phone: string, code: string): Promise<void>; }
