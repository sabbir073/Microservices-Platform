"use client";

import { useEffect, useState } from "react";
import {
  PlayCircle,
  Clock,
  Hourglass,
  Send,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import {
  type VideoConfig,
  detectProvider,
  getProviderMeta,
  formatDuration,
} from "@/lib/video-tasks";

interface Props {
  value: VideoConfig;
  onChange: (next: VideoConfig) => void;
}

export function VideoTaskBuilder({ value, onChange }: Props) {
  const [urlDraft, setUrlDraft] = useState(value.videoUrl);

  // Auto-detect provider whenever videoUrl changes
  useEffect(() => {
    const provider = detectProvider(value.videoUrl);
    if (provider !== value.provider) {
      onChange({ ...value, provider });
    }
  }, [value.videoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const setProof = (
    key: keyof VideoConfig["proofRequirements"],
    v: boolean
  ) => {
    onChange({
      ...value,
      proofRequirements: { ...value.proofRequirements, [key]: v },
    });
  };

  const meta = getProviderMeta(value.provider);

  return (
    <div className="space-y-6">
      {/* Video URL */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <PlayCircle className="w-4 h-4 text-red-400" />
          <p className="text-sm font-bold text-white">
            Video URL <span className="text-red-400">*</span>
          </p>
        </div>
        <p className="text-xs text-gray-500 mb-2">
          Supports YouTube, Facebook, Vimeo, and direct video files. Provider
          is detected automatically.
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onBlur={() => onChange({ ...value, videoUrl: urlDraft })}
            placeholder="https://www.youtube.com/watch?v=…  or  https://fb.watch/…"
            className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <span
            className={`inline-flex items-center gap-1 px-3 rounded-lg text-xs font-bold border ${meta.tone}`}
          >
            <span>{meta.emoji}</span>
            {meta.label}
          </span>
        </div>
      </div>

      {/* Watch time + warmup */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Clock className="w-4 h-4 text-blue-400" />
            <label className="text-sm font-bold text-white">
              Watch Time <span className="text-red-400">*</span>
            </label>
          </div>
          <input
            type="number"
            min={1}
            value={value.watchSeconds}
            onChange={(e) =>
              onChange({
                ...value,
                watchSeconds: Math.max(1, parseInt(e.target.value) || 1),
              })
            }
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            ≈ {formatDuration(value.watchSeconds)} — total time user must
            watch.
          </p>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Hourglass className="w-4 h-4 text-amber-400" />
            <label className="text-sm font-bold text-white">Warmup Time</label>
          </div>
          <input
            type="number"
            min={0}
            max={30}
            value={value.warmupSeconds}
            onChange={(e) =>
              onChange({
                ...value,
                warmupSeconds: Math.max(0, parseInt(e.target.value) || 0),
              })
            }
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Delay before timer starts (anti-bot, default 3).
          </p>
        </div>
      </div>

      {/* Auto-submit toggle */}
      <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-800 bg-gray-950 cursor-pointer hover:border-gray-700">
        <input
          type="checkbox"
          checked={value.autoSubmit}
          onChange={(e) => onChange({ ...value, autoSubmit: e.target.checked })}
          className="mt-0.5 rounded bg-gray-800 border-gray-600 text-indigo-500"
        />
        <div className="flex-1">
          <p className="text-sm font-bold text-white inline-flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-400" />
            Auto-submit
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            When watch time ends, submit fires automatically — no extra tap
            needed. Recommended for simple watch tasks.
          </p>
        </div>
      </label>

      {/* Proof requirements */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-amber-400" />
          <p className="text-sm font-bold text-white">Proof Required</p>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Most video tasks just need watch time, but you can require extra
          proof (e.g. unique key shown in video).
        </p>
        <div className="grid grid-cols-2 gap-2">
          <ProofToggle
            label="Screenshot"
            help="User uploads a screenshot URL after watching"
            checked={value.proofRequirements.screenshot}
            onChange={(v) => setProof("screenshot", v)}
          />
          <ProofToggle
            label="Unique Key"
            help="User types a code/word shown in the video"
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
              onChange={(e) =>
                onChange({ ...value, uniqueKey: e.target.value })
              }
              placeholder="e.g. EARNGPT-123"
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 font-mono"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Compared case-insensitive after trimming. Wrong keys are
              auto-rejected.
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
              placeholder="e.g. 'What word appeared at 0:30?'"
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
