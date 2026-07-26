import { z } from 'zod';

type ValueOf<T> = T[keyof T];

export const Position = { GK: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD', UNIVERSAL: 'UNIVERSAL' } as const;
export type Position = ValueOf<typeof Position>;
export const PositionSchema = z.enum(['GK', 'DEF', 'MID', 'FWD', 'UNIVERSAL']);

export const MatchStatus = { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', FULL: 'FULL', STARTED: 'STARTED', FINISHED: 'FINISHED', ATTENDANCE_PENDING: 'ATTENDANCE_PENDING', RATING_PENDING: 'RATING_PENDING', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' } as const;
export type MatchStatus = ValueOf<typeof MatchStatus>;
export const MatchStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'FULL', 'STARTED', 'FINISHED', 'ATTENDANCE_PENDING', 'RATING_PENDING', 'COMPLETED', 'CANCELLED']);

export const JoinMode = { AUTO: 'AUTO', MANUAL: 'MANUAL', INVITE_ONLY: 'INVITE_ONLY' } as const;
export type JoinMode = ValueOf<typeof JoinMode>;
export const JoinModeSchema = z.enum(['AUTO', 'MANUAL', 'INVITE_ONLY']);

export const ParticipantStatus = { PENDING: 'PENDING', PENDING_CONFIRMATION: 'PENDING_CONFIRMATION', CONFIRMED: 'CONFIRMED', DECLINED: 'DECLINED', LEFT: 'LEFT', REMOVED: 'REMOVED', WAITLISTED: 'WAITLISTED' } as const;
export type ParticipantStatus = ValueOf<typeof ParticipantStatus>;
export const ParticipantStatusSchema = z.enum(['PENDING', 'PENDING_CONFIRMATION', 'CONFIRMED', 'DECLINED', 'LEFT', 'REMOVED', 'WAITLISTED']);

export const ParticipantRole = { OWNER: 'OWNER', ASSISTANT: 'ASSISTANT', PLAYER: 'PLAYER' } as const;
export type ParticipantRole = ValueOf<typeof ParticipantRole>;
export const ParticipantRoleSchema = z.enum(['OWNER', 'ASSISTANT', 'PLAYER']);

export const InvitationStatus = { PENDING: 'PENDING', ACCEPTED: 'ACCEPTED', DECLINED: 'DECLINED', EXPIRED: 'EXPIRED' } as const;
export type InvitationStatus = ValueOf<typeof InvitationStatus>;
export const InvitationStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED']);

export const AttendanceStatus = { ON_TIME: 'ON_TIME', LATE: 'LATE', NO_SHOW: 'NO_SHOW', CANCELLED_EARLY: 'CANCELLED_EARLY', EXCUSED: 'EXCUSED', REMOVED_BY_OWNER: 'REMOVED_BY_OWNER' } as const;
export type AttendanceStatus = ValueOf<typeof AttendanceStatus>;
export const AttendanceStatusSchema = z.enum(['ON_TIME', 'LATE', 'NO_SHOW', 'CANCELLED_EARLY', 'EXCUSED', 'REMOVED_BY_OWNER']);
export const DisputeStatus = { OPEN: 'OPEN', UPHELD: 'UPHELD', OVERTURNED: 'OVERTURNED' } as const;
export type DisputeStatus = ValueOf<typeof DisputeStatus>;
export const DisputeStatusSchema = z.enum(['OPEN', 'UPHELD', 'OVERTURNED']);
export const RatingStatus = { ACTIVE: 'ACTIVE', HIDDEN: 'HIDDEN', REMOVED: 'REMOVED' } as const;
export type RatingStatus = ValueOf<typeof RatingStatus>;
export const RatingStatusSchema = z.enum(['ACTIVE', 'HIDDEN', 'REMOVED']);

export const Surface = { NATURAL_GRASS: 'NATURAL_GRASS', ARTIFICIAL_GRASS: 'ARTIFICIAL_GRASS', PARQUET: 'PARQUET', RUBBER: 'RUBBER', CONCRETE: 'CONCRETE' } as const;
export type Surface = ValueOf<typeof Surface>;
export const SurfaceSchema = z.enum(['NATURAL_GRASS', 'ARTIFICIAL_GRASS', 'PARQUET', 'RUBBER', 'CONCRETE']);

export const Level = { BEGINNER: 'BEGINNER', AMATEUR: 'AMATEUR', INTERMEDIATE: 'INTERMEDIATE', ADVANCED: 'ADVANCED', ANY: 'ANY' } as const;
export type Level = ValueOf<typeof Level>;
export const LevelSchema = z.enum(['BEGINNER', 'AMATEUR', 'INTERMEDIATE', 'ADVANCED', 'ANY']);

export const AgeGroup = { YOUTH: 'YOUTH', ADULT: 'ADULT', MIXED: 'MIXED' } as const;
export type AgeGroup = ValueOf<typeof AgeGroup>;
export const AgeGroupSchema = z.enum(['YOUTH', 'ADULT', 'MIXED']);

export const MatchFormat = { F5: 'F5', F6: 'F6', F7: 'F7', F8: 'F8', F9: 'F9', F11: 'F11' } as const;
export type MatchFormat = ValueOf<typeof MatchFormat>;
export const MatchFormatSchema = z.enum(['F5', 'F6', 'F7', 'F8', 'F9', 'F11']);

export const UserRole = { USER: 'USER', MODERATOR: 'MODERATOR', ADMIN: 'ADMIN' } as const;
export type UserRole = ValueOf<typeof UserRole>;
export const UserRoleSchema = z.enum(['USER', 'MODERATOR', 'ADMIN']);

export const UserStatus = { ACTIVE: 'ACTIVE', WARNED: 'WARNED', SUSPENDED: 'SUSPENDED', BANNED: 'BANNED' } as const;
export type UserStatus = ValueOf<typeof UserStatus>;
export const UserStatusSchema = z.enum(['ACTIVE', 'WARNED', 'SUSPENDED', 'BANNED']);

export const StadiumStatus = { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' } as const;
export type StadiumStatus = ValueOf<typeof StadiumStatus>;
export const StadiumStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

export const OtpPurpose = { REGISTER: 'REGISTER', LOGIN: 'LOGIN' } as const;
export type OtpPurpose = ValueOf<typeof OtpPurpose>;
export const OtpPurposeSchema = z.enum(['REGISTER', 'LOGIN']);

export const Locale = { uz: 'uz', 'uz-Cyrl': 'uz-Cyrl', ru: 'ru', en: 'en' } as const;
export type Locale = ValueOf<typeof Locale>;
export const LocaleSchema = z.enum(['uz', 'uz-Cyrl', 'ru', 'en']);

export const NotificationType = {
  JOIN_REQUEST_RECEIVED: 'JOIN_REQUEST_RECEIVED',
  JOIN_APPROVED: 'JOIN_APPROVED',
  JOIN_REJECTED: 'JOIN_REJECTED',
  MATCH_INVITE: 'MATCH_INVITE',
  WAITLIST_PROMOTED: 'WAITLIST_PROMOTED',
  MATCH_UPDATED: 'MATCH_UPDATED',
  MATCH_CANCELLED: 'MATCH_CANCELLED',
  MATCH_REMINDER_24H: 'MATCH_REMINDER_24H',
  MATCH_REMINDER_2H: 'MATCH_REMINDER_2H',
  ATTENDANCE_MARKED: 'ATTENDANCE_MARKED',
  ATTENDANCE_DISPUTE_RESOLVED: 'ATTENDANCE_DISPUTE_RESOLVED',
  RATING_WINDOW_OPEN: 'RATING_WINDOW_OPEN',
  NEW_RATING_RECEIVED: 'NEW_RATING_RECEIVED',
  REPORT_RESOLVED: 'REPORT_RESOLVED',
  ACCOUNT_WARNING: 'ACCOUNT_WARNING',
} as const;
export type NotificationType = ValueOf<typeof NotificationType>;
export const NotificationTypeSchema = z.enum([
  'JOIN_REQUEST_RECEIVED', 'JOIN_APPROVED', 'JOIN_REJECTED', 'MATCH_INVITE', 'WAITLIST_PROMOTED',
  'MATCH_UPDATED', 'MATCH_CANCELLED', 'MATCH_REMINDER_24H', 'MATCH_REMINDER_2H', 'ATTENDANCE_MARKED',
  'ATTENDANCE_DISPUTE_RESOLVED', 'RATING_WINDOW_OPEN', 'NEW_RATING_RECEIVED', 'REPORT_RESOLVED', 'ACCOUNT_WARNING',
]);
