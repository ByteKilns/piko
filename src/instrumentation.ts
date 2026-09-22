import { type Instrumentation } from "next";

// Server errors lose their `cause` when they cross to the client error
// boundary, which hid the real Postgres error behind drizzle's generic
// "Failed query". Log the whole chain here, where it's still intact.
export const onRequestError: Instrumentation.onRequestError = (error, request) => {
  if (!(error instanceof Error)) return;

  const chain: string[] = [];
  let current: unknown = error.cause;
  while (current instanceof Error) {
    const code = "code" in current ? ` [${String(current.code)}]` : "";
    chain.push(`caused by${code}: ${current.message}`);
    current = current.cause;
  }

  if (chain.length > 0) {
    console.error(`[${request.method} ${request.path}] ${error.message}\n  ${chain.join("\n  ")}`);
  }
};
