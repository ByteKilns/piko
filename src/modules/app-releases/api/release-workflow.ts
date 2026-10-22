// Starts the "Release mobile app" workflow on GitHub and reads its recent
// runs, for the Settings section. GITHUB_RELEASE_TOKEN is a fine-grained token
// for this repository with only "Actions: Read and write"; it never leaves the
// server. Callers check the release admin first.
const WORKFLOW_URL = "https://api.github.com/repos/ByteKilns/piko/actions/workflows/release-mobile.yml";

export type ReleaseRun = {
  // null while it hasn't finished; then success, failure, cancelled, ...
  conclusion: null | string;
  createdAt: string;
  id: number;
  number: number;
  // queued, in_progress, completed, ...
  status: string;
  url: string;
};

type GitHubRun = {
  conclusion: null | string;
  created_at: string;
  html_url: string;
  id: number;
  run_number: number;
  status: string;
};

function releaseToken(): null | string {
  return process.env.GITHUB_RELEASE_TOKEN?.trim() || null;
}

export function releaseWorkflowConfigured(): boolean {
  return releaseToken() !== null;
}

async function github(path: string, init: RequestInit = {}): Promise<Response> {
  const token = releaseToken();
  if (!token) throw new Error("GITHUB_RELEASE_TOKEN isn't set on the website");
  const response = await fetch(`${WORKFLOW_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (response.ok) return response;
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    throw new Error(`GitHub refused the token (${response.status}). Check GITHUB_RELEASE_TOKEN can run Actions on ByteKilns/piko.`);
  }
  const body = (await response.json().catch(() => null)) as null | { message?: string };
  throw new Error(`GitHub couldn't start it (${response.status})${body?.message ? `: ${body.message}` : ""}`);
}

// Runs the workflow on main, as Actions → Run workflow does.
export async function dispatchReleaseWorkflow(notes: string): Promise<void> {
  await github("/dispatches", { body: JSON.stringify({ inputs: { notes }, ref: "main" }), method: "POST" });
}

// The newest runs first.
export async function listReleaseRuns(limit = 5): Promise<ReleaseRun[]> {
  const response = await github(`/runs?per_page=${limit}`);
  const body = (await response.json()) as { workflow_runs: GitHubRun[] };
  return body.workflow_runs.map((run) => ({
    conclusion: run.conclusion,
    createdAt: run.created_at,
    id: run.id,
    number: run.run_number,
    status: run.status,
    url: run.html_url,
  }));
}
