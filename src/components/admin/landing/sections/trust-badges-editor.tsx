"use client";

import type { TrustBadgesContent } from "@/lib/landing-content";
import {
  Field,
  IconKeyPicker,
  RepeatingList,
  SectionCard,
  inpSm,
} from "../_shared";

interface Props {
  value: TrustBadgesContent;
  onChange: (next: TrustBadgesContent) => void;
  disabled?: boolean;
}

export function TrustBadgesEditor({ value, onChange, disabled }: Props) {
  return (
    <SectionCard
      title="Trust Badges"
      description="Single row of icon + label pairs."
    >
      <RepeatingList
        items={value.items}
        onChange={(next) => onChange({ items: next })}
        newItem={() => ({ iconKey: "Shield", label: "New Badge" })}
        addLabel="+ Add Badge"
        disabled={disabled}
        itemTitle={(it) => it.label || "(empty)"}
        render={(item, update) => (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Icon">
              <IconKeyPicker
                value={item.iconKey}
                onChange={(v) => update({ iconKey: v })}
                group="trust"
                disabled={disabled}
              />
            </Field>
            <Field label="Label">
              <input
                value={item.label}
                onChange={(e) => update({ label: e.target.value })}
                disabled={disabled}
                className={inpSm}
              />
            </Field>
          </div>
        )}
      />
    </SectionCard>
  );
}
