"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, AlertCircle, Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";

interface SettingField {
  key: string;
  label: string;
  description: string;
  type: string;
  value: unknown;
  defaultValue: unknown;
  id: string | null;
}

interface SettingsFormProps {
  category: string;
  settings: SettingField[];
  canEdit: boolean;
}

export function SettingsForm({ category, settings, canEdit }: SettingsFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<Record<string, unknown>>(
    settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, unknown>)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, settings: formData }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save settings");
      }

      setSuccess("Settings saved successfully");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const togglePassword = (key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderField = (setting: SettingField) => {
    const value = formData[setting.key];

    switch (setting.type) {
      case "text":
      case "email":
        return (
          <input
            type={setting.type}
            value={(value as string) || ""}
            onChange={(e) => updateField(setting.key, e.target.value)}
            disabled={!canEdit}
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        );

      case "password":
        return (
          <div className="relative">
            <input
              type={showPasswords[setting.key] ? "text" : "password"}
              value={(value as string) || ""}
              onChange={(e) => updateField(setting.key, e.target.value)}
              disabled={!canEdit}
              className="w-full px-4 py-2.5 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={() => togglePassword(setting.key)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              {showPasswords[setting.key] ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        );

      case "number":
        return (
          <input
            type="number"
            value={(value as number) ?? ""}
            onChange={(e) => updateField(setting.key, parseFloat(e.target.value) || 0)}
            disabled={!canEdit}
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        );

      case "textarea":
        return (
          <textarea
            value={(value as string) || ""}
            onChange={(e) => updateField(setting.key, e.target.value)}
            disabled={!canEdit}
            rows={3}
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        );

      case "boolean":
        return (
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => canEdit && updateField(setting.key, !(value as boolean))}
              disabled={!canEdit}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                value ? "bg-emerald-500" : "bg-gray-700"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  value ? "translate-x-5" : ""
                }`}
              />
            </button>
            <span className="ml-3 text-sm text-gray-400">
              {value ? "Enabled" : "Disabled"}
            </span>
          </div>
        );

      case "color":
        return (
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={(value as string) || "#EF4444"}
              onChange={(e) => updateField(setting.key, e.target.value)}
              disabled={!canEdit}
              className="w-12 h-12 rounded-lg cursor-pointer border-0 bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <input
              type="text"
              value={(value as string) || "#EF4444"}
              onChange={(e) => updateField(setting.key, e.target.value)}
              disabled={!canEdit}
              className="w-32 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        );

      case "select":
        return (
          <select
            value={(value as string) || ""}
            onChange={(e) => updateField(setting.key, e.target.value)}
            disabled={!canEdit}
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New York</option>
            <option value="America/Los_Angeles">America/Los Angeles</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Europe/Paris">Europe/Paris</option>
            <option value="Asia/Tokyo">Asia/Tokyo</option>
            <option value="Asia/Shanghai">Asia/Shanghai</option>
            <option value="Asia/Dubai">Asia/Dubai</option>
          </select>
        );

      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <p className="text-emerald-400">{success}</p>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
        {settings.map((setting) => (
          <div key={setting.key} className="p-6">
            <div className="md:flex md:items-start md:gap-8">
              <div className="md:w-1/3 mb-3 md:mb-0">
                <label className="font-medium text-white">{setting.label}</label>
                <p className="text-sm text-gray-500 mt-1">{setting.description}</p>
              </div>
              <div className="md:flex-1">{renderField(setting)}</div>
            </div>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="flex justify-end">
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
            Save Settings
          </button>
        </div>
      )}
    </form>
  );
}
