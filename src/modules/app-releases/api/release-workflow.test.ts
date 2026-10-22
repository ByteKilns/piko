import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dispatchReleaseWorkflow, listReleaseRuns, releaseWorkflowConfigured } from "./release-workflow";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GITHUB_RELEASE_TOKEN", "github_pat_test");
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("dispatchReleaseWorkflow", () => {
  it("runs the release workflow on main with the notes, using the token", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await dispatchReleaseWorkflow("Notes remember the payee");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/ByteKilns/piko/actions/workflows/release-mobile.yml/dispatches");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ inputs: { notes: "Notes remember the payee" }, ref: "main" });
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer github_pat_test");
  });

  it("says the token was refused when GitHub won't let it in", async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"Resource not accessible"}', { status: 403 }));

    await expect(dispatchReleaseWorkflow("x")).rejects.toThrow("GitHub refused the token (403)");
  });

  it("passes on GitHub's reason for anything else", async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"Unexpected inputs provided"}', { status: 422 }));

    await expect(dispatchReleaseWorkflow("x")).rejects.toThrow("GitHub couldn't start it (422): Unexpected inputs provided");
  });

  it("calls nothing without a token", async () => {
    vi.stubEnv("GITHUB_RELEASE_TOKEN", " ");

    expect(releaseWorkflowConfigured()).toBe(false);
    await expect(dispatchReleaseWorkflow("x")).rejects.toThrow("GITHUB_RELEASE_TOKEN isn't set");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("listReleaseRuns", () => {
  it("returns the newest runs as the section shows them", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        workflow_runs: [
          {
            conclusion: null,
            created_at: "2026-10-22T08:00:00Z",
            html_url: "https://github.com/ByteKilns/piko/actions/runs/9",
            id: 9,
            run_number: 3,
            status: "in_progress",
          },
        ],
      }),
    );

    await expect(listReleaseRuns()).resolves.toEqual([
      { conclusion: null, createdAt: "2026-10-22T08:00:00Z", id: 9, number: 3, status: "in_progress", url: "https://github.com/ByteKilns/piko/actions/runs/9" },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.github.com/repos/ByteKilns/piko/actions/workflows/release-mobile.yml/runs?per_page=5");
  });
});
