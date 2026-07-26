import {
  ApiErrorSchema,
  type AuthUser, type ErrorCode,
  type AvatarPresignResponse,
  type City,
  type MeProfile,
  type MeSettings,
  type OtpPurpose,
  type PublicProfile,
  type CreateMatchBody, type Match, type MatchDetail, type MatchParticipant,
  type MatchesResponse,
  type Stadium, type JoinMatchResponse, type JoinRequestWithSummary,
  type UpdateMeBody, type UpdateMatchBody,
  type AttendanceRecord, type AttendanceSheetEntry, type CreateRatingBody, type MarkAttendanceBody,
  type RatablePlayer, type Rating, type RatingReport,
  type SeoManifest,
  type FavoritesResponse, type FavoriteMutationResponse,
  type NotificationListResponse, type UnreadCountResponse,
  type NotificationPreference, type UpdateNotificationPreferenceBody,
  type PushSubscriptionBody, type PushSubscriptionMutationResponse, type VapidPublicKeyResponse,
} from '@futzone/contracts';

export class ApiClientError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly requestId?: string;
  public readonly status?: number;

  public constructor(error: { code: ErrorCode; message: string; details?: unknown; requestId?: string; status?: number }, options?: ErrorOptions) {
    super(error.message, options);
    this.name = 'ApiClientError';
    this.code = error.code;
    this.details = error.details;
    this.requestId = error.requestId;
    this.status = error.status;
  }
}

export interface HealthResponse { status: string; info?: Record<string, unknown>; error?: Record<string, unknown>; details?: Record<string, unknown> }
type SessionResponse = { accessToken: string; user: AuthUser };
export type VerifyResponse = ({ needsRegistration: false } & SessionResponse) | { needsRegistration: true; registrationToken: string };

export class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  public constructor(private readonly baseUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL, private readonly fetcher: typeof fetch = fetch) {}

  private async raw<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.baseUrl) throw new Error('NEXT_PUBLIC_API_URL is required');
    const response = await this.fetcher(new URL(path, this.baseUrl), { credentials: 'include', ...init });
    const body: unknown = response.status === 204 ? undefined : await response.json();
    if (!response.ok) {
      const parsed = ApiErrorSchema.safeParse(body);
      if (parsed.success) throw new ApiClientError({ ...parsed.data, status: response.status });
      throw new Error(`API request failed with status ${response.status}`);
    }
    return body as T;
  }

  private async refresh(): Promise<boolean> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.raw<SessionResponse>('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(({ accessToken }) => { this.accessToken = accessToken; return true; })
        .catch(() => { this.accessToken = null; return false; })
        .finally(() => { this.refreshPromise = null; });
    }
    return this.refreshPromise;
  }

  private async protected<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.accessToken && !(await this.refresh())) throw new ApiClientError({ code: 'UNAUTHORIZED', message: 'Unauthorized' });
    const invoke = () => this.raw<T>(path, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${this.accessToken}` } });
    try { return await invoke(); } catch (error) {
      if (!(error instanceof ApiClientError) || error.code !== 'UNAUTHORIZED' || !(await this.refresh())) throw error;
      return invoke();
    }
  }

  private json<T>(path: string, body: unknown, authenticated = false): Promise<T> {
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    return authenticated ? this.protected<T>(path, init) : this.raw<T>(path, init);
  }

  public setAccessToken(token: string) { this.accessToken = token; }
  public getHealth() { return this.raw<HealthResponse>('/health'); }
  public requestOtp(phone: string, purpose: OtpPurpose) { return this.json<{ accepted: true }>('/api/auth/otp', { phone, purpose }); }
  public verifyOtp(phone: string, code: string) { return this.json<VerifyResponse>('/api/auth/verify', { phone, code }); }
  public register(body: { registrationToken: string; firstName: string; lastName: string; username: string }) { return this.json<SessionResponse>('/api/auth/register', body); }
  public usernameAvailable(username: string) { return this.raw<{ available: boolean; suggestions: string[] }>(`/api/auth/username-available?username=${encodeURIComponent(username)}`); }
  public cities(locale: string) { return this.raw<City[]>(`/api/cities?locale=${encodeURIComponent(locale)}`); }
  public me() { return this.protected<AuthUser>('/api/auth/me'); }
  public settings() { return this.protected<MeSettings>('/api/me/settings'); }
  public updateMe(body: UpdateMeBody) { return this.protected<MeProfile>('/api/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  public updateUsername(username: string) { return this.protected<MeProfile>('/api/me/username', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) }); }
  public presignAvatar(size: number) { return this.json<AvatarPresignResponse>('/api/me/avatar', { size }, true); }
  public completeAvatar(objectKey: string) { return this.json<{ accepted: true }>('/api/me/avatar/complete', { objectKey }, true); }
  public async logout() { const result = await this.json<{ loggedOut: true }>('/api/auth/logout', {}, true); this.accessToken = null; return result; }
  public publicProfile(username: string, locale: string, commentsPage = 1, init?: RequestInit) { return this.raw<PublicProfile>(`/api/users/${encodeURIComponent(username)}?locale=${encodeURIComponent(locale)}&commentsPage=${commentsPage}`, init); }
  public stadiums(city?: string, init?: RequestInit) { return this.raw<Stadium[]>(`/api/stadiums${city ? `?city=${encodeURIComponent(city)}` : ''}`, init); }
  public stadium(slug: string, init?: RequestInit) { return this.raw<Stadium>(`/api/stadiums/${encodeURIComponent(slug)}`, init); }
  public matches(query?: string, init?: RequestInit, authenticated = false) {
    const path = `/api/matches${query ? `?${query}` : ''}`;
    return authenticated ? this.protected<MatchesResponse>(path, init) : this.raw<MatchesResponse>(path, init);
  }
  public favorites() { return this.protected<FavoritesResponse>('/api/me/favorites'); }
  public addFavoriteStadium(stadiumId: string) { return this.protected<FavoriteMutationResponse>(`/api/me/favorites/stadiums/${encodeURIComponent(stadiumId)}`, { method: 'PUT' }); }
  public removeFavoriteStadium(stadiumId: string) { return this.protected<FavoriteMutationResponse>(`/api/me/favorites/stadiums/${encodeURIComponent(stadiumId)}`, { method: 'DELETE' }); }
  public addFavoriteOrganizer(organizerId: string) { return this.protected<FavoriteMutationResponse>(`/api/me/favorites/organizers/${encodeURIComponent(organizerId)}`, { method: 'PUT' }); }
  public removeFavoriteOrganizer(organizerId: string) { return this.protected<FavoriteMutationResponse>(`/api/me/favorites/organizers/${encodeURIComponent(organizerId)}`, { method: 'DELETE' }); }
  public match(slug: string, locale: string, init?: RequestInit) { return this.raw<MatchDetail>(`/api/matches/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`, init); }
  public seoManifest(init?: RequestInit) { return this.raw<SeoManifest>('/api/seo/sitemap', init); }
  public createMatch(body: CreateMatchBody) { return this.json<Match>('/api/matches', body, true); }
  public publishMatch(id: string) { return this.json<Match>(`/api/matches/${id}/publish`, {}, true); }
  public updateMatch(id: string, body: UpdateMatchBody) { return this.protected<Match>(`/api/matches/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  public joinMatch(id: string, guestCount = 0) { return this.json<JoinMatchResponse>(`/api/matches/${id}/join`, { guestCount }, true); }
  public joinWaitlist(id: string, guestCount = 0) { return this.json<MatchParticipant>(`/api/matches/${id}/waitlist`, { guestCount }, true); }
  public confirmPromotion(id: string) { return this.json<MatchParticipant>(`/api/matches/${id}/waitlist/confirm`, {}, true); }
  public leaveMatch(id: string) { return this.json<MatchParticipant>(`/api/matches/${id}/leave`, {}, true); }
  public leaveWaitlist(id: string) { return this.json<MatchParticipant>(`/api/matches/${id}/waitlist/leave`, {}, true); }
  public cancelMatch(id: string, reason: string) { return this.json<Match>(`/api/matches/${id}/cancel`, { reason }, true); }
  public requests(id: string) { return this.protected<JoinRequestWithSummary[]>(`/api/matches/${id}/requests`); }
  public decideRequest(id: string, requestId: string, decision: 'approve'|'reject') { return this.json(`/api/matches/${id}/requests/${requestId}/${decision}`, {}, true); }
  public removeParticipant(id: string, userId: string) { return this.json(`/api/matches/${id}/participants/${userId}/remove`, {}, true); }
  public inviteUser(id: string, username: string) { return this.json(`/api/matches/${id}/invitations`, { username }, true); }
  public attendance(id: string) { return this.protected<AttendanceSheetEntry[]>(`/api/matches/${id}/attendance`); }
  public markAttendance(id: string, participantId: string, body: MarkAttendanceBody) {
    return this.protected<AttendanceRecord>(`/api/matches/${id}/attendance/${participantId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  public ratable(id: string) { return this.protected<RatablePlayer[]>(`/api/matches/${id}/ratable`); }
  public createRating(id: string, body: CreateRatingBody) { return this.json<Rating>(`/api/matches/${id}/ratings`, body, true); }
  public deleteRating(matchId: string, ratingId: string) { return this.protected<void>(`/api/matches/${matchId}/ratings/${ratingId}`, { method: 'DELETE' }); }
  public disputeAttendance(recordId: string, note: string) { return this.json<AttendanceRecord>(`/api/attendance/${recordId}/dispute`, { note }, true); }
  public reportRating(ratingId: string, reason: string) { return this.json<RatingReport>(`/api/ratings/${ratingId}/report`, { reason }, true); }
  public notifications(cursor?: string, limit?: number) {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', String(limit));
    const query = params.toString();
    return this.protected<NotificationListResponse>(`/api/me/notifications${query ? `?${query}` : ''}`);
  }
  public unreadNotificationCount() { return this.protected<UnreadCountResponse>('/api/me/notifications/unread-count'); }
  public markNotificationRead(id: string) { return this.json<UnreadCountResponse>(`/api/me/notifications/${encodeURIComponent(id)}/read`, {}, true); }
  public markAllNotificationsRead() { return this.json<UnreadCountResponse>('/api/me/notifications/read-all', {}, true); }
  // Returns a currently-valid access token (refreshing first if needed), for the SSE stream URL —
  // EventSource cannot send an Authorization header, so the token travels in the query string.
  public async ensureAccessToken(): Promise<string | null> {
    if (!this.accessToken) await this.refresh();
    return this.accessToken;
  }
  public notificationStreamUrl(token: string): string {
    return new URL(`/api/me/notifications/stream?token=${encodeURIComponent(token)}`, this.baseUrl).toString();
  }
  public notificationPreferences() { return this.protected<NotificationPreference>('/api/me/notifications/preferences'); }
  public updateNotificationPreferences(body: UpdateNotificationPreferenceBody) {
    return this.protected<NotificationPreference>('/api/me/notifications/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  public vapidPublicKey() { return this.raw<VapidPublicKeyResponse>('/api/push/vapid-public-key'); }
  public subscribePush(body: PushSubscriptionBody) { return this.json<PushSubscriptionMutationResponse>('/api/me/push/subscriptions', body, true); }
  public unsubscribePush(endpoint: string) { return this.protected<PushSubscriptionMutationResponse>('/api/me/push/subscriptions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint }) }); }
}

export const apiClient = new ApiClient();
