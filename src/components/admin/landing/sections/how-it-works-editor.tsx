"use client";

import type { HowItWorksContent } from "@/lib/landing-content";
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
  value: HowItWorksContent;
  onChange: (next: HowItWorksContent) => void;
  disabled?: boolean;
}

export function HowItWorksEditor({ value, onChange, disabled }: Props) {
  const set = <K extends keyof HowItWorksContent>(
    k: K,
    v: HowItWorksContent[K]
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

      <SectionCard title="Steps" description="Onboarding flow rendered left to right.">
        <RepeatingList
          items={value.steps}
          onChange={(next) => set("steps", next)}
          newItem={() => ({
            iconKey: "Sparkles",
            step_number: String(value.steps.length + 1).padStart(2, "0"),
            title: "New Step",
            description: "",
            gradient: "from-blue-500 to-blue-600",
          })}
          addLabel="+ Add Step"
          disabled={disabled}
          itemTitle={(it) => `${it.step_number} · ${it.title || "(untitled)"}`}
          render={(item, update) => (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Field label="Step Number">
                  <input
                    value={item.step_number}
                    onChange={(e) => update({ step_number: e.target.value })}
                    disabled={disabled}
                    className={inpSm}
                    placeholder="01"
                  />
                </Field>
                <Field label="Icon">
                  <IconKeyPicker
                    value={item.iconKey}
                    onChange={(v) => update({ iconKey: v })}
                    group="step"
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
