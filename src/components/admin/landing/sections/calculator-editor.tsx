"use client";

import type { CalculatorContent } from "@/lib/landing-content";
import { Field, RepeatingList, SectionCard, inp, inpSm } from "../_shared";

interface Props {
  value: CalculatorContent;
  onChange: (next: CalculatorContent) => void;
  disabled?: boolean;
}

export function CalculatorEditor({ value, onChange, disabled }: Props) {
  const set = <K extends keyof CalculatorContent>(
    k: K,
    v: CalculatorContent[K]
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
        <Field label="Heading">
          <input
            value={value.heading}
            onChange={(e) => set("heading", e.target.value)}
            disabled={disabled}
            className={inp}
          />
        </Field>
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
        title="Economy"
        description="Conversion + commission settings used by the live calculator."
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Points / $">
            <input
              type="number"
              min={1}
              value={value.points_per_dollar}
              onChange={(e) =>
                set("points_per_dollar", parseInt(e.target.value) || 1000)
              }
              disabled={disabled}
              className={inp}
            />
          </Field>
          <Field label="L1 Commission %">
            <input
              type="number"
              min={0}
              max={100}
              value={value.commission_l1}
              onChange={(e) =>
                set("commission_l1", parseInt(e.target.value) || 0)
              }
              disabled={disabled}
              className={inp}
            />
          </Field>
          <Field label="L2 Commission %">
            <input
              type="number"
              min={0}
              max={100}
              value={value.commission_l2}
              onChange={(e) =>
                set("commission_l2", parseInt(e.target.value) || 0)
              }
              disabled={disabled}
              className={inp}
            />
          </Field>
          <Field label="L3 Commission %">
            <input
              type="number"
              min={0}
              max={100}
              value={value.commission_l3}
              onChange={(e) =>
                set("commission_l3", parseInt(e.target.value) || 0)
              }
              disabled={disabled}
              className={inp}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Avg Team Tasks/Day"
            hint="Used to project team-based earnings."
          >
            <input
              type="number"
              min={0}
              value={value.avg_team_tasks_per_day}
              onChange={(e) =>
                set("avg_team_tasks_per_day", parseInt(e.target.value) || 0)
              }
              disabled={disabled}
              className={inp}
            />
          </Field>
          <Field label="Avg Team Rate ($/task)">
            <input
              type="number"
              step={0.01}
              min={0}
              value={value.avg_team_rate}
              onChange={(e) =>
                set("avg_team_rate", parseFloat(e.target.value) || 0)
              }
              disabled={disabled}
              className={inp}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Plan Rates"
        description="Per-task payout × multiplier for each plan tier."
      >
        <RepeatingList
          items={value.plans}
          onChange={(next) => set("plans", next)}
          newItem={() => ({
            name: "NEW",
            per_task: 0.05,
            multiplier: 1,
            team_levels: 1,
          })}
          addLabel="+ Add Plan"
          disabled={disabled}
          minItems={1}
          itemTitle={(it) => it.name || "(unnamed)"}
          render={(item, update) => (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Field label="Plan Name">
                <input
                  value={item.name}
                  onChange={(e) => update({ name: e.target.value })}
                  disabled={disabled}
                  className={inpSm}
                />
              </Field>
              <Field label="$/task">
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  value={item.per_task}
                  onChange={(e) =>
                    update({ per_task: parseFloat(e.target.value) || 0 })
                  }
                  disabled={disabled}
                  className={inpSm}
                />
              </Field>
              <Field label="Multiplier">
                <input
                  type="number"
                  step={0.05}
                  min={0}
                  value={item.multiplier}
                  onChange={(e) =>
                    update({ multiplier: parseFloat(e.target.value) || 1 })
                  }
                  disabled={disabled}
                  className={inpSm}
                />
              </Field>
              <Field
                label="Team Levels"
                hint="0 = no team building, 1–3 = unlocks L1/L2/L3 commission."
              >
                <select
                  value={item.team_levels}
                  onChange={(e) =>
                    update({
                      team_levels: Math.min(
                        3,
                        Math.max(0, parseInt(e.target.value) || 0)
                      ),
                    })
                  }
                  disabled={disabled}
                  className={inpSm}
                >
                  <option value={0}>0 — No team</option>
                  <option value={1}>1 — L1 only</option>
                  <option value={2}>2 — L1 + L2</option>
                  <option value={3}>3 — L1 + L2 + L3</option>
                </select>
              </Field>
            </div>
          )}
        />
      </SectionCard>
    </div>
  );
}
