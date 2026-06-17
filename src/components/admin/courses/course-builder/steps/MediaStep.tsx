"use client";

import type { BuilderState } from "../types";
import { Field, SectionHeader, inputCls } from "../shared";
import { ImageUploadField } from "@/components/admin/shared/ImageUploadField";
import { Video } from "lucide-react";

interface Props {
  state: BuilderState;
  update: <K extends keyof BuilderState>(key: K, value: BuilderState[K]) => void;
}

export function MediaStep({ state, update }: Props) {
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Cover media"
        subtitle="Thumbnail powers the catalog card. Banner is the landing-page hero. Promo video sells the course before enrolment."
      />

      <Field label="Thumbnail" required hint="Roughly 16:9 ratio works best.">
        <ImageUploadField
          value={state.thumbnail}
          onChange={(url) => update("thumbnail", url)}
          title="Pick a thumbnail"
          previewSize="lg"
        />
      </Field>

      <Field label="Banner (landing page hero)" hint="Wider/larger than the thumbnail. Optional but recommended.">
        <ImageUploadField
          value={state.bannerUrl}
          onChange={(url) => update("bannerUrl", url)}
          title="Pick a banner image"
          previewSize="lg"
        />
      </Field>

      <Field
        label="Promo video URL"
        hint="MP4, HLS, or a YouTube/Vimeo URL works. Shown on the landing page as a trailer."
      >
        <div className="relative">
          <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="url"
            value={state.promoVideoUrl}
            onChange={(e) => update("promoVideoUrl", e.target.value)}
            className={inputCls + " pl-9"}
            placeholder="https://…"
          />
        </div>
      </Field>
    </div>
  );
}
