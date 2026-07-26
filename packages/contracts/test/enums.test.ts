import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import * as enums from '../src/enums.js';
import { ERROR_CODES } from '../src/errors.js';

const enumPairs: ReadonlyArray<readonly [Readonly<Record<string, string>>, ZodType]> = [
  [enums.Position, enums.PositionSchema], [enums.MatchStatus, enums.MatchStatusSchema],
  [enums.JoinMode, enums.JoinModeSchema], [enums.ParticipantStatus, enums.ParticipantStatusSchema],
  [enums.ParticipantRole, enums.ParticipantRoleSchema], [enums.AttendanceStatus, enums.AttendanceStatusSchema],
  [enums.Surface, enums.SurfaceSchema], [enums.Level, enums.LevelSchema], [enums.AgeGroup, enums.AgeGroupSchema],
  [enums.MatchFormat, enums.MatchFormatSchema], [enums.UserRole, enums.UserRoleSchema],
  [enums.UserStatus, enums.UserStatusSchema], [enums.StadiumStatus, enums.StadiumStatusSchema],
  [enums.OtpPurpose, enums.OtpPurposeSchema], [enums.Locale, enums.LocaleSchema],
];

describe('shared enums', () => {
  it.each(enumPairs)('accepts every own value and rejects unknown values', (definition, schema) => {
    for (const value of Object.values(definition)) expect(schema.safeParse(value).success).toBe(true);
    expect(schema.safeParse('__UNKNOWN__').success).toBe(false);
  });
});

describe('error codes', () => {
  it('uses identical keys and values', () => {
    expect(Object.keys(ERROR_CODES)).toEqual(Object.values(ERROR_CODES));
  });
});
