import { ERROR_CODES, type ApiError } from '@futzone/contracts';
import { locales, type Locale } from '@futzone/i18n';
import en from '@futzone/i18n/messages/en';
import ru from '@futzone/i18n/messages/ru';
import uzCyrl from '@futzone/i18n/messages/uz-Cyrl';
import uz from '@futzone/i18n/messages/uz';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiClientError } from '../src/lib/api/client';
import { errorMessageKeys, mapErrorCodeToMessage } from '../src/lib/api/errors';

const messagesByLocale = { uz, 'uz-Cyrl': uzCyrl, ru, en } satisfies Record<Locale, typeof en>;

describe('ApiClient', () => {
  it('turns an ApiError response into a typed ApiClientError', async () => {
    const body: ApiError = { code: ERROR_CODES.MATCH_FULL, message: 'backend-only message', requestId: 'request-1' };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status: 409, headers: { 'content-type': 'application/json' } }));
    const client = new ApiClient('http://localhost:4000', fetcher);
    const error = await client.getHealth().catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ code: ERROR_CODES.MATCH_FULL, requestId: 'request-1', status: 409 });
  });
});

describe('mapErrorCodeToMessage', () => {
  it('has a non-empty, locale-specific message for every shared error code in every locale', () => {
    expect(Object.keys(errorMessageKeys).sort()).toEqual(Object.values(ERROR_CODES).sort());
    for (const code of Object.values(ERROR_CODES)) {
      const localizedMessages: string[] = [];
      for (const locale of locales) {
        const messages = messagesByLocale[locale];
        expect(Object.hasOwn(messages.errors, code), `${locale} is missing errors.${code}`).toBe(true);
        const localizedMessage = messages.errors[code];
        expect(localizedMessage.trim(), `${locale} has an empty errors.${code}`).not.toBe('');
        expect(mapErrorCodeToMessage(code, (key) => {
          expect(key).toBe(`errors.${code}`);
          return localizedMessage;
        })).toBe(localizedMessage);
        localizedMessages.push(localizedMessage);
      }
      expect(new Set(localizedMessages).size, `errors.${code} must not use a shared or fallback message`).toBe(locales.length);
    }
  });
  it.each(['MATCH_FULL', 'ALREADY_JOINED', 'OVERLAPPING_MATCH', 'REQUIREMENTS_NOT_MET', 'INVITATION_REQUIRED'] as const)('maps join and waitlist error %s without exposing backend text', (code) => {
    expect(mapErrorCodeToMessage(code, (key) => `localized:${key}`)).toBe(`localized:errors.${code}`);
  });
});
