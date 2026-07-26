import { SetMetadata } from '@nestjs/common';
import type { MatchAction } from './match-permissions.policy';

export const MATCH_ACTION_KEY = 'match-action';
export const RequireMatchAction = (action: MatchAction): MethodDecorator =>
  SetMetadata(MATCH_ACTION_KEY, action);
