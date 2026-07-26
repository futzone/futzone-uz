import {
  MATCH_ACTIONS,
  assistantMayEditFields,
  mayPerformMatchAction,
  type MatchAction,
} from './match-permissions.policy';

describe('assistant match permission matrix', () => {
  const allowed: MatchAction[] = [
    MATCH_ACTIONS.EDIT,
    MATCH_ACTIONS.PUBLISH,
    MATCH_ACTIONS.REMOVE_PARTICIPANT,
    MATCH_ACTIONS.DECIDE_REQUEST,
    MATCH_ACTIONS.VIEW_REQUESTS,
    MATCH_ACTIONS.INVITE,
    MATCH_ACTIONS.RATE_PARTICIPANT,
  ];
  const forbidden: MatchAction[] = [MATCH_ACTIONS.CANCEL, MATCH_ACTIONS.ASSIGN_ASSISTANT];

  it.each(allowed)('allows assistants to %s', (action) => {
    expect(mayPerformMatchAction('ASSISTANT', action)).toBe(true);
  });

  it.each(forbidden)('forbids assistants to %s', (action) => {
    expect(mayPerformMatchAction('ASSISTANT', action)).toBe(false);
  });

  it('forbids assistant price edits but allows other fields', () => {
    expect(assistantMayEditFields(['title', 'startsAt'])).toBe(true);
    expect(assistantMayEditFields(['fieldPriceUzs'])).toBe(false);
    expect(assistantMayEditFields(['perPlayerFeeUzs'])).toBe(false);
  });

  it('allows owners every action and players only participant rating', () => {
    for (const action of Object.values(MATCH_ACTIONS)) {
      expect(mayPerformMatchAction('OWNER', action)).toBe(true);
      expect(mayPerformMatchAction('PLAYER', action)).toBe(action === MATCH_ACTIONS.RATE_PARTICIPANT);
    }
  });
});
