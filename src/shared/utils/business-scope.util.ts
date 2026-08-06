import { BookingType, BusinessScope, UserRole } from '../enums';

const SCOPE_TO_BOOKING_TYPE: Record<BusinessScope, BookingType> = {
  [BusinessScope.EVENT_TICKETING]: BookingType.TICKET,
  [BusinessScope.TABLE_CLUB]:      BookingType.TABLE,
  [BusinessScope.APARTMENT]:       BookingType.APARTMENT,
  [BusinessScope.CAR_RENTAL]:      BookingType.CAR,
};

/**
 * Maps a user's assigned business scopes to the booking types they're
 * allowed to see. Returns `undefined` for SUPER_ADMIN (no restriction —
 * sees everything system-wide). Returns an empty array for a scoped user
 * with no assigned businesses (sees nothing, rather than everything).
 */
export function bookingTypesForUser(user: { role: string; businessScopes?: BusinessScope[] | null }): BookingType[] | undefined {
  if (user.role === UserRole.SUPER_ADMIN) return undefined;
  const scopes = user.businessScopes ?? [];
  return scopes.map((s) => SCOPE_TO_BOOKING_TYPE[s]).filter(Boolean);
}

/**
 * Checks whether a user is allowed to access a feature gated by one or more
 * business scopes. SUPER_ADMIN always passes. A scoped user passes if they
 * have at least one of the given scopes assigned.
 */
export function hasBusinessScope(
  user: { role: string; businessScopes?: BusinessScope[] | null },
  required: BusinessScope | BusinessScope[],
): boolean {
  if (user.role === UserRole.SUPER_ADMIN) return true;
  const requiredScopes = Array.isArray(required) ? required : [required];
  const userScopes = user.businessScopes ?? [];
  return requiredScopes.some((s) => userScopes.includes(s));
}
