"use client";

import { useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { MediaSelector } from "@/components/media/MediaSelector";
import type { MediaItem } from "@/types/media";

interface Props {
  value: string;
  onChange: (url: string) => void;
  /** Optional: override the modal title shown in the media library */
  title?: string;
  /** Tailwind size for the preview thumbnail. Defaults to a small banner. */
  previewSize?: "sm" | "md" | "lg" | "square";
  /** Hide the inline URL fallback input (shown by default). */
  hideUrlFallback?: boolean;
  /** Placeholder for the URL input. */
  urlPlaceholder?: string;
}

const SIZE_CLASSES: Record<NonNullable<Props["previewSize"]>, string> = {
  sm: "w-20 h-14",
  md: "w-32 h-20",
  lg: "w-48 h-28",
  square: "w-24 h-24",
};

export function ImageUploadField({
  value,
  onChange,
  title = "Select Image",
  previewSize = "md",
  hideUrlFallback = false,
  urlPlaceholder = "…or paste a URL",
}: Props) {
  const [open, setOpen] = useState(false);

  const handleSelect = (media: MediaItem | MediaItem[]) => {
    const m = Array.isArray(media) ? media[0] : media;
    onChange(m.cloudFrontUrl || m.s3Url);
    setOpen(false);
  };

  const previewClass = SIZE_CLASSES[previewSize];

  return (
    <>
      <div className="flex items-start gap-3">
        {value ? (
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt=""
              className={`${previewClass} rounded-lg object-cover bg-slate-950 border border-slate-700`}
              onError={(e) => {
                e.currentTarget.style.opacity = "0.3";
              }}
            />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
              title="Remove image"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div
            className={`${previewClass} bg-slate-950 border border-slate-700 border-dashed rounded-lg flex items-center justify-center shrink-0`}
          >
            <ImageIcon className="w-7 h-7 text-slate-600" />
          </div>
        )}
        <div className="flex-1 space-y-2 min-w-0">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 border border-slate-700"
          >
            <ImageIcon className="w-4 h-4" />
            {value ? "Change Image" : "Upload / Pick Image"}
          </button>
          {!hideUrlFallback && (
            <input
              type="url"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={urlPlaceholder}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          )}
        </div>
      </div>

      <MediaSelector
        isOpen={open}
        onClose={() => setOpen(false)}
        onSelect={handleSelect}
        fileType="IMAGE"
        title={title}
      />
    </>
  );
}
