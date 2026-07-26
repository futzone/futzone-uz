import {
  ApiErrorSchema,
  type ApiError, type AuthUser, type ErrorCode,
  type AdminDashboardResponse, type AdminUserActionResponse, type AdminUserDetail, type AdminUserListResponse,
  type AdminReasonBody, type AdminSuspendBody, type AdminWarnBody,
  type AdminAuditListResponse,
  type AdminMatchListResponse, type AdminMatchDetail, type AdminMatchActionResponse, type AdminFlagBody, type UpdateMatchBody,
  type AdminModerationQueue, type AdminModerationActionResponse,
  type AdminReportActionBody, type AdminDisputeResolveBody, type AdminStadiumDecisionBody,
} from '@futzone/contracts';

export class ApiClientError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly requestId?: string;
  public readonly status?: number;

  public constructor(error: ApiError & { status?: number }, options?: ErrorOptions) {
    super(error.message, options);
    this.name = 'ApiClientError';
    this.code = error.code;
    this.details = error.details;
    this.requestId = error.requestId;
    this.status = error.status;
  }
}

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
    const invoke = (): Promise<T> => this.raw<T>(path, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${this.accessToken}` } });
    try { return await invoke(); } catch (error) {
      if (!(error instanceof ApiClientError) || error.code !== 'UNAUTHORIZED' || !(await this.refresh())) throw error;
      return invoke();
    }
  }

  private json<T>(path: string, body: unknown, authenticated = false): Promise<T> {
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    return authenticated ? this.protected<T>(path, init) : this.raw<T>(path, init);
  }

  public requestOtp(phone: string) { return this.json<{ accepted: true }>('/api/auth/otp', { phone, purpose: 'LOGIN' }); }
  public verifyOtp(phone: string, code: string) { return this.json<VerifyResponse>('/api/auth/verify', { phone, code }); }
  public setAccessToken(token: string) { this.accessToken = token; }
  public me() { return this.protected<AuthUser>('/api/auth/me'); }
  public async logout() { const result = await this.json<{ loggedOut: true }>('/api/auth/logout', {}, true); this.accessToken = null; return result; }

  public metrics() { return this.protected<AdminDashboardResponse>('/api/admin/metrics'); }
  public users(q: string, page = 1) {
    const params = new URLSearchParams(); if (q) params.set('q', q); if (page > 1) params.set('page', String(page));
    const query = params.toString();
    return this.protected<AdminUserListResponse>(`/api/admin/users${query ? `?${query}` : ''}`);
  }
  public user(id: string) { return this.protected<AdminUserDetail>(`/api/admin/users/${id}`); }
  public warnUser(id: string, body: AdminWarnBody) { return this.json<AdminUserActionResponse>(`/api/admin/users/${id}/warn`, body, true); }
  public suspendUser(id: string, body: AdminSuspendBody) { return this.json<AdminUserActionResponse>(`/api/admin/users/${id}/suspend`, body, true); }
  public banUser(id: string, body: AdminReasonBody) { return this.json<AdminUserActionResponse>(`/api/admin/users/${id}/ban`, body, true); }
  public unbanUser(id: string, body: AdminReasonBody) { return this.json<AdminUserActionResponse>(`/api/admin/users/${id}/unban`, body, true); }
  public verifyUser(id: string, body: AdminReasonBody) { return this.json<AdminUserActionResponse>(`/api/admin/users/${id}/verify`, body, true); }

  public matches(params: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    return this.protected<AdminMatchListResponse>(`/api/admin/matches${query ? `?${query}` : ''}`);
  }
  public match(id: string) { return this.protected<AdminMatchDetail>(`/api/admin/matches/${id}`); }
  public editMatch(id: string, body: UpdateMatchBody) { return this.protected<AdminMatchDetail>(`/api/admin/matches/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  public flagMatch(id: string, body: AdminFlagBody) { return this.json<AdminMatchActionResponse>(`/api/admin/matches/${id}/flag`, body, true); }
  public unflagMatch(id: string, reason: string) { return this.json<AdminMatchActionResponse>(`/api/admin/matches/${id}/unflag`, { reason }, true); }
  public cancelMatch(id: string, reason: string) { return this.json<AdminMatchActionResponse>(`/api/admin/matches/${id}/cancel`, { reason }, true); }

  public moderationQueue() { return this.protected<AdminModerationQueue>('/api/admin/moderation/queue'); }
  public resolveReport(ratingId: string, body: AdminReportActionBody) { return this.json<AdminModerationActionResponse>(`/api/admin/moderation/reports/${ratingId}`, body, true); }
  public resolveDispute(recordId: string, body: AdminDisputeResolveBody) { return this.json<AdminModerationActionResponse>(`/api/admin/moderation/disputes/${recordId}`, body, true); }
  public resolveStadium(stadiumId: string, body: AdminStadiumDecisionBody) { return this.json<AdminModerationActionResponse>(`/api/admin/moderation/stadiums/${stadiumId}`, body, true); }

  public auditLogs(params: Record<string, string>) {
    const query = new URLSearchParams(params).toString();
    return this.protected<AdminAuditListResponse>(`/api/admin/audit-logs${query ? `?${query}` : ''}`);
  }
  // CSV export is a protected GET; fetch it with the bearer token and return the text for a blob download.
  public async auditCsv(params: Record<string, string>): Promise<string> {
    if (!this.baseUrl) throw new Error('NEXT_PUBLIC_API_URL is required');
    if (!this.accessToken && !(await this.refresh())) throw new ApiClientError({ code: 'UNAUTHORIZED', message: 'Unauthorized' });
    const query = new URLSearchParams(params).toString();
    const response = await this.fetcher(new URL(`/api/admin/audit-logs/export${query ? `?${query}` : ''}`, this.baseUrl), {
      credentials: 'include', headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!response.ok) throw new Error(`Export failed with status ${response.status}`);
    return response.text();
  }
}

export const apiClient = new ApiClient();
