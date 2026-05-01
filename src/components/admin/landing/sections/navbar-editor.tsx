"use client";

import type { NavbarContent } from "@/lib/landing-content";
import { Field, RepeatingList, SectionCard, inp, inpSm } from "../_shared";

interface Props {
  value: NavbarContent;
  onChange: (next: NavbarContent) => void;
  disabled?: boolean;
}

export function NavbarEditor({ value, onChange, disabled }: Props) {
  const set = <K extends keyof NavbarContent>(k: K, v: NavbarContent[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-4">
      <SectionCard
        title="Nav Links"
        description="Anchor links shown in the desktop nav bar and mobile drawer."
      >
        <RepeatingList
          items={value.nav_links}
          onChange={(next) => set("nav_links", next)}
          newItem={() => ({ label: "", href: "#" })}
          addLabel="+ Add Nav Link"
          disabled={disabled}
          itemTitle={(it) => it.label || "(empty)"}
          render={(item, update) => (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Label">
                <input
                  value={item.label}
                  onChange={(e) => update({ label: e.target.value })}
                  disabled={disabled}
                  className={inpSm}
                />
              </Field>
              <Field label="Href">
                <input
                  value={item.href}
                  onChange={(e) => update({ href: e.target.value })}
                  disabled={disabled}
                  className={inpSm}
                  placeholder="#section or /path"
                />
              </Field>
            </div>
          )}
        />
      </SectionCard>

      <SectionCard title="Sign-In CTA">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Label">
            <input
              value={value.cta_signin_label}
              onChange={(e) => set("cta_signin_label", e.target.value)}
              disabled={disabled}
              className={inp}
            />
          </Field>
          <Field label="Href">
            <input
              value={value.cta_signin_href}
              onChange={(e) => set("cta_signin_href", e.target.value)}
              disabled={disabled}
              className={inp}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Sign-Up CTA">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Label">
            <input
              value={value.cta_signup_label}
              onChange={(e) => set("cta_signup_label", e.target.value)}
              disabled={disabled}
              className={inp}
            />
          </Field>
          <Field label="Href">
            <input
              value={value.cta_signup_href}
              onChange={(e) => set("cta_signup_href", e.target.value)}
              disabled={disabled}
              className={inp}
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}
