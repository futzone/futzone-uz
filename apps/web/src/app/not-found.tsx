'use client';

import { defaultLocale, locales, type Locale } from '@futzone/i18n';
import en from '@futzone/i18n/messages/en';
import ru from '@futzone/i18n/messages/ru';
import uzCyrl from '@futzone/i18n/messages/uz-Cyrl';
import uz from '@futzone/i18n/messages/uz';
import { Button } from '@futzone/ui';
import { usePathname } from 'next/navigation';
import React from 'react';

const messagesByLocale = { uz, 'uz-Cyrl': uzCyrl, ru, en } satisfies Record<Locale, typeof en>;

function localeFromPathname(pathname: string): Locale {
  const firstSegment = pathname.split('/')[1];
  return locales.find((locale) => locale === firstSegment) ?? defaultLocale;
}

export default function NotFound() {
  const locale = localeFromPathname(usePathname());
  const status = messagesByLocale[locale].status;

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-3xl font-bold">{status.notFoundTitle}</h1>
      <p className="mt-4 text-muted-foreground">{status.notFoundDescription}</p>
      <Button asChild className="mt-6">
        <a href={`/${locale}`}>{status.backHome}</a>
      </Button>
    </div>
  );
}
