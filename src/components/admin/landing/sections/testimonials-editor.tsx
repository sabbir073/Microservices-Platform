"use client";

import type { TestimonialsContent } from "@/lib/landing-content";
import {
  Field,
  GradientPicker,
  RepeatingList,
  SectionCard,
  inp,
  inpSm,
} from "../_shared";

interface Props {
  value: TestimonialsContent;
  onChange: (next: TestimonialsContent) => void;
  disabled?: boolean;
}

export function TestimonialsEditor({ value, onChange, disabled }: Props) {
  const set = <K extends keyof TestimonialsContent>(
    k: K,
    v: TestimonialsContent[K]
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

      <SectionCard title="Stories">
        <RepeatingList
          items={value.items}
          onChange={(next) => set("items", next)}
          newItem={() => ({
            name: "New User",
            avatar: "NU",
            country: "",
            earned: "$0",
            rating: 5,
            quote: "",
            gradient: "from-blue-500 to-cyan-500",
          })}
          addLabel="+ Add Testimonial"
          disabled={disabled}
          itemTitle={(it) => it.name || "(unnamed)"}
          render={(item, update) => (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <Field label="Name">
                  <input
                    value={item.name}
                    onChange={(e) => update({ name: e.target.value })}
                    disabled={disabled}
                    className={inpSm}
                  />
                </Field>
                <Field label="Initials" hint="2 letters">
                  <input
                    value={item.avatar}
                    onChange={(e) =>
                      update({ avatar: e.target.value.slice(0, 3) })
                    }
                    disabled={disabled}
                    maxLength={3}
                    className={inpSm}
                  />
                </Field>
                <Field label="Avatar Gradient">
                  <GradientPicker
                    value={item.gradient}
                    onChange={(v) => update({ gradient: v })}
                    disabled={disabled}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Country">
                  <input
                    value={item.country}
                    onChange={(e) => update({ country: e.target.value })}
                    disabled={disabled}
                    className={inpSm}
                  />
                </Field>
                <Field label="Earned">
                  <input
                    value={item.earned}
                    onChange={(e) => update({ earned: e.target.value })}
                    disabled={disabled}
                    className={inpSm}
                    placeholder="$1,200"
                  />
                </Field>
                <Field label="Rating (1–5)">
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={item.rating}
                    onChange={(e) =>
                      update({
                        rating: Math.min(
                          5,
                          Math.max(1, parseInt(e.target.value) || 5)
                        ),
                      })
                    }
                    disabled={disabled}
                    className={inpSm}
                  />
                </Field>
              </div>
              <Field label="Quote">
                <textarea
                  rows={3}
                  value={item.quote}
                  onChange={(e) => update({ quote: e.target.value })}
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
