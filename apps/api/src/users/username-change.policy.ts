import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';

export const USERNAME_CHANGE_INTERVAL_MS = 30 * 24 * 60 * 60 * 1_000;

@Injectable()
export class UsernameChangePolicy {
  public assertAllowed(usernameChangedAt: Date | null, now: Date): void {
    if (!usernameChangedAt) return;
    const nextAllowedAt = new Date(usernameChangedAt.getTime() + USERNAME_CHANGE_INTERVAL_MS);
    if (now.getTime() < nextAllowedAt.getTime()) {
      throw new AppException('USERNAME_CHANGE_TOO_SOON', 'Username can only be changed once every 30 days', HttpStatus.TOO_MANY_REQUESTS, { nextAllowedAt: nextAllowedAt.toISOString() });
    }
  }
}
