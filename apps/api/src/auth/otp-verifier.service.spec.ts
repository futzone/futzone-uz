import type { OtpRequest } from '../generated/prisma';
import { OtpVerifier } from './otp-verifier.service';
import type { PasswordHasher } from './password-hasher.service';

const record = (overrides: Partial<OtpRequest> = {}): OtpRequest => ({
  id: '00000000-0000-7000-8000-000000000001', phone: '+998901234567', codeHash: 'hash',
  purpose: 'LOGIN', expiresAt: new Date('2026-07-22T10:02:00Z'), attempts: 0,
  consumedAt: null, createdAt: new Date('2026-07-22T10:00:00Z'), ip: '127.0.0.1', ...overrides,
});

describe('OtpVerifier', () => {
  const compare = jest.fn<Promise<boolean>, [string, string]>();
  const verifier = new OtpVerifier({ compare } as Pick<PasswordHasher, 'compare'> as PasswordHasher);
  beforeEach(() => compare.mockReset());

  it('rejects an expired OTP', async () => {
    expect(await verifier.verify(record(), '123456', new Date('2026-07-22T10:02:00Z'))).toBe('expired');
  });
  it('rejects an exhausted OTP without another attempt', async () => {
    expect(await verifier.verify(record({ attempts: 5 }), '123456', new Date('2026-07-22T10:01:00Z'))).toBe('exhausted');
  });
  it('uses the same hash comparison path for matching and non-matching codes', async () => {
    compare.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await verifier.verify(record(), '000000', new Date('2026-07-22T10:01:00Z'))).toBe('invalid');
    expect(await verifier.verify(record(), '123456', new Date('2026-07-22T10:01:00Z'))).toBe('valid');
    expect(compare.mock.calls).toEqual([['000000', 'hash'], ['123456', 'hash']]);
  });
});
