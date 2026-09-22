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

      await publishReleaseAction({
        apkUrl: blob.url,
        notes: notes || undefined,
        sha256,
        sizeBytes: file.size,
        versionCode: Number(versionCode),
        versionName,
      });

      toast.success(`Published v${versionName} — the app will prompt users to update`);
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

        {releases.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Published builds</p>
            <ul className="divide-y rounded-md border text-sm">
              {releases.map((r) => (
                <li className="flex items-center justify-between gap-3 px-3 py-2" key={r.id}>
                  <span>
                    v{r.versionName} <span className="text-muted-foreground">(build {r.versionCode})</span>
                  </span>
                  <span className="text-muted-foreground">
                    {formatMb(r.sizeBytes)} · {r.createdAt.toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
