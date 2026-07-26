import { CreateRatingBodySchema, type MatchStatus } from '@futzone/contracts';

export type RatingFlowState = 'rate' | 'closed' | 'hidden';

export function selectRatingFlowState(status: MatchStatus, isParticipant: boolean): RatingFlowState {
  if (!isParticipant) return 'hidden';
  if (status === 'RATING_PENDING') return 'rate';
  if (status === 'COMPLETED') return 'closed';
  return 'hidden';
}

export function ratingFormErrors(input: {
  rateeId: string; discipline: number; punctuality: number; fairPlay: number;
  teamPlay: number; overall: number; comment?: string;
}): string[] {
  const result = CreateRatingBodySchema.safeParse({ ...input, comment: input.comment?.trim() || undefined });
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}
