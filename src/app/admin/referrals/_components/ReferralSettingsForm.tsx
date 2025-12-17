"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  X,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";

interface ReferralLevel {
  id: string;
  level: number;
  commissionRate: number;
  description: string | null;
  isActive: boolean;
}

interface ReferralSettingsFormProps {
  levels: ReferralLevel[];
  isNew: boolean;
}

export function ReferralSettingsForm({ levels, isNew }: ReferralSettingsFormProps) {
  const router = useRouter();

  const [formData, setFormData] = useState<ReferralLevel[]>(
    levels.map((l) => ({
      id: l.id,
      level: l.level,
      commissionRate: l.commissionRate,
      description: l.description,
      isActive: l.isActive,
    }))
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/referrals/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levels: formData }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save settings");
      }

      router.push("/admin/referrals");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const updateLevel = (index: number, field: keyof ReferralLevel, value: unknown) => {
    const newData = [...formData];
    if (field === "commissionRate") {
      newData[index].commissionRate = value as number;
    } else if (field === "description") {
      newData[index].description = value as string | null;
    } else if (field === "isActive") {
      newData[index].isActive = value as boolean;
    }
    setFormData(newData);
  };

  const totalCommission = formData.reduce((sum, level) => sum + level.commissionRate, 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Info */}
      <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-400 mt-0.5" />
        <div>
          <p className="text-indigo-400 font-medium">10-Level MLM Commission System</p>
          <p className="text-sm text-gray-400 mt-1">
            When a user completes a task, their referrer gets Level 1 commission, their referrer&apos;s
            referrer gets Level 2 commission, and so on up to Level 10.
          </p>
        </div>
      </div>

      {/* Commission Levels */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Commission Rates</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Total:</span>
            <span
              className={`text-lg font-bold ${
                totalCommission > 100 ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {totalCommission.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="grid gap-4">
          {formData.map((level, index) => (
            <div
              key={level.id}
              className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg"
            >
              <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-indigo-500/10 rounded-xl">
                <span className="text-lg font-bold text-indigo-400">L{level.level}</span>
              </div>

              <div className="flex-1 grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={level.commissionRate}
                    onChange={(e) =>
                      updateLevel(index, "commissionRate", parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={level.description || ""}
                    onChange={(e) => updateLevel(index, "description", e.target.value)}
                    placeholder={`Level ${level.level} referral`}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={level.isActive}
                      onChange={(e) => updateLevel(index, "isActive", e.target.checked)}
                      className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-indigo-500"
                    />
                    <span className="text-sm text-gray-400">Active</span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>

        {totalCommission > 100 && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">
              Warning: Total commission exceeds 100%. This may result in losses on each referral.
            </p>
          </div>
        )}
      </div>

      {/* Quick Presets */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Presets</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setFormData(
                formData.map((l) => ({
                  ...l,
                  commissionRate: l.level <= 3 ? 10 - (l.level - 1) * 2 : l.level <= 6 ? 3 : 1,
                }))
              );
            }}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            Aggressive (10-8-6-3-3-3-1-1-1-1)
          </button>
          <button
            type="button"
            onClick={() => {
              setFormData(
                formData.map((l) => ({
                  ...l,
                  commissionRate: Math.max(1, 6 - Math.floor((l.level - 1) / 2)),
                }))
              );
            }}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            Balanced (6-6-5-5-4-4-3-3-2-2)
          </button>
          <button
            type="button"
            onClick={() => {
              setFormData(
                formData.map((l) => ({
                  ...l,
                  commissionRate: 3,
                }))
              );
            }}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            Flat (3% all levels)
          </button>
          <button
            type="button"
            onClick={() => {
              setFormData(
                formData.map((l) => ({
                  ...l,
                  commissionRate: 0,
                }))
              );
            }}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={() => router.push("/admin/referrals")}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
          Cancel
        </button>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {isNew ? "Create Settings" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
