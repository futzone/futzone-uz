import { Controller, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConflictResponse, ApiForbiddenResponse, ApiGoneResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DisputeAttendanceBodySchema,
  MarkAttendanceBodySchema,
  ResolveAttendanceBodySchema,
  type AttendanceRecord,
  type AttendanceSheetEntry,
  type DisputeAttendanceBody,
  type MarkAttendanceBody,
  type ResolveAttendanceBody,
} from '@futzone/contracts';
import { AuthGuard } from '../auth/auth.guard';
import type { CurrentUser } from '../auth/auth.types';
import { CurrentUserParam } from '../auth/current-user.decorator';
import { ZodBody } from '../common/validation/zod-body.decorator';
import { MatchActionGuard } from '../matches/match-action.guard';
import { RequireMatchAction } from '../matches/match-action.decorator';
import { MATCH_ACTIONS } from '../matches/match-permissions.policy';
import { AttendanceService } from './attendance.service';
import { AttendanceResolveGuard } from './attendance-resolve.guard';

@ApiTags('attendance')
@Controller()
export class AttendanceController {
  public constructor(private readonly attendance: AttendanceService) {}

  @Get('matches/:id/attendance')
  @UseGuards(AuthGuard, MatchActionGuard)
  @RequireMatchAction(MATCH_ACTIONS.MARK_ATTENDANCE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the owner/assistant attendance marking sheet' })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AttendanceSheet' } })
  public sheet(@Param('id') matchId: string): Promise<AttendanceSheetEntry[]> {
    return this.attendance.sheet(matchId);
  }

  @Put('matches/:id/attendance/:participantId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, MatchActionGuard)
  @RequireMatchAction(MATCH_ACTIONS.MARK_ATTENDANCE)
  @ApiBearerAuth()
  @ApiBody({ schema: { $ref: '#/components/schemas/MarkAttendanceBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AttendanceRecord' } })
  @ApiConflictResponse({ description: 'Attendance window is closed' })
  public mark(
    @CurrentUserParam() user: CurrentUser,
    @Param('id') matchId: string,
    @Param('participantId') participantId: string,
    @ZodBody(MarkAttendanceBodySchema) body: MarkAttendanceBody,
  ): Promise<AttendanceRecord> {
    return this.attendance.mark(matchId, participantId, user.id, body);
  }

  @Post('attendance/:recordId/dispute')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiBody({ schema: { $ref: '#/components/schemas/DisputeAttendanceBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AttendanceRecord' } })
  @ApiForbiddenResponse({ description: 'Caller is not the affected participant' })
  @ApiGoneResponse({ description: '72-hour dispute window is closed' })
  public dispute(
    @CurrentUserParam() user: CurrentUser,
    @Param('recordId') recordId: string,
    @ZodBody(DisputeAttendanceBodySchema) body: DisputeAttendanceBody,
  ): Promise<AttendanceRecord> {
    return this.attendance.dispute(recordId, user.id, body.note);
  }

  @Post('attendance/:recordId/resolve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AttendanceResolveGuard)
  @ApiBearerAuth()
  @ApiBody({ schema: { $ref: '#/components/schemas/ResolveAttendanceBody' } })
  @ApiOkResponse({ schema: { $ref: '#/components/schemas/AttendanceRecord' } })
  @ApiForbiddenResponse({ description: 'Caller cannot resolve this attendance record' })
  public resolve(
    @CurrentUserParam() user: CurrentUser,
    @Param('recordId') recordId: string,
    @ZodBody(ResolveAttendanceBodySchema) body: ResolveAttendanceBody,
  ): Promise<AttendanceRecord> {
    return this.attendance.resolve(recordId, user, body);
  }
}
