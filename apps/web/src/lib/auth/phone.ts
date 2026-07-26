export const UZ_PHONE_PATTERN = /^\+998\d{9}$/;

export function normalizeUzPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  const local = (digits.startsWith('998') ? digits.slice(3) : digits).slice(0, 9);
  return `+998${local}`;
}

export function formatUzPhone(value: string): string {
  const phone = normalizeUzPhone(value);
  const local = phone.slice(4);
  return `+998${local.length ? ` ${local.slice(0, 2)}` : ''}${local.length > 2 ? ` ${local.slice(2, 5)}` : ''}${local.length > 5 ? ` ${local.slice(5, 7)}` : ''}${local.length > 7 ? ` ${local.slice(7, 9)}` : ''}`;
}

export function isValidUzPhone(value: string): boolean {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+') && !trimmed.startsWith('+998')) return false;
  if (digits.startsWith('998') ? digits.length !== 12 : digits.length !== 9) return false;
  return UZ_PHONE_PATTERN.test(normalizeUzPhone(value));
}
