import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { SwaggerModule, DocumentBuilder, type OpenAPIObject } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import { z } from 'zod';
import {
  AuthUserSchema,
  AvatarCompleteBodySchema,
  AvatarCompleteResponseSchema,
  AvatarPresignBodySchema,
  AvatarPresignResponseSchema,
  CitiesResponseSchema,
  LogoutResponseSchema,
  MeProfileSchema,
  MeSettingsSchema,
  OtpRequestBodySchema,
  OtpRequestResponseSchema,
  OtpVerifyBodySchema,
  PublicProfileSchema,
  RegisterBodySchema,
  TokenResponseSchema,
  UpdateMeBodySchema,
  UpdateUsernameBodySchema,
  UsernameAvailableResponseSchema,
  VerifyResponseSchema,
} from '@futzone/contracts';
import {
  CancelMatchBodySchema,
  CreateMatchBodySchema,
  AssignAssistantBodySchema,
  InvitationSchema,
  InviteByUsernameBodySchema,
  CreateStadiumBodySchema,
  JoinMatchBodySchema,
  JoinWaitlistBodySchema,
  JoinMatchResponseSchema,
  JoinRequestSchema,
  JoinRequestsResponseSchema,
  MatchParticipantSchema,
  MatchDetailSchema,
  MatchSchema,
  MatchesResponseSchema,
  StadiumModerationBodySchema,
  StadiumSchema,
  StadiumsResponseSchema,
  ShareInvitationSchema,
  UpdateMatchBodySchema,
  UpdateMyParticipationBodySchema,
  MarkAttendanceBodySchema, DisputeAttendanceBodySchema, ResolveAttendanceBodySchema,
  AttendanceRecordSchema, AttendanceSheetSchema,
  CreateRatingBodySchema, RatingSchema, RatablePlayersSchema, ReportRatingBodySchema, RatingReportSchema,
  SeoManifestSchema,
  FavoritesResponseSchema,
  FavoriteMutationResponseSchema,
  NotificationSchema,
  NotificationPreferenceSchema,
  NotificationListResponseSchema,
  UnreadCountResponseSchema,
  UpdateNotificationPreferenceBodySchema,
  PushSubscriptionBodySchema,
  PushSubscriptionMutationResponseSchema,
  VapidPublicKeyResponseSchema,
  AdminDashboardResponseSchema,
  AdminUserListResponseSchema,
  AdminUserDetailSchema,
  AdminUserActionResponseSchema,
  AdminWarnBodySchema,
  AdminSuspendBodySchema,
  AdminReasonBodySchema,
  AdminAuditListResponseSchema,
  AdminMatchListResponseSchema,
  AdminMatchDetailSchema,
  AdminMatchActionResponseSchema,
  AdminFlagBodySchema,
  AdminModerationQueueSchema,
  AdminModerationActionResponseSchema,
} from '@futzone/contracts';

extendZodWithOpenApi(z);

export function setupSwagger(app: INestApplication): void {
  const registry = new OpenAPIRegistry();
  registry.register('OtpRequestBody', OtpRequestBodySchema);
  registry.register('OtpRequestResponse', OtpRequestResponseSchema);
  registry.register('OtpVerifyBody', OtpVerifyBodySchema);
  registry.register('RegisterBody', RegisterBodySchema);
  registry.register('AuthUser', AuthUserSchema);
  registry.register('TokenResponse', TokenResponseSchema);
  registry.register('VerifyResponse', VerifyResponseSchema);
  registry.register('UsernameAvailableResponse', UsernameAvailableResponseSchema);
  registry.register('LogoutResponse', LogoutResponseSchema);
  registry.register('PublicProfile', PublicProfileSchema);
  registry.register('UpdateMeBody', UpdateMeBodySchema);
  registry.register('UpdateUsernameBody', UpdateUsernameBodySchema);
  registry.register('MeProfile', MeProfileSchema);
  registry.register('MeSettings', MeSettingsSchema);
  registry.register('CitiesResponse', CitiesResponseSchema);
  registry.register('AvatarPresignBody', AvatarPresignBodySchema);
  registry.register('AvatarPresignResponse', AvatarPresignResponseSchema);
  registry.register('AvatarCompleteBody', AvatarCompleteBodySchema);
  registry.register('AvatarCompleteResponse', AvatarCompleteResponseSchema);
  registry.register('CreateStadiumBody', CreateStadiumBodySchema);
  registry.register('StadiumModerationBody', StadiumModerationBodySchema);
  registry.register('Stadium', StadiumSchema);
  registry.register('StadiumsResponse', StadiumsResponseSchema);
  registry.register('CreateMatchBody', CreateMatchBodySchema);
  registry.register('UpdateMatchBody', UpdateMatchBodySchema);
  registry.register('CancelMatchBody', CancelMatchBodySchema);
  registry.register('Match', MatchSchema);
  registry.register('MatchDetail', MatchDetailSchema);
  registry.register('MatchesResponse', MatchesResponseSchema);
  registry.register('JoinMatchBody', JoinMatchBodySchema);
  registry.register('JoinWaitlistBody', JoinWaitlistBodySchema);
  registry.register('UpdateMyParticipationBody', UpdateMyParticipationBodySchema);
  registry.register('MatchParticipant', MatchParticipantSchema);
  registry.register('JoinRequest', JoinRequestSchema);
  registry.register('JoinMatchResponse', JoinMatchResponseSchema);
  registry.register('InviteByUsernameBody', InviteByUsernameBodySchema);
  registry.register('AssignAssistantBody', AssignAssistantBodySchema);
  registry.register('Invitation', InvitationSchema);
  registry.register('ShareInvitation', ShareInvitationSchema);
  registry.register('JoinRequestsResponse', JoinRequestsResponseSchema);
  registry.register('MarkAttendanceBody', MarkAttendanceBodySchema);
  registry.register('DisputeAttendanceBody', DisputeAttendanceBodySchema);
  registry.register('ResolveAttendanceBody', ResolveAttendanceBodySchema);
  registry.register('AttendanceRecord', AttendanceRecordSchema);
  registry.register('AttendanceSheet', AttendanceSheetSchema);
  registry.register('CreateRatingBody', CreateRatingBodySchema);
  registry.register('Rating', RatingSchema);
  registry.register('RatablePlayers', RatablePlayersSchema);
  registry.register('ReportRatingBody', ReportRatingBodySchema);
  registry.register('RatingReport', RatingReportSchema);
  registry.register('SeoManifest', SeoManifestSchema);
  registry.register('FavoritesResponse', FavoritesResponseSchema);
  registry.register('FavoriteMutationResponse', FavoriteMutationResponseSchema);
  registry.register('Notification', NotificationSchema);
  registry.register('NotificationPreference', NotificationPreferenceSchema);
  registry.register('NotificationListResponse', NotificationListResponseSchema);
  registry.register('UnreadCountResponse', UnreadCountResponseSchema);
  registry.register('UpdateNotificationPreferenceBody', UpdateNotificationPreferenceBodySchema);
  registry.register('PushSubscriptionBody', PushSubscriptionBodySchema);
  registry.register('PushSubscriptionMutationResponse', PushSubscriptionMutationResponseSchema);
  registry.register('VapidPublicKeyResponse', VapidPublicKeyResponseSchema);
  registry.register('AdminDashboardResponse', AdminDashboardResponseSchema);
  registry.register('AdminUserListResponse', AdminUserListResponseSchema);
  registry.register('AdminUserDetail', AdminUserDetailSchema);
  registry.register('AdminUserActionResponse', AdminUserActionResponseSchema);
  registry.register('AdminWarnBody', AdminWarnBodySchema);
  registry.register('AdminSuspendBody', AdminSuspendBodySchema);
  registry.register('AdminReasonBody', AdminReasonBodySchema);
  registry.register('AdminAuditListResponse', AdminAuditListResponseSchema);
  registry.register('AdminMatchListResponse', AdminMatchListResponseSchema);
  registry.register('AdminMatchDetail', AdminMatchDetailSchema);
  registry.register('AdminMatchActionResponse', AdminMatchActionResponseSchema);
  registry.register('AdminFlagBody', AdminFlagBodySchema);
  registry.register('AdminModerationQueue', AdminModerationQueueSchema);
  registry.register('AdminModerationActionResponse', AdminModerationActionResponseSchema);
  const generated = new OpenApiGeneratorV3(registry.definitions).generateComponents();
  const document: OpenAPIObject = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Futzone API').setVersion('0.0.0').build(),
  );
  const generatedSchemas = generated.components?.schemas as unknown as NonNullable<
    OpenAPIObject['components']
  >['schemas'];
  const components = document.components ?? {};
  components.schemas = { ...components.schemas, ...generatedSchemas };
  document.components = components;
  SwaggerModule.setup('docs', app, document);
}
