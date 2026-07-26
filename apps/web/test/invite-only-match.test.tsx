import type { InviteOnlyMatchShell } from '@futzone/contracts';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InviteOnlyMatchShellView } from '../src/components/invite-only-match-shell';
import { matchRobots } from '../src/lib/match-metadata';

const match: InviteOnlyMatchShell = {
  visibility: 'INVITE_ONLY_SHELL',
  id: '01984ac4-89a1-7000-8000-000000000001',
  slug: 'phase2-eight-invite',
  title: 'Private evening match',
  format: 'F8',
  startsAt: '2026-08-01T14:00:00.000Z',
  joinMode: 'INVITE_ONLY',
  status: 'PUBLISHED',
  city: { slug: 'tashkent', name: 'Toshkent' },
};

describe('anonymous invite-only match shell', () => {
  it('emits noindex metadata and omits participants and private contact data', () => {
    const html = renderToStaticMarkup(<InviteOnlyMatchShellView match={match} locale="en" labels={{
      state: 'Invitation only',
      when: 'When',
      privacy: 'Details are private.',
    }} />);
    expect(matchRobots(match)).toEqual({ index: false, follow: false });
    expect(html).toContain('Invitation only');
    expect(html).not.toMatch(/participant|phone|token|username|owner/i);
  });
});
