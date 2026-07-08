"use client";

import { useEffect, useMemo } from "react";
import {
  getPlatform,
  getAction,
  getPlatformGroups,
  emptyBundleConfig,
  sortBundleItems,
  bundleTotalPoints,
  actionPriority,
  isWatchAction,
  type SocialBundleConfig,
  type BundleItem,
  type ProofRequirements as ProofReqs,
  type SocialField,
} from "@/lib/social-tasks";
import {
  Sparkles,
  ImageIcon,
  AlertCircle,
  Plus,
  Minus,
  Trash2,
} from "lucide-react";

interface Props {
  value: SocialBundleConfig;
  onChange: (next: SocialBundleConfig) => void;
}

/**
 * Admin-side builder for a SOCIAL task BUNDLE.
 * Step 1: pick a platform.
 * Step 2: check one or more actions (shown in natural-flow order).
 * Step 3: each selected action gets its own card — points, dynamic admin
 *          fields, optional AI prompt, and proof requirements.
 * The task's total points = Σ of each item's points (recomputed server-side).
 */
export function SocialTaskBuilder({ value, onChange }: Props) {
  const platform = useMemo(() => getPlatform(value.platform), [value.platform]);

  // Selected items in natural-flow order (server re-sorts too, but keep the UI tidy).
  const items = useMemo(() => sortBundleItems(value.items), [value.items]);
  const total = useMemo(() => bundleTotalPoints(items), [items]);

  const commit = (nextItems: BundleItem[]) => {
    onChange({ ...value, items: nextItems, version: 2 });
  };

  const setPlatform = (key: string) => {
    // Switching platform clears the bundle (actions are platform-specific).
    onChange({ ...emptyBundleConfig(), platform: key });
  };

  const isSelected = (actionKey: string) =>
    value.items.some((i) => i.action === actionKey);

  const toggleAction = (actionKey: string) => {
    if (isSelected(actionKey)) {
      commit(value.items.filter((i) => i.action !== actionKey));
      return;
    }
    const def = getAction(value.platform, actionKey);
    if (!def) return;
    const fresh: BundleItem = {
      action: actionKey,
      fields: {},
      points: def.suggestedReward?.min ?? 0,
      proofRequirements: deriveDefaultProofRequirements(value.platform, actionKey),
      aiPromptEnabled: false,
      aiPrompt: null,
    };
    commit(sortBundleItems([...value.items, fresh]));
  };

  const updateItem = (actionKey: string, patch: Partial<BundleItem>) => {
    commit(
      value.items.map((i) =>
        i.action === actionKey ? { ...i, ...patch } : i
      )
    );
  };

  // Reset config if platform is set but invalid
  useEffect(() => {
    if (value.platform && !platform) {
      onChange(emptyBundleConfig());
    }
  }, [value.platform, platform, onChange]);

  const sortedActions = useMemo(
    () =>
      platform
        ? [...platform.actions].sort(
            (a, b) => actionPriority(a.key) - actionPriority(b.key)
          )
        : [],
    [platform]
  );

  return (
    <div className="space-y-6">
      {/* Platform picker */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Platform <span className="text-red-400">*</span>
        </label>
        <div className="space-y-4">
          {getPlatformGroups().map((group) => (
            <div key={group.key}>
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-2">
                {group.label}
                <span className="ml-1.5 text-gray-600 font-semibold">
                  ({group.platforms.length})
                </span>
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {group.platforms.map((p) => {
                  const selected = value.platform === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPlatform(p.key)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                        selected
                          ? `${p.brandColor} border-transparent shadow-lg`
                          : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
                      }`}
                    >
                      <span className="text-2xl leading-none">{p.emoji}</span>
                      <span className="text-[11px] font-semibold">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action checklist (only after platform selected) */}
      {platform && (
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Actions <span className="text-red-400">*</span>
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Check every {platform.label} action this task bundles — users must
            complete them in order (shown top-to-bottom in the natural flow).
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {sortedActions.map((a) => {
              const selected = isSelected(a.key);
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => toggleAction(a.key)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    selected
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "bg-gray-800 border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      readOnly
                      checked={selected}
                      className="rounded bg-gray-800 border-gray-600 text-indigo-500 pointer-events-none"
                    />
                    <span className="text-lg">{a.emoji}</span>
                    <span className="text-sm font-semibold text-white">
                      {a.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">
                    {a.description}
                  </p>
                  {a.suggestedReward && (
                    <p className="text-[10px] text-amber-400 mt-1">
                      ~{a.suggestedReward.min}-{a.suggestedReward.max} pts
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-item configuration cards (in natural-flow order) */}
      {items.map((item, idx) => {
        const def = getAction(value.platform, item.action);
        if (!def) return null;
        return (
          <div
            key={item.action}
            className="space-y-5 p-4 rounded-lg bg-gray-950 border border-gray-800"
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-bold text-white">
                  <span className="text-gray-500">{idx + 1}.</span> {def.emoji}{" "}
                  {def.label}{" "}
                  <span className="text-gray-400 font-normal">
                    on {platform?.label}
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{def.description}</p>
              </div>

              <div className="flex items-center gap-2">
                {def.supportsAiPrompt && (
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.aiPromptEnabled}
                      onChange={() =>
                        updateItem(item.action, {
                          aiPromptEnabled: !item.aiPromptEnabled,
                          aiPrompt: !item.aiPromptEnabled
                            ? item.aiPrompt ?? ""
                            : null,
                        })
                      }
                      className="rounded bg-gray-800 border-gray-600 text-purple-500"
                    />
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-semibold text-purple-300">
                      Use AI prompt
                    </span>
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => toggleAction(item.action)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                  title="Remove action"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Per-item points */}
            <PointsStepper
              value={item.points}
              onChange={(n) => updateItem(item.action, { points: n })}
            />

            {/* Watch/listen duration — for watch-type actions (feeds the timed lock) */}
            {isWatchAction(item.action) && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Watch / Listen duration (seconds)
                </label>
                <input
                  type="number"
                  min={0}
                  value={item.watchSeconds ?? 0}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    updateItem(item.action, {
                      watchSeconds: Number.isFinite(n) && n > 0 ? n : undefined,
                    });
                  }}
                  placeholder="30"
                  className="w-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  If set, users must watch this long in a locked player before it counts.
                </p>
              </div>
            )}

            {item.aiPromptEnabled && def.aiGeneratableFields ? (
              <AiPromptSection
                prompt={item.aiPrompt ?? ""}
                onChange={(p) => updateItem(item.action, { aiPrompt: p })}
                generatableFields={def.aiGeneratableFields}
                actionLabel={def.label}
              />
            ) : null}

            {/* Admin fields — skip AI-generatable ones if AI prompt is enabled */}
            <div className="space-y-3">
              {def.adminFields.map((field) => {
                const isAiGen = def.aiGeneratableFields?.includes(field.key);
                if (item.aiPromptEnabled && isAiGen) return null;
                return (
                  <FieldEditor
                    key={field.key}
                    field={field}
                    value={item.fields[field.key] ?? ""}
                    onChange={(v) =>
                      updateItem(item.action, {
                        fields: { ...item.fields, [field.key]: v },
                      })
                    }
                  />
                );
              })}
            </div>

            {/* Proof requirements */}
            <ProofRequirements
              value={item.proofRequirements}
              defaultProofFields={def.proofFields}
              onChange={(pr) =>
                updateItem(item.action, { proofRequirements: pr })
              }
            />
          </div>
        );
      })}

      {/* Live bundle summary */}
      {platform && items.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
          <span className="text-sm text-gray-300">
            {items.length} action{items.length > 1 ? "s" : ""} in this bundle
          </span>
          <span className="text-sm font-bold text-white">
            Total reward: {total} pts
          </span>
        </div>
      )}

      {platform && items.length === 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-center text-sm text-gray-500">
          Check at least one action above to build the bundle.
        </div>
      )}

      {!platform && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-center text-sm text-gray-500">
          Select a platform above to configure the bundle.
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Points stepper (per bundle item)
// -----------------------------------------------------------------------------

function PointsStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const clamp = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-1.5">
        Points for this action
      </label>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-600"
        >
          <Minus className="w-4 h-4" />
        </button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className="w-24 text-center px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-600"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// AI Prompt Section
// -----------------------------------------------------------------------------

function AiPromptSection({
  prompt,
  onChange,
  generatableFields,
  actionLabel,
}: {
  prompt: string;
  onChange: (next: string) => void;
  generatableFields: string[];
  actionLabel: string;
}) {
  return (
    <div className="rounded-lg bg-purple-500/5 border border-purple-500/30 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-400" />
        <p className="text-sm font-bold text-purple-300">AI Prompt Mode</p>
      </div>
      <p className="text-xs text-gray-400">
        Instead of writing the {actionLabel.toLowerCase()} content yourself,
        give a prompt and the user&apos;s app will generate{" "}
        <strong className="text-purple-300">
          {generatableFields.join(", ")}
        </strong>{" "}
        from it (via AI). Users review the generated output, then post on the
        platform and submit proof.
      </p>
      <textarea
        rows={4}
        value={prompt}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. 'Write a 280-character motivational tweet about consistent earning, in a friendly tone, with relevant hashtags.'"
        className="w-full px-3 py-2 bg-gray-950 border border-purple-500/30 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
      />
      <p className="text-[11px] text-gray-500">
        Tip: be specific about tone, length, hashtags, and format so AI output
        is consistent.
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Field editor — renders the right input type for each FieldType
// -----------------------------------------------------------------------------

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: SocialField;
  value: string;
  onChange: (v: string) => void;
}) {
  const labelEl = (
    <label className="block text-sm font-medium text-gray-400 mb-1.5">
      {field.label}
      {field.required && <span className="text-red-400 ml-1">*</span>}
    </label>
  );
  const helperEl = field.helperText ? (
    <p className="text-[11px] text-gray-500 mt-1">{field.helperText}</p>
  ) : null;

  const baseClass =
    "w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500";

  if (field.type === "textarea") {
    return (
      <div>
        {labelEl}
        <textarea
          rows={3}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={baseClass + " resize-none"}
        />
        {helperEl}
      </div>
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <div>
        {labelEl}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={baseClass}
        >
          <option value="">Select…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {helperEl}
      </div>
    );
  }

  if (field.type === "image-url") {
    return (
      <div>
        {labelEl}
        <div className="flex items-center gap-3">
          {value && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Preview"
              className="w-20 h-14 rounded-lg object-cover bg-gray-900 border border-gray-700"
            />
          )}
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? "https://..."}
            className={baseClass + " flex-1"}
          />
          {!value && <ImageIcon className="w-5 h-5 text-gray-600" />}
        </div>
        {helperEl}
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div>
        {labelEl}
        <input
          type="number"
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={baseClass}
        />
        {helperEl}
      </div>
    );
  }

  // text, url, screenshot all use plain input
  return (
    <div>
      {labelEl}
      <input
        type={field.type === "url" ? "url" : "text"}
        required={field.required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={baseClass}
      />
      {helperEl}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Proof requirements — admin can override what user must submit
// -----------------------------------------------------------------------------

function ProofRequirements({
  value,
  defaultProofFields,
  onChange,
}: {
  value: ProofReqs;
  defaultProofFields: SocialField[];
  onChange: (next: ProofReqs) => void;
}) {
  const set = (key: keyof ProofReqs, v: boolean) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="rounded-lg bg-gray-900 border border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-4 h-4 text-amber-400" />
        <p className="text-sm font-bold text-white">Proof Required</p>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        What users must submit to complete this task. Defaults are based on the
        action — adjust if needed.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Toggle
          label="Proof URL"
          help="User submits a link (e.g. their post, comment, or profile)"
          checked={value.url}
          onChange={(v) => set("url", v)}
        />
        <Toggle
          label="Screenshot"
          help="User uploads a screenshot of the action"
          checked={value.screenshot}
          onChange={(v) => set("screenshot", v)}
        />
        <Toggle
          label="Username"
          help="User submits their handle on the platform"
          checked={value.username}
          onChange={(v) => set("username", v)}
        />
      </div>
      <p className="text-[11px] text-gray-500 mt-3">
        Default proof fields for this action:{" "}
        <span className="text-gray-300">
          {defaultProofFields.map((f) => f.label).join(", ") || "none"}
        </span>
      </p>
    </div>
  );
}

function Toggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex flex-col gap-1 p-3 rounded-lg border cursor-pointer transition-colors ${
        checked
          ? "border-indigo-500 bg-indigo-500/10"
          : "border-gray-800 bg-gray-950 hover:border-gray-700"
      }`}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded bg-gray-800 border-gray-600 text-indigo-500"
        />
        <span className="text-sm font-semibold text-white">{label}</span>
      </div>
      <span className="text-[11px] text-gray-500">{help}</span>
    </label>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function deriveDefaultProofRequirements(
  platformKey: string | null | undefined,
  actionKey: string
): ProofReqs {
  const action = getAction(platformKey, actionKey);
  if (!action) return { url: true, screenshot: true, username: false };
  const keys = action.proofFields.map((f) => f.key);
  return {
    url: keys.includes("proofUrl"),
    screenshot: keys.includes("screenshotUrl"),
    username: keys.includes("proofUsername"),
  };
}
