"use client";

import type { FaqContent } from "@/lib/landing-content";
import { Field, RepeatingList, SectionCard, inp, inpSm } from "../_shared";

interface Props {
  value: FaqContent;
  onChange: (next: FaqContent) => void;
  disabled?: boolean;
}

export function FaqEditor({ value, onChange, disabled }: Props) {
  const set = <K extends keyof FaqContent>(k: K, v: FaqContent[K]) =>
    onChange({ ...value, [k]: v });

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

      <SectionCard title="Questions">
        <RepeatingList
          items={value.items}
          onChange={(next) => set("items", next)}
          newItem={() => ({ question: "", answer: "" })}
          addLabel="+ Add Question"
          disabled={disabled}
          itemTitle={(it) => it.question || "(empty)"}
          render={(item, update) => (
            <div className="space-y-2">
              <Field label="Question">
                <input
                  value={item.question}
                  onChange={(e) => update({ question: e.target.value })}
                  disabled={disabled}
                  className={inpSm}
                />
              </Field>
              <Field label="Answer">
                <textarea
                  rows={4}
                  value={item.answer}
                  onChange={(e) => update({ answer: e.target.value })}
                  disabled={disabled}
                  className={inpSm + " resize-none"}
                />
              </Field>
            </div>
          )}
        />
      </SectionCard>

      <SectionCard title="Contact">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Prompt">
            <input
              value={value.contact_prompt}
              onChange={(e) => set("contact_prompt", e.target.value)}
              disabled={disabled}
              className={inp}
            />
          </Field>
          <Field label="Link Label">
            <input
              value={value.contact_label}
              onChange={(e) => set("contact_label", e.target.value)}
              disabled={disabled}
              className={inp}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={value.contact_email}
              onChange={(e) => set("contact_email", e.target.value)}
              disabled={disabled}
              className={inp}
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}
