import { createHash, timingSafeEqual } from "node:crypto";

// The GitHub release workflow signs its requests with APP_RELEASE_TOKEN
// instead of a person's login: it can publish app releases and nothing else.
// Unset on the website → every request is refused.
export function isReleaseToken(authorization: null | string): boolean {
  const expected = process.env.APP_RELEASE_TOKEN ?? "";
  if (!expected || !authorization?.startsWith("Bearer ")) return false;
  const given = authorization.slice("Bearer ".length);
  // Hashing first gives equal lengths, so the comparison takes the same time
  // however much of the token is right.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}
