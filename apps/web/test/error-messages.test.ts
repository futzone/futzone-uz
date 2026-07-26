import { describe, expect, it } from 'vitest';
import { mapErrorCodeToMessage } from '../src/lib/api/errors';
import { getMessages } from '../src/i18n/messages';

const codes = ['RATING_WINDOW_CLOSED', 'SELF_RATING_FORBIDDEN', 'DUPLICATE_RATING', 'DUPLICATE_REPORT', 'NOT_PARTICIPANT', 'FORBIDDEN', 'REQUIREMENTS_NOT_MET', 'DISPUTE_WINDOW_CLOSED'] as const;

describe('Phase 3 localized errors', () => {
  it.each(['uz', 'uz-Cyrl', 'ru', 'en'] as const)('maps typed codes in %s without exposing backend messages', (locale) => {
    const messages = getMessages(locale);
    for (const code of codes) expect(mapErrorCodeToMessage(code, (key) => messages.errors[key.slice(7) as keyof typeof messages.errors])).toBe(messages.errors[code]);
  });
});
