import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import RootNotFound from '../src/app/not-found';
import { getMessages } from '../src/i18n/messages';

const navigation = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));

describe('root not-found boundary', () => {
  it.each(['uz', 'uz-Cyrl', 'ru', 'en'] as const)('renders the catalog selected by the %s URL segment', (locale) => {
    navigation.pathname = `/${locale}/players/nobody_here_xyz`;
    const messages = getMessages(locale);
    const markup = renderToStaticMarkup(<RootNotFound />);

    expect(markup).toContain(messages.status.notFoundTitle);
    expect(markup).toContain(messages.status.notFoundDescription);
    expect(markup).toContain(messages.status.backHome);
    expect(markup).toContain(`href="/${locale}"`);
  });

  it.each(['/nothing-at-all', '/de/no-such-route', '/'])('falls back safely for %s outside a supported locale', (pathname) => {
    navigation.pathname = pathname;
    const markup = renderToStaticMarkup(<RootNotFound />);
    const messages = getMessages('uz');

    expect(markup).toContain(messages.status.notFoundTitle);
    expect(markup).toContain('href="/uz"');
  });
});
