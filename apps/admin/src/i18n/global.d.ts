import messages from './messages/ru';

declare module 'next-intl' {
  interface AppConfig {
    Locale: 'ru';
    Messages: typeof messages;
  }
}
