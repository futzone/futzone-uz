import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('public match markup privacy', () => {
  it('does not render phone fields or invitation tokens', () => {
    const page = readFileSync(new URL('../src/app/[locale]/matches/[slug]/page.tsx', import.meta.url), 'utf8');
    const participants = readFileSync(new URL('../src/components/participant-list.tsx', import.meta.url), 'utf8');
    expect(`${page}${participants}`).not.toMatch(/phone|invitationToken|token/i);
  });
});
