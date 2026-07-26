import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@futzone/contracts';

export const ROLES_KEY = 'roles';

// Restrict a route to one or more roles. Pair with RolesGuard (after AuthGuard, which sets the user).
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);
