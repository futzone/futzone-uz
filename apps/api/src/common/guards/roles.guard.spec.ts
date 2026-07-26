import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function context(role: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: 'u', role, status: 'ACTIVE' } : undefined }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}
function guardFor(required: string[] | undefined): RolesGuard {
  return new RolesGuard({ getAllAndOverride: () => required } as unknown as Reflector);
}

describe('RolesGuard', () => {
  it('allows any request when no roles are required', () => {
    expect(guardFor(undefined).canActivate(context(undefined))).toBe(true);
    expect(guardFor([]).canActivate(context('USER'))).toBe(true);
  });

  it('allows a user whose role is in the required set', () => {
    expect(guardFor(['ADMIN', 'MODERATOR']).canActivate(context('MODERATOR'))).toBe(true);
  });

  it('rejects a user whose role is not permitted', () => {
    expect(() => guardFor(['ADMIN']).canActivate(context('MODERATOR'))).toThrow();
    expect(() => guardFor(['ADMIN', 'MODERATOR']).canActivate(context('USER'))).toThrow();
    expect(() => guardFor(['ADMIN']).canActivate(context(undefined))).toThrow();
  });
});
