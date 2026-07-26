import { describe, expect, it } from 'vitest';
import messages from '../src/i18n/messages/ru';

function leafValues(value: object): string[] {
  return Object.values(value).flatMap((child) =>
    typeof child === 'object' && child !== null ? leafValues(child) : [String(child)],
  );
}

describe('Russian admin message catalog', () => {
  it('provides a non-empty value for every rendered message', () => {
    const values = leafValues(messages);
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((value) => value.trim().length > 0)).toBe(true);
  });
});
