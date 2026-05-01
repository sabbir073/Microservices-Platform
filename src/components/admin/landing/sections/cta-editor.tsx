"use client";

import type { CtaContent } from "@/lib/landing-content";
import { Field, SectionCard, inp } from "../_shared";

interface Props {
  value: CtaContent;
  onChange: (next: CtaContent) => void;
  disabled?: boolean;
}

export function CtaEditor({ value, onChange, disabled }: Props) {
  const set = <K extends keyof CtaContent>(k: K, v: CtaContent[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <SectionCard title="Final CTA">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Heading Line 1">
          <input
            value={value.heading_line1}
            onChange={(e) => set("heading_line1", e.target.value)}
            disabled={disabled}
            className={inp}
          />
        </Field>
        <Field label="Heading Line 2 (gradient)">
          <input
            value={value.heading_line2}
            onChange={(e) => set("heading_line2", e.target.value)}
            disabled={disabled}
            className={inp}
          />
        </Field>
      </div>
      <Field label="Subheading">
        <textarea
          rows={3}
          value={value.subheading}
          onChange={(e) => set("subheading", e.target.value)}
          disabled={disabled}
          className={inp + " resize-none"}
        />
      </Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="CTA Label">
          <input
            value={value.cta_label}
            onChange={(e) => set("cta_label", e.target.value)}
            disabled={disabled}
            className={inp}
          />
        </Field>
        <Field label="CTA Href">
          <input
            value={value.cta_href}
            onChange={(e) => set("cta_href", e.target.value)}
            disabled={disabled}
            className={inp}
          />
        </Field>
      </div>
      <Field label="Disclaimer">
        <input
          value={value.disclaimer}
          onChange={(e) => set("disclaimer", e.target.value)}
          disabled={disabled}
          className={inp}
        />
      </Field>
    </SectionCard>
  );
}
