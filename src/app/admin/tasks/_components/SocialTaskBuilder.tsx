"use client";

import { useEffect, useMemo } from "react";
import {
  SOCIAL_PLATFORMS,
  getPlatform,
  getAction,
  emptySocialConfig,
  type SocialConfig,
  type SocialField,
} from "@/lib/social-tasks";
import { Sparkles, ImageIcon, AlertCircle } from "lucide-react";

interface Props {
  value: SocialConfig;
  onChange: (next: SocialConfig) => void;
}

/**
 * Admin-side builder for SOCIAL task configuration.
 * Step 1: pick platform → action dropdown filters to that platform.
 * Step 2: pick action → renders dynamic fields specific to that action.
 * Step 3: optional toggle "Use AI prompt" replaces text/content fields with a prompt.
 */
export function SocialTaskBuilder({ value, onChange }: Props) {
  const platform = useMemo(() => getPlatform(value.platform), [value.platform]);
  const action = useMemo(
    () => getAction(value.platform, value.action),
    [value.platform, value.action]
  );

  // When platform changes, reset action + fields
  const setPlatform = (key: string) => {
    const fresh = emptySocialConfig();
    onChange({ ...fresh, platform: key });
  };

  // When action changes, reset fields and refresh proof requirements from def
  const setAction = (key: string) => {
    const next: SocialConfig = {
      ...value,
      action: key,
      fields: {},
      aiPromptEnabled: false,
      aiPrompt: null,
      proofRequirements: deriveDefaultProofRequirements(value.platform, key),
    };
    onChange(next);
  };

  const setField = (fieldKey: string, val: string) => {
    onChange({ ...value, fields: { ...value.fields, [fieldKey]: val } });
  };

  const toggleAiPrompt = () => {
    const next = !value.aiPromptEnabled;
    onChange({
      ...value,
      aiPromptEnabled: next,
      aiPrompt: next ? value.aiPrompt ?? "" : null,
    });
  };

  // Reset config if platform is set but invalid
  useEffect(() => {
    if (value.platform && !platform) {
      onChange(emptySocialConfig());
    }
  }, [value.platform, platform, onChange]);

  return (
    <div className="space-y-6">
      {/* Platform picker */}
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Platform <span className="text-red-400">*</span>
        </label>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {SOCIAL_PLATFORMS.map((p) => {
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

      {/* Action picker (only after platform selected) */}
      {platform && (
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Action <span className="text-red-400">*</span>
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Pick what {platform.label} action users should perform — only{" "}
            {platform.label}-specific actions are shown.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {platform.actions.map((a) => {
              const selected = value.action === a.key;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setAction(a.key)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    selected
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "bg-gray-800 border-gray-700 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
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

      {/* Action-specific fields */}
      {action && (
        <div className="space-y-5 p-4 rounded-lg bg-gray-950 border border-gray-800">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-bold text-white">
                {action.emoji} {action.label}{" "}
                <span className="text-gray-400 font-normal">
                  on {platform?.label}
                </span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {action.description}
              </p>
            </div>

            {action.supportsAiPrompt && (
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.aiPromptEnabled}
                  onChange={toggleAiPrompt}
                  className="rounded bg-gray-800 border-gray-600 text-purple-500"
                />
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-semibold text-purple-300">
                  Use AI prompt
                </span>
              </label>
            )}
          </div>

          {value.aiPromptEnabled && action.aiGeneratableFields ? (
            <AiPromptSection
              prompt={value.aiPrompt ?? ""}
              onChange={(p) => onChange({ ...value, aiPrompt: p })}
              generatableFields={action.aiGeneratableFields}
              actionLabel={action.label}
            />
          ) : null}

          {/* Render admin fields. Skip AI-generatable ones if AI prompt is enabled. */}
          <div className="space-y-3">
            {action.adminFields.map((field) => {
              const isAiGen = action.aiGeneratableFields?.includes(field.key);
              if (value.aiPromptEnabled && isAiGen) return null;
              return (
                <FieldEditor
                  key={field.key}
                  field={field}
                  value={value.fields[field.key] ?? ""}
                  onChange={(v) => setField(field.key, v)}
                />
              );
            })}
          </div>

          {/* Proof requirements */}
          <ProofRequirements
            value={value.proofRequirements}
            defaultProofFields={action.proofFields}
            onChange={(pr) =>
              onChange({ ...value, proofRequirements: pr })
            }
          />
        </div>
      )}

      {!platform && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-center text-sm text-gray-500">
          Select a platform above to configure the action.
        </div>
      )}
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
  value: SocialConfig["proofRequirements"];
  defaultProofFields: SocialField[];
  onChange: (next: SocialConfig["proofRequirements"]) => void;
}) {
  const set = (key: keyof SocialConfig["proofRequirements"], v: boolean) =>
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
      <div className="grid grid-cols-3 gap-2">
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
): SocialConfig["proofRequirements"] {
  const action = getAction(platformKey, actionKey);
  if (!action) return { url: true, screenshot: true, username: false };
  const keys = action.proofFields.map((f) => f.key);
  return {
    url: keys.includes("proofUrl"),
    screenshot: keys.includes("screenshotUrl"),
    username: keys.includes("proofUsername"),
  };
}
