import { ERROR_CODES, type ErrorCode } from '@futzone/contracts';

export type ErrorTranslator = (key: `errors.${ErrorCode}`) => string;

const errorMessageKeys = Object.fromEntries(
  Object.values(ERROR_CODES).map((code) => [code, `errors.${code}`]),
) as { [Code in ErrorCode]: `errors.${Code}` };

export function mapErrorCodeToMessage(code: ErrorCode, t: ErrorTranslator): string {
  return t(errorMessageKeys[code]);
}

export { errorMessageKeys };
