import type { NotificationType } from '@futzone/contracts';

// A minimal translator surface (satisfied by next-intl's useTranslations('notifications')).
export type NotificationTranslator = (key: string) => string;

// Renders a notification's display text from its type at render time — never stored pre-rendered,
// so switching locale re-localizes every past notification for free (P5-02).
export function notificationMessage(type: NotificationType, t: NotificationTranslator): string {
  return t(`types.${type}`);
}
