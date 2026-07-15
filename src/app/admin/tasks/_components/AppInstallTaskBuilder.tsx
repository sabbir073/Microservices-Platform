"use client";

import { useState } from "react";
import { Loader2, Download, Plus, Trash2, Store } from "lucide-react";
import { toast } from "sonner";
import { ImageUploadField } from "@/components/admin/shared/ImageUploadField";
import { detectStore, type AppInstallConfig } from "@/lib/app-install-tasks";

const inp =
  "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-green-500";

export function AppInstallTaskBuilder({
  value,
  onChange,
  onAutofill,
}: {
  value: AppInstallConfig;
  onChange: (c: AppInstallConfig) => void;
  onAutofill?: (m: { name: string; description: string; logo: string }) => void;
}) {
  const [fetchUrl, setFetchUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof AppInstallConfig>(k: K, v: AppInstallConfig[K]) =>
    onChange({ ...value, [k]: v });

  const steps = value.steps ?? [];
  const setStep = (i: number, v: string) =>
    set("steps", steps.map((s, idx) => (idx === i ? v : s)));
  const addStep = () => set("steps", [...steps, ""]);
  const removeStep = (i: number) => set("steps", steps.filter((_, idx) => idx !== i));

  const fetchMeta = async () => {
    const url = fetchUrl.trim();
    if (!url) return;
    const store = detectStore(url);
    if (!store) {
      toast.error("Paste a Play Store or App Store link");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/tasks/fetch-app-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Fetch failed");
      onChange({
        ...value,
        appName: d.name || value.appName,
        description: d.description || value.description,
        appLogo: d.logo || value.appLogo,
        playStoreUrl: d.playStoreUrl ?? value.playStoreUrl,
        appStoreUrl: d.appStoreUrl ?? value.appStoreUrl,
      });
      onAutofill?.({ name: d.name ?? "", description: d.description ?? "", logo: d.logo ?? "" });
      toast.success("App details filled — edit anything you like");
    } catch (err) {
      toast.error("Couldn't fetch", {
        description: err instanceof Error ? err.message : "Fill fields manually",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Auto-fetch */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">
          Store link → auto-fetch
        </label>
        <div className="flex gap-2">
          <input
            value={fetchUrl}
            onChange={(e) => setFetchUrl(e.target.value)}
            placeholder="Paste Play Store or App Store link"
            className={inp}
          />
          <button
            type="button"
            onClick={fetchMeta}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50 shrink-0"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Fetch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-start">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">App icon</label>
          <ImageUploadField
            value={value.appLogo ?? ""}
            onChange={(u) => set("appLogo", u)}
            previewSize="square"
            title="Select app icon"
          />
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">App name *</label>
            <input value={value.appName} onChange={(e) => set("appName", e.target.value)} className={inp} placeholder="e.g. My Cool App" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Description</label>
            <textarea rows={2} value={value.description ?? ""} onChange={(e) => set("description", e.target.value)} className={`${inp} resize-none`} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 mb-1.5 inline-flex items-center gap-1"><Store className="w-3 h-3" /> Play Store URL</label>
          <input value={value.playStoreUrl ?? ""} onChange={(e) => set("playStoreUrl", e.target.value)} placeholder="https://play.google.com/…" className={inp} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1.5 inline-flex items-center gap-1"><Store className="w-3 h-3" /> App Store URL</label>
          <input value={value.appStoreUrl ?? ""} onChange={(e) => set("appStoreUrl", e.target.value)} placeholder="https://apps.apple.com/…" className={inp} />
        </div>
      </div>

      {/* Steps */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Instruction steps</label>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-2">
              <span className="w-6 h-9 grid place-items-center text-xs text-gray-500 shrink-0">{i + 1}.</span>
              <input value={s} onChange={(e) => setStep(i, e.target.value)} className={inp} placeholder="e.g. Open the app and sign up" />
              <button type="button" onClick={() => removeStep(i)} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-red-400 shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={addStep} className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-400 hover:text-green-300">
            <Plus className="w-4 h-4" /> Add step
          </button>
        </div>
      </div>

      {/* Auto-approve */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={!!value.autoApprove} onChange={(e) => set("autoApprove", e.target.checked)} className="w-4 h-4 accent-green-500" />
        <span className="text-sm text-gray-300">Auto-approve on screenshot submit (skip manual review)</span>
      </label>
    </div>
  );
}
