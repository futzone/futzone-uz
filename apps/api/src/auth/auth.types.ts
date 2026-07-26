import type { UserRole, UserStatus } from '@futzone/contracts';

export type CurrentUser = { id: string; role: UserRole; status: UserStatus };
export type AccessClaims = { sub: string; role: UserRole; status: UserStatus; type: 'access' };
export type RefreshClaims = { sub: string; sid: string; family: string; type: 'refresh' };
export type RegistrationClaims = { jti: string; type: 'registration' };
