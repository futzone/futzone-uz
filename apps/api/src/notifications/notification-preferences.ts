import type { NotificationType } from '@futzone/contracts';

// In-app delivery is always on; push is opt-out per type. A missing or malformed entry means push
// is enabled — users only ever store an explicit `{ push: false }` to silence a type.
export function isPushEnabled(perTypeChannelFlags: unknown, type: NotificationType): boolean {
  if (perTypeChannelFlags === null || typeof perTypeChannelFlags !== 'object') return true;
  const entry = (perTypeChannelFlags as Record<string, unknown>)[type];
  if (entry === null || typeof entry !== 'object') return true;
  return (entry as Record<string, unknown>).push !== false;
}
