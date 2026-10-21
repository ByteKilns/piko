import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Every export of a "use server" file is a Server Action that a browser can
// call with any arguments it likes. So those files export only `…Action`
// functions, which read the household from the session. Helpers that take a
// householdId (or anything else the caller vouches for) live in plain modules
// next to them (e.g. expenses/api/expenses.ts), which browsers can't reach.
const SRC = path.join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function isUseServerFile(source: string): boolean {
  const firstStatement = source
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "" && !line.startsWith("//"));
  return firstStatement === '"use server";' || firstStatement === "'use server';";
}

// The exports of a "use server" file that aren't an `…Action` function.
function nonActionExports(source: string): string[] {
  return source
    .split("\n")
    .filter((line) => line.startsWith("export "))
    .filter((line) => !/^export (type|interface) /.test(line))
    .filter((line) => !/^export async function \w+Action\(/.test(line));
}

describe("nonActionExports", () => {
  it("allows Action functions and types", () => {
    const source = ['"use server";', "export async function saveAction(input: X) {", "export type X = { a: string };"].join("\n");
    expect(nonActionExports(source)).toEqual([]);
  });

  it("flags a helper that takes a household id, and any other value export", () => {
    const source = [
      '"use server";',
      "export async function listThings(householdId: string) {",
      "export const LIMIT = 10;",
      "export { listOther };",
    ].join("\n");
    expect(nonActionExports(source)).toEqual([
      "export async function listThings(householdId: string) {",
      "export const LIMIT = 10;",
      "export { listOther };",
    ]);
  });
});

describe('"use server" files', () => {
  const files = sourceFiles(SRC).filter((file) => isUseServerFile(readFileSync(file, "utf8")));

  it("are found", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((file) => [path.relative(SRC, file).replaceAll("\\", "/"), file]))(
    "%s exports only …Action functions",
    (_name, file) => {
      expect(nonActionExports(readFileSync(file, "utf8"))).toEqual([]);
    },
  );
});
