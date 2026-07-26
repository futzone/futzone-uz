import { getRequestConfig } from 'next-intl/server';
import messages from './messages/ru';

export default getRequestConfig(() => ({ locale: 'ru', messages }));
