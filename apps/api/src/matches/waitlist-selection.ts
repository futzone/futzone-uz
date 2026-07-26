export interface WaitlistParty {
  guestCount: number;
  waitlistPosition: number | null;
}

export function firstFittingWaitlistParty<T extends WaitlistParty>(
  parties: readonly T[],
  freeSlots: number,
): T | undefined {
  return [...parties]
    .sort((left, right) =>
      (left.waitlistPosition ?? Number.MAX_SAFE_INTEGER) -
      (right.waitlistPosition ?? Number.MAX_SAFE_INTEGER),
    )
    .find((party) => 1 + party.guestCount <= freeSlots);
}
