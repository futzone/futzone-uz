import { ERROR_CODES, type ErrorCode } from '@futzone/contracts';
import en from '@futzone/i18n/messages/en';
import ru from '@futzone/i18n/messages/ru';
import uzCyrl from '@futzone/i18n/messages/uz-Cyrl';
import uz from '@futzone/i18n/messages/uz';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UsernameSuggestions } from '../src/components/username-suggestions';
import { DEFAULT_RESEND_SECONDS, resendSecondsRemaining, retryAfterSeconds } from '../src/lib/auth/countdown';
import { formatUzPhone, isValidUzPhone, normalizeUzPhone } from '../src/lib/auth/phone';
import { debounceUsernameCheck, normalizeUsername } from '../src/lib/auth/username';
import { mapErrorCodeToMessage } from '../src/lib/api';

describe('Uzbekistan phone input', () => {
  it('normalizes and masks an Uzbekistan number', () => { expect(normalizeUzPhone('+998 (90) 123-45-67')).toBe('+998901234567'); expect(formatUzPhone('+998901234567')).toBe('+998 90 123 45 67'); });
  it.each(['+998901234567', '90 123 45 67'])('accepts a complete number: %s', (phone) => expect(isValidUzPhone(phone)).toBe(true));
  it.each(['+99890123456', '+997901234567', '+9989012345678'])('rejects an invalid number: %s', (phone) => expect(isValidUzPhone(phone)).toBe(false));
});

describe('resend countdown', () => {
  it('rounds up and never becomes negative', () => { expect(resendSecondsRemaining(61_000, 1_001)).toBe(60); expect(resendSecondsRemaining(10, 11)).toBe(0); });
  it('uses server retryAfterSec with a safe fallback', () => { expect(retryAfterSeconds({ retryAfterSec: 17 })).toBe(17); expect(retryAfterSeconds(null)).toBe(DEFAULT_RESEND_SECONDS); });
});

describe('username availability', () => {
  it('normalizes usernames and debounces checks', async () => {
    vi.useFakeTimers(); const check = vi.fn(async (value: string) => ({ available: false, suggestions: [`${value}_1`] })); const debounced = debounceUsernameCheck(check, 400);
    void debounced('first'); const resultPromise = debounced('player'); await vi.advanceTimersByTimeAsync(400);
    await expect(resultPromise).resolves.toEqual({ available: false, suggestions: ['player_1'] }); expect(check).toHaveBeenCalledOnce(); expect(normalizeUsername('Player! Name')).toBe('playername'); vi.useRealTimers();
  });
  it('renders server suggestions as selectable buttons', () => { const markup = renderToStaticMarkup(React.createElement(UsernameSuggestions, { suggestions: ['player_7', 'player_uz'], onSelect: () => undefined })); expect(markup).toContain('player_7'); expect(markup).toContain('player_uz'); expect(markup.match(/<button/g)).toHaveLength(2); });
});

describe('auth error localization', () => {
  const authCodes: ErrorCode[] = ['OTP_EXPIRED', 'OTP_INVALID', 'OTP_ATTEMPTS_EXCEEDED', 'OTP_RATE_LIMITED', 'USERNAME_TAKEN', 'USERNAME_CHANGE_TOO_SOON', 'UNAUTHORIZED', 'FORBIDDEN', 'VALIDATION_ERROR', 'USER_SUSPENDED', 'USER_BANNED', 'INTERNAL_ERROR'];
  it.each([['en', en], ['uz', uz], ['uz-Cyrl', uzCyrl], ['ru', ru]] as const)('maps every auth error in %s', (_locale, messages) => {
    for (const code of authCodes) { expect(Object.values(ERROR_CODES)).toContain(code); expect(mapErrorCodeToMessage(code, (key) => messages.errors[key.slice(7) as keyof typeof messages.errors])).toBe(messages.errors[code]); }
  });
});
