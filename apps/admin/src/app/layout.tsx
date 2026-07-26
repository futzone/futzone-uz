import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import messages from '../i18n/messages/ru';
import './globals.css';

export const metadata: Metadata = {
  title: messages.metadata.title,
  description: messages.metadata.description,
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const requestMessages = await getMessages();

  return (
    <html lang="ru">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider messages={requestMessages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
