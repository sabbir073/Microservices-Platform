"use client";

import { useState } from "react";
import {
  Plus,
  X,
  Link as LinkIcon,
  Hash,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import {
  type ArticleConfig,
  type ArticleLink,
} from "@/lib/article-tasks";

interface Props {
  value: ArticleConfig;
  onChange: (next: ArticleConfig) => void;
}

export function ArticleTaskBuilder({ value, onChange }: Props) {
  const [keywordInput, setKeywordInput] = useState("");

  // ── Links ────────────────────────────────────────────────────────────────
  const updateLink = (idx: number, patch: Partial<ArticleLink>) => {
    const next = [...value.links];
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...value, links: next });
  };
  const addLink = () => {
    onChange({ ...value, links: [...value.links, { url: "", label: "" }] });
  };
  const removeLink = (idx: number) => {
    if (value.links.length <= 1) return;
    onChange({
      ...value,
      links: value.links.filter((_, i) => i !== idx),
    });
  };

  // ── Keywords ─────────────────────────────────────────────────────────────
  const addKeyword = (raw: string) => {
    const k = raw.trim();
    if (!k) return;
    if (value.keywords.includes(k)) return;
    onChange({ ...value, keywords: [...value.keywords, k] });
    setKeywordInput("");
  };
  const removeKeyword = (k: string) => {
    onChange({ ...value, keywords: value.keywords.filter((x) => x !== k) });
  };

  // ── Proof requirements ────────────────────────────────────────────────────
  const setProof = (
    key: keyof ArticleConfig["proofRequirements"],
    v: boolean
  ) => {
    onChange({
      ...value,
      proofRequirements: { ...value.proofRequirements, [key]: v },
    });
  };

  return (
    <div className="space-y-6">
      {/* Links section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-white inline-flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-indigo-400" />
              Article Links
              <span className="text-red-400">*</span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Add one or many URLs the user must read.
            </p>
          </div>
          <button
            type="button"
            onClick={addLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Link
          </button>
        </div>

        <div className="space-y-2">
          {value.links.map((link, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-gray-800 bg-gray-950 p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-mono shrink-0">
                  #{idx + 1}
                </span>
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateLink(idx, { url: e.target.value })}
                  placeholder="https://..."
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
                {value.links.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLink(idx)}
                    className="p-2 text-gray-500 hover:text-red-400"
                    title="Remove link"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <input
                type="text"
                value={link.label ?? ""}
                onChange={(e) => updateLink(idx, { label: e.target.value })}
                placeholder="Label (optional, e.g. 'Main article')"
                className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Keywords section */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Hash className="w-4 h-4 text-amber-400" />
          <p className="text-sm font-bold text-white">
            Keywords{" "}
            <span className="text-gray-500 font-normal text-xs">
              (optional)
            </span>
          </p>
        </div>
        <p className="text-xs text-gray-500 mb-2">
          Tags / topic markers shown to the user. Type then press Enter or
          comma to add.
        </p>
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {value.keywords.map((k) => (
              <span
                key={k}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium border border-amber-500/30"
              >
                {k}
                <button
                  type="button"
                  onClick={() => removeKeyword(k)}
                  className="hover:text-amber-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {value.keywords.length === 0 && (
              <span className="text-xs text-gray-600">No keywords yet.</span>
            )}
          </div>
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addKeyword(keywordInput);
              }
              if (
                e.key === "Backspace" &&
                keywordInput === "" &&
                value.keywords.length > 0
              ) {
                removeKeyword(value.keywords[value.keywords.length - 1]);
              }
            }}
            onBlur={() => addKeyword(keywordInput)}
            placeholder="Type a keyword and press Enter…"
            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Proof requirements */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <p className="text-sm font-bold text-white">Proof Required</p>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          What users must submit to complete this task. Submissions go to
          PENDING; admin approves to credit points.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <ProofToggle
            label="Proof URL"
            help="User submits a link as proof"
            checked={value.proofRequirements.url}
            onChange={(v) => setProof("url", v)}
          />
          <ProofToggle
            label="Screenshot"
            help="User uploads a screenshot URL"
            checked={value.proofRequirements.screenshot}
            onChange={(v) => setProof("screenshot", v)}
          />
          <ProofToggle
            label="Unique Key"
            help="User finds + types a key from article"
            checked={value.proofRequirements.uniqueKey}
            onChange={(v) => setProof("uniqueKey", v)}
            icon={<KeyRound className="w-3 h-3" />}
          />
        </div>
      </div>

      {/* Unique key fields (conditional) */}
      {value.proofRequirements.uniqueKey && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <p className="text-sm font-bold text-amber-300 inline-flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Unique Key Verification
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Expected Key Value <span className="text-red-400">*</span>
            </label>
            <input
              value={value.uniqueKey ?? ""}
              onChange={(e) => onChange({ ...value, uniqueKey: e.target.value })}
              placeholder="e.g. sunshine-2026"
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 font-mono"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Compared case-insensitive after trimming.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Hint shown to user
            </label>
            <textarea
              rows={2}
              value={value.uniqueKeyHint ?? ""}
              onChange={(e) =>
                onChange({ ...value, uniqueKeyHint: e.target.value })
              }
              placeholder="e.g. 'Find the secret word at the end of the article'"
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ProofToggle({
  label,
  help,
  checked,
  onChange,
  icon,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ReactNode;
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
        {icon}
        <span className="text-sm font-semibold text-white">{label}</span>
      </div>
      <span className="text-[11px] text-gray-500">{help}</span>
    </label>
  );
}
