"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  X,
  Loader2,
  Save,
  Pencil,
  Trash2,
  Gift,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

interface Offerwall {
  id: string;
  provider: string;
  apiKey: string | null;
  secretKey: string | null;
  callbackUrl: string | null;
  isActive: boolean;
}

interface Props {
  initial: Offerwall[];
  canManage: boolean;
}

const KNOWN_PROVIDERS = [
  "CPX_RESEARCH",
  "THEOREM_REACH",
  "LOOTABLY",
  "ADGATE_MEDIA",
  "ADGEM",
  "BITLABS",
  "OFFERTORO",
  "AYET",
];

export function OfferwallsClient({ initial, canManage }: Props) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Offerwall | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggleActive = async (o: Offerwall) => {
    setBusyId(o.id);
    try {
      const res = await fetch(`/api/admin/offerwalls/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !o.isActive }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(o.isActive ? "Disabled" : "Enabled");
      router.refresh();
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (o: Offerwall) => {
    if (!confirm(`Delete ${o.provider} integration? This cannot be undone.`))
      return;
    setBusyId(o.id);
    try {
      const res = await fetch(`/api/admin/offerwalls/${o.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Deleted");
      router.refresh();
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Provider
          </button>
        </div>
      )}

      {initial.length === 0 ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-16 text-center">
          <Gift className="w-12 h-12 mx-auto mb-4 text-slate-600" />
          <h3 className="text-lg font-medium text-white mb-1">
            No offerwall providers
          </h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Add CPX Research, Theorem Reach, Lootably, AdGate Media, and others
            to start earning revenue from third-party offers.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {initial.map((o) => (
            <div
              key={o.id}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-white font-semibold">
                    {o.provider.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">
                    {o.apiKey
                      ? `${o.apiKey.slice(0, 4)}…${o.apiKey.slice(-4)}`
                      : "no key"}
                  </p>
                </div>
                <button
                  disabled={!canManage || busyId === o.id}
                  onClick={() => toggleActive(o)}
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    o.isActive
                      ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                      : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                  } ${canManage ? "cursor-pointer" : "cursor-default"} disabled:opacity-50`}
                >
                  ● {o.isActive ? "Active" : "Inactive"}
                </button>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p>
                  Postback URL:{" "}
                  <span className="text-slate-300 font-mono break-all">
                    {o.callbackUrl ?? "auto-generated"}
                  </span>
                </p>
              </div>
              {canManage && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setEditing(o)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white text-sm rounded hover:bg-slate-700"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Configure
                  </button>
                  <button
                    onClick={() => remove(o)}
                    disabled={busyId === o.id}
                    className="px-3 py-1.5 bg-red-500/10 text-red-400 text-sm rounded hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {busyId === o.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <ProviderModal
          existingProviders={initial.map((o) => o.provider)}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editing && (
        <ProviderModal
          provider={editing}
          existingProviders={initial.map((o) => o.provider)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function ProviderModal({
  provider,
  existingProviders,
  onClose,
}: {
  provider?: Offerwall;
  existingProviders: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isEdit = !!provider;
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [form, setForm] = useState({
    provider: provider?.provider ?? KNOWN_PROVIDERS[0],
    apiKey: provider?.apiKey ?? "",
    secretKey: provider?.secretKey ?? "",
    callbackUrl: provider?.callbackUrl ?? "",
    isActive: provider?.isActive ?? false,
  });

  const autoCallback =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/offerwalls/callback?provider=${form.provider}`
      : `/api/offerwalls/callback?provider=${form.provider}`;

  const submit = async () => {
    if (!form.provider.trim()) {
      toast.error("Provider required");
      return;
    }
    setBusy(true);
    try {
      const body = {
        ...form,
        callbackUrl: form.callbackUrl.trim() || null,
        apiKey: form.apiKey.trim() || null,
        secretKey: form.secretKey.trim() || null,
      };
      const res = await fetch(
        isEdit
          ? `/api/admin/offerwalls/${provider.id}`
          : "/api/admin/offerwalls",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      toast.success(isEdit ? "Provider updated" : "Provider added");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const copyCallback = async () => {
    try {
      await navigator.clipboard.writeText(autoCallback);
      toast.success("Postback URL copied");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const availableProviders = isEdit
    ? [form.provider]
    : [...KNOWN_PROVIDERS.filter((p) => !existingProviders.includes(p)), "CUSTOM"];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? `Configure ${provider.provider}` : "Add Offerwall Provider"}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          {!isEdit && (
            <Field label="Provider *">
              {availableProviders.includes("CUSTOM") ? (
                <select
                  value={form.provider}
                  onChange={(e) =>
                    setForm({ ...form, provider: e.target.value })
                  }
                  className={inp}
                >
                  {availableProviders.map((p) => (
                    <option key={p} value={p}>
                      {p === "CUSTOM" ? "Custom…" : p.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-400">
                  All known providers already added.
                </p>
              )}
              {form.provider === "CUSTOM" && (
                <input
                  className={inp + " mt-2"}
                  placeholder="Custom provider key (e.g. MY_NETWORK)"
                  onChange={(e) =>
                    setForm({
                      ...form,
                      provider: e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9_]/g, "_"),
                    })
                  }
                />
              )}
            </Field>
          )}
          <Field label="API Key">
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                className={inp + " pr-10 font-mono"}
                placeholder="sk_…"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white"
              >
                {showApiKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </Field>
          <Field label="Secret / Postback Secret">
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                value={form.secretKey}
                onChange={(e) =>
                  setForm({ ...form, secretKey: e.target.value })
                }
                className={inp + " pr-10 font-mono"}
                placeholder="…"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white"
              >
                {showSecret ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </Field>
          <Field label="Postback URL (callback)">
            <div className="flex gap-2">
              <input
                value={form.callbackUrl}
                onChange={(e) =>
                  setForm({ ...form, callbackUrl: e.target.value })
                }
                className={inp + " flex-1 font-mono text-xs"}
                placeholder={autoCallback}
              />
              <button
                type="button"
                onClick={copyCallback}
                className="px-3 py-2 bg-slate-700 text-white text-xs rounded-lg hover:bg-slate-600 inline-flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Leave blank to use auto-generated:{" "}
              <span className="font-mono text-slate-400">{autoCallback}</span>
            </p>
          </Field>
          <label className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-950/50 border border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded bg-slate-800 border-slate-600 text-blue-500"
            />
            <div className="flex-1">
              <p className="text-sm text-white">Active</p>
              <p className="text-xs text-slate-500">
                Show this offerwall to end users.
              </p>
            </div>
          </label>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isEdit ? "Save" : "Add Provider"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inp =
  "w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
