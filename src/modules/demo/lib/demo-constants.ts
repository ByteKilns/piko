// How long a visitor's private demo household lives before cleanup deletes it.
export const DEMO_LIFETIME_HOURS = 24;

// At most this many demos live at once; past it, visitors are asked to come
// back later. Caps what bots can create without storing anyone's IP address.
export const MAX_LIVE_DEMOS = 100;

export function demoExpiry(now: Date): Date {
  return new Date(now.getTime() + DEMO_LIFETIME_HOURS * 60 * 60 * 1000);
}
