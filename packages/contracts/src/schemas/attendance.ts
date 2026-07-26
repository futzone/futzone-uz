import { z } from 'zod';
import { AttendanceStatusSchema, DisputeStatusSchema } from '../enums.js';
export const MarkAttendanceBodySchema = z.object({
  status: AttendanceStatusSchema.refine((status) => status !== 'CANCELLED_EARLY', { message: 'CANCELLED_EARLY is assigned automatically' }),
  guestNoShowCount: z.number().int().nonnegative().optional(),
}).strict();
export const DisputeAttendanceBodySchema = z.object({ note: z.string().trim().min(1).max(1000) }).strict();
export const ResolveAttendanceBodySchema = z.object({ status: AttendanceStatusSchema }).strict();
export const AttendanceRecordSchema = z.object({
  id: z.string().uuid(), matchId: z.string().uuid(), participantId: z.string().uuid(),
  status: AttendanceStatusSchema, guestNoShowCount: z.number().int().nonnegative(),
  markedById: z.string().uuid(), markedAt: z.string().datetime(),
  disputeStatus: DisputeStatusSchema.nullable(), disputeNote: z.string().nullable(),
  disputeResolvedById: z.string().uuid().nullable(), finalizedAt: z.string().datetime().nullable(),
});
export const AttendanceSheetEntrySchema = z.object({
  participantId: z.string().uuid(), userId: z.string().uuid(), firstName: z.string(), lastName: z.string(),
  username: z.string(), role: z.enum(['OWNER', 'ASSISTANT', 'PLAYER']), guestCount: z.number().int().nonnegative(),
  record: AttendanceRecordSchema.nullable(),
});
export const AttendanceSheetSchema = z.array(AttendanceSheetEntrySchema);
export type MarkAttendanceBody = z.infer<typeof MarkAttendanceBodySchema>;
export type DisputeAttendanceBody = z.infer<typeof DisputeAttendanceBodySchema>;
export type ResolveAttendanceBody = z.infer<typeof ResolveAttendanceBodySchema>;
export type AttendanceRecord = z.infer<typeof AttendanceRecordSchema>;
export type AttendanceSheetEntry = z.infer<typeof AttendanceSheetEntrySchema>;
