"use client";

import { useRef, useState, useTransition } from "react";

import { Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { updateProfileImageAction } from "@/modules/settings/api/settings.actions";
import { SettingsRow } from "@/modules/settings/components/SettingsRow";

const TARGET_SIZE = 160;

// Resizes/crops the picked file to a small square JPEG data URL entirely in
// the browser — no upload endpoint or blob storage needed for that.
function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = TARGET_SIZE;
      canvas.height = TARGET_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      const side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, TARGET_SIZE, TARGET_SIZE);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = URL.createObjectURL(file);
  });
}

type Props = { initialImage: null | string; name: string };

export function ProfilePictureSection({ initialImage, name }: Props) {
  const [image, setImage] = useState(initialImage);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function save(next: null | string) {
    setImage(next);
    startTransition(async () => {
      try {
        await updateProfileImageAction(next);
        toast.success(next ? "Photo updated" : "Photo removed");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save photo");
      }
    });
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      save(await resizeToDataUrl(file));
    } catch {
      toast.error("Could not process that image");
    }
  }

  return (
    <SettingsRow
      control={
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center overflow-hidden bg-surface text-lg font-semibold text-n-700">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element -- a client-side data URL, not a remote asset
              <img alt={name} className="h-full w-full object-cover" src={image} />
            ) : (
              name.charAt(0).toUpperCase() || "?"
            )}
          </span>
          <Button disabled={pending} onClick={() => inputRef.current?.click()} type="button" variant="outline">
            <Upload />
            Change
          </Button>
          {image && (
            <Button disabled={pending} onClick={() => save(null)} type="button" variant="ghost">
              Remove
            </Button>
          )}
          <input accept="image/*" className="hidden" onChange={handleFileChange} ref={inputRef} type="file" />
        </div>
      }
      description="JPG or PNG — square images look best."
      label="Photo"
    />
  );
}
