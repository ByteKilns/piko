"use client";

import { useRef, useState } from "react";

import { upload } from "@vercel/blob/client";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { publishReleaseAction } from "@/modules/app-releases/api/app-releases.actions";

type Release = {
  createdAt: Date;
  id: string;
  notes: null | string;
  sizeBytes: number;
  versionCode: number;
  versionName: string;
};

type Props = { releases: Release[] };

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function formatMb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AppReleasesSection({ releases }: Props) {
  const latest = releases[0];
  const [file, setFile] = useState<File | null>(null);
  const [versionName, setVersionName] = useState("");
  const [versionCode, setVersionCode] = useState(String((latest?.versionCode ?? 0) + 1));
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState<null | number>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = progress !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Choose an APK file first");
      return;
    }
    // Checked before uploading too, so a rejected build number doesn't leave
    // an orphaned APK in storage (the server re-checks on publish).
    if (latest && Number(versionCode) <= latest.versionCode) {
      toast.error(`Build number must be higher than the current ${latest.versionCode}`);
      return;
    }

    setProgress(0);
    try {
      const sha256 = await sha256Hex(file);
      const blob = await upload(`app-releases/piko-${versionName || "build"}.apk`, file, {
        access: "public",
        contentType: "application/vnd.android.package-archive",
        handleUploadUrl: "/api/app-releases/upload",
        multipart: true,
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });

      const { cleanupFailed } = await publishReleaseAction({
        apkUrl: blob.url,
        notes: notes || undefined,
        sha256,
        sizeBytes: file.size,
        versionCode: Number(versionCode),
        versionName,
      });

      toast.success(`Published v${versionName} — the app will prompt users to update`);
      if (cleanupFailed) toast.warning("Older APK files couldn't be deleted and may still be downloadable.");
      setFile(null);
      setVersionName("");
      setVersionCode(String(Number(versionCode) + 1));
      setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish release");
    } finally {
      setProgress(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">App updates</CardTitle>
        <p className="text-sm text-muted-foreground">
          {latest ? (
            <>
              Live now: <span className="font-medium text-foreground">v{latest.versionName}</span> (build {latest.versionCode}). Publishing a
              new build removes the previous APK.
            </>
          ) : (
            "No build published yet — installed apps won't see any update until you publish one."
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="max-w-sm space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <Label>APK file</Label>
            <div className="flex items-center gap-3">
              <Button disabled={busy} onClick={() => inputRef.current?.click()} type="button" variant="outline">
                <Upload className="h-4 w-4" />
                Choose APK
              </Button>
              <span className="truncate text-sm text-muted-foreground">
                {file ? `${file.name} · ${formatMb(file.size)}` : "No file chosen"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">mobile/build/app/outputs/flutter-apk/app-arm64-v8a-release.apk</p>
            <input
              accept=".apk,application/vnd.android.package-archive"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              ref={inputRef}
              type="file"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextField
              disabled={busy}
              label="Version"
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="1.1.0"
              required
              value={versionName}
            />
            <TextField
              disabled={busy}
              label="Build number"
              max={999}
              min={1}
              onChange={(e) => setVersionCode(e.target.value)}
              required
              type="number"
              value={versionCode}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Must match <code>version: {versionName || "1.1.0"}+{versionCode}</code> in pubspec.yaml.
          </p>

          <div className="space-y-1">
            <Label htmlFor="release-notes">What&apos;s new</Label>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
              disabled={busy}
              id="release-notes"
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Shown to users in the update prompt"
              value={notes}
            />
          </div>

          {busy && <Progress value={progress} />}

          <Button disabled={busy || !file} type="submit">
            {busy ? `Uploading ${Math.round(progress)}%` : "Publish update"}
          </Button>
        </form>

        <div className="space-y-2">
          <p className="text-sm font-medium">Published builds</p>
          {releases.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">No builds published yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Version</th>
                    <th className="px-3 py-2 font-medium">Build</th>
                    <th className="px-3 py-2 font-medium">Size</th>
                    <th className="px-3 py-2 font-medium">Published</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {releases.map((r, i) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-medium">v{r.versionName}</td>
                      <td className="px-3 py-2">{r.versionCode}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatMb(r.sizeBytes)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.createdAt.toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        {/* Only the newest build stays downloadable; publishing deletes older APK files. */}
                        {i === 0 ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
                            Live
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Removed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
