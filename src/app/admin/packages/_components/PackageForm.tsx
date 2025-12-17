"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  X,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  DollarSign,
  Clock,
  Gift,
  Sparkles,
} from "lucide-react";

interface PackageFormProps {
  pkg: {
    id: string;
    tier: string;
    name: string;
    description: string | null;
    priceMonthly: number;
    priceYearly: number | null;
    dailyTaskLimit: number;
    withdrawalFee: number;
    minWithdrawal: number;
    features: string[];
    referralBonus: number;
    xpMultiplier: number;
    isActive: boolean;
    order: number;
  };
}

export function PackageForm({ pkg }: PackageFormProps) {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: pkg.name,
    description: pkg.description || "",
    priceMonthly: pkg.priceMonthly,
    priceYearly: pkg.priceYearly || 0,
    dailyTaskLimit: pkg.dailyTaskLimit,
    withdrawalFee: pkg.withdrawalFee,
    minWithdrawal: pkg.minWithdrawal,
    referralBonus: pkg.referralBonus,
    xpMultiplier: pkg.xpMultiplier,
    isActive: pkg.isActive,
    order: pkg.order,
  });

  const [features, setFeatures] = useState<string[]>(pkg.features || []);
  const [newFeature, setNewFeature] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/packages/${pkg.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          features,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update package");
      }

      router.push("/admin/packages");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setFeatures([...features, newFeature.trim()]);
      setNewFeature("");
    }
  };

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white">Basic Information</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Package Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Tier (Read-only)
            </label>
            <input
              type="text"
              value={pkg.tier}
              disabled
              className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-500 cursor-not-allowed"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Description
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Package description..."
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-indigo-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-400">
              Package is Active
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Display Order
            </label>
            <input
              type="number"
              min="0"
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          Pricing
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Monthly Price ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.priceMonthly}
              onChange={(e) =>
                setFormData({ ...formData, priceMonthly: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Yearly Price ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.priceYearly}
              onChange={(e) =>
                setFormData({ ...formData, priceYearly: parseFloat(e.target.value) || 0 })
              }
              placeholder="Leave 0 for monthly only"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
            />
            {formData.priceYearly > 0 && formData.priceMonthly > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                {Math.round((1 - formData.priceYearly / (formData.priceMonthly * 12)) * 100)}% discount vs monthly
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Limits & Settings */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          Limits & Settings
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Daily Task Limit
            </label>
            <input
              type="number"
              min="-1"
              value={formData.dailyTaskLimit}
              onChange={(e) =>
                setFormData({ ...formData, dailyTaskLimit: parseInt(e.target.value) || 0 })
              }
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
            <p className="text-xs text-gray-500 mt-1">-1 for unlimited</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Min Withdrawal ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.minWithdrawal}
              onChange={(e) =>
                setFormData({ ...formData, minWithdrawal: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Withdrawal Fee (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={formData.withdrawalFee}
              onChange={(e) =>
                setFormData({ ...formData, withdrawalFee: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              XP Multiplier
            </label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={formData.xpMultiplier}
              onChange={(e) =>
                setFormData({ ...formData, xpMultiplier: parseFloat(e.target.value) || 1 })
              }
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>
        </div>
      </div>

      {/* Referral Settings */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Gift className="w-5 h-5 text-pink-400" />
          Referral Settings
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Referral Bonus (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={formData.referralBonus}
              onChange={(e) =>
                setFormData({ ...formData, referralBonus: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Extra bonus for referrals with this package
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          Features
        </h2>

        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={newFeature}
              onChange={(e) => setNewFeature(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addFeature();
                }
              }}
              placeholder="Add a feature..."
              className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500"
            />
            <button
              type="button"
              onClick={addFeature}
              className="px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {features.length > 0 ? (
            <ul className="space-y-2">
              {features.map((feature, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                >
                  <span className="text-gray-300">{feature}</span>
                  <button
                    type="button"
                    onClick={() => removeFeature(index)}
                    className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-gray-500 py-4">No features added yet</p>
          )}
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex items-center justify-between pt-4">
        <button
          type="button"
          onClick={() => router.push("/admin/packages")}
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
          Save Changes
        </button>
      </div>
    </form>
  );
}
