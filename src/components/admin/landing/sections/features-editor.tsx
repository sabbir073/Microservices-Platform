"use client";

import type { FeaturesContent } from "@/lib/landing-content";
import {
  Field,
  GradientPicker,
  IconKeyPicker,
  RepeatingList,
  SectionCard,
  inp,
  inpSm,
} from "../_shared";

interface Props {
  value: FeaturesContent;
  onChange: (next: FeaturesContent) => void;
  disabled?: boolean;
}

export function FeaturesEditor({ value, onChange, disabled }: Props) {
  const set = <K extends keyof FeaturesContent>(
    k: K,
    v: FeaturesContent[K]
  ) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-4">
      <SectionCard title="Header">
        <Field label="Badge">
          <input
            value={value.badge}
            onChange={(e) => set("badge", e.target.value)}
            disabled={disabled}
            className={inp}
          />
        </Field>
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
            rows={2}
            value={value.subheading}
            onChange={(e) => set("subheading", e.target.value)}
            disabled={disabled}
            className={inp + " resize-none"}
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Feature Cards"
        description="Each card highlights one earning method."
      >
        <RepeatingList
          items={value.items}
          onChange={(next) => set("items", next)}
          newItem={() => ({
            iconKey: "Sparkles",
            title: "New Feature",
            description: "",
            gradient: "from-blue-500 to-indigo-600",
          })}
          addLabel="+ Add Feature"
          disabled={disabled}
          itemTitle={(it) => it.title || "(untitled)"}
          render={(item, update) => (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Icon">
                  <IconKeyPicker
                    value={item.iconKey}
                    onChange={(v) => update({ iconKey: v })}
                    group="feature"
                    disabled={disabled}
                  />
                </Field>
                <Field label="Gradient">
                  <GradientPicker
                    value={item.gradient}
                    onChange={(v) => update({ gradient: v })}
                    disabled={disabled}
                  />
                </Field>
              </div>
              <Field label="Title">
                <input
                  value={item.title}
                  onChange={(e) => update({ title: e.target.value })}
                  disabled={disabled}
                  className={inpSm}
                />
              </Field>
              <Field label="Description">
                <textarea
                  rows={2}
                  value={item.description}
                  onChange={(e) => update({ description: e.target.value })}
                  disabled={disabled}
                  className={inpSm + " resize-none"}
                />
              </Field>
            </div>
          )}
        />
      </SectionCard>
    </div>
  );
}
