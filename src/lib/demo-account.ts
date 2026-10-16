// Demo visitors (src/modules/demo) get throwaway accounts on a reserved
// domain: `.invalid` can never be a real address, so a real person's
// account can never be mistaken for a demo one.
export const DEMO_EMAIL_DOMAIN = "demo.piko.invalid";

// What a demo visitor sees when they reach something the demo turns off.
export const DEMO_LOCKED_MESSAGE = "Not available in the demo";

export function isDemoEmail(email: null | string | undefined): boolean {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

// Server-side guard for the actions the demo turns off. The UI only explains;
// this is what actually stops them.
export function assertNotDemo(member: { isDemo: boolean }): void {
  if (member.isDemo) throw new Error(DEMO_LOCKED_MESSAGE);
}
