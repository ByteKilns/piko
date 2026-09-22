// Where the signed-in session is saved between the setup project and the specs.
export const storageStatePath = "e2e/.auth/user.json";

// The seeded household's first user, from .env.local (see `npm run db:seed`).
export function seedCredentials() {
  const email = process.env.SEED_USER1_EMAIL;
  const password = process.env.SEED_USER1_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Set SEED_USER1_EMAIL and SEED_USER1_PASSWORD in .env.local (run `npm run db:seed`) before running e2e tests.",
    );
  }

  return { email, password };
}
