export const MATCH_ACTIONS = {
  EDIT: 'EDIT',
  PUBLISH: 'PUBLISH',
  CANCEL: 'CANCEL',
  REMOVE_PARTICIPANT: 'REMOVE_PARTICIPANT',
  DECIDE_REQUEST: 'DECIDE_REQUEST',
  VIEW_REQUESTS: 'VIEW_REQUESTS',
  INVITE: 'INVITE',
  ASSIGN_ASSISTANT: 'ASSIGN_ASSISTANT',
  MARK_ATTENDANCE: 'MARK_ATTENDANCE',
  RESOLVE_ATTENDANCE: 'RESOLVE_ATTENDANCE',
  RATE_PARTICIPANT: 'RATE_PARTICIPANT',
} as const;

export type MatchAction = (typeof MATCH_ACTIONS)[keyof typeof MATCH_ACTIONS];
export type MatchActorRole = 'OWNER' | 'ASSISTANT' | 'PLAYER' | null;

const MATRIX: Readonly<Record<MatchActorRole extends null ? never : Exclude<MatchActorRole, null>, ReadonlySet<MatchAction>>> = {
  OWNER: new Set(Object.values(MATCH_ACTIONS)),
  ASSISTANT: new Set([
    MATCH_ACTIONS.EDIT,
    MATCH_ACTIONS.PUBLISH,
    MATCH_ACTIONS.REMOVE_PARTICIPANT,
    MATCH_ACTIONS.DECIDE_REQUEST,
    MATCH_ACTIONS.VIEW_REQUESTS,
    MATCH_ACTIONS.INVITE,
    MATCH_ACTIONS.MARK_ATTENDANCE,
    MATCH_ACTIONS.RESOLVE_ATTENDANCE,
    MATCH_ACTIONS.RATE_PARTICIPANT,
  ]),
  PLAYER: new Set([MATCH_ACTIONS.RATE_PARTICIPANT]),
};

export function mayPerformMatchAction(role: MatchActorRole, action: MatchAction): boolean {
  return role !== null && MATRIX[role].has(action);
}

export function assistantMayEditFields(fields: readonly string[]): boolean {
  return !fields.some((field) => field === 'fieldPriceUzs' || field === 'perPlayerFeeUzs');
}
