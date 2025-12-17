"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Save,
  AlertCircle,
  Loader2,
  CheckCircle,
  UserMinus,
  AlertTriangle,
} from "lucide-react";
import {
  type UserRole,
  ADMIN_ROLES,
  ROLE_CONFIG,
  ROLE_PERMISSIONS,
} from "@/lib/rbac";

interface AdminRoleFormProps {
  adminId: string;
  currentRole: UserRole;
  adminName: string;
  canModify: boolean;
}

export function AdminRoleForm({
  adminId,
  currentRole,
  adminName,
  canModify,
}: AdminRoleFormProps) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const handleRoleUpdate = async () => {
    if (!canModify || selectedRole === currentRole) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/access/${adminId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update role");
      }

      setSuccess("Role updated successfully");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAdmin = async () => {
    if (!canModify) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/access/${adminId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "USER" }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove admin access");
      }

      setSuccess("Admin access revoked");
      setTimeout(() => {
        router.push("/admin/access");
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setShowRemoveConfirm(false);
    }
  };

  const selectedPermissions = ROLE_PERMISSIONS[selectedRole] || [];

  return (
    <div className="space-y-6">
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

      {/* Role Selection */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Select Role</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {ADMIN_ROLES.filter((r) => r !== "USER").map((role) => {
            const config = ROLE_CONFIG[role];
            const isSelected = selectedRole === role;
            const permissions = ROLE_PERMISSIONS[role] || [];

            return (
              <button
                key={role}
                type="button"
                onClick={() => canModify && setSelectedRole(role)}
                disabled={!canModify}
                className={`p-4 rounded-lg border text-left transition-colors ${
                  isSelected
                    ? `${config.bgColor} border-indigo-500`
                    : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                } ${!canModify ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Shield className={`w-5 h-5 ${config.color}`} />
                  <span className={`font-medium ${isSelected ? config.color : "text-white"}`}>
                    {config.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  {role === "SUPER_ADMIN" && "Full access to all features"}
                  {role === "FINANCE_ADMIN" && "Manage financials and withdrawals"}
                  {role === "CONTENT_ADMIN" && "Create and manage tasks"}
                  {role === "SUPPORT_ADMIN" && "Handle user support and KYC"}
                  {role === "MARKETING_ADMIN" && "Manage notifications and analytics"}
                  {role === "MODERATOR" && "Review task submissions"}
                </p>
                <p className="text-xs text-gray-600">
                  {permissions.length} permission{permissions.length !== 1 ? "s" : ""}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Permission Preview */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Permissions for {ROLE_CONFIG[selectedRole].label}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {selectedPermissions.length > 0 ? (
            selectedPermissions.map((permission) => (
              <div
                key={permission}
                className="px-3 py-2 bg-gray-800/50 rounded-lg text-sm text-gray-400 flex items-center gap-2"
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                {permission}
              </div>
            ))
          ) : (
            <p className="text-gray-500 col-span-full">No permissions for this role</p>
          )}
        </div>
      </div>

      {/* Actions */}
      {canModify && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowRemoveConfirm(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            <UserMinus className="w-5 h-5" />
            Remove Admin Access
          </button>

          <button
            type="button"
            onClick={handleRoleUpdate}
            disabled={loading || selectedRole === currentRole}
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
      )}

      {/* Remove Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Remove Admin Access</h3>
            </div>
            <p className="text-gray-400 mb-6">
              Are you sure you want to revoke admin access for <strong className="text-white">{adminName}</strong>?
              They will lose all administrative permissions and be demoted to a regular user.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(false)}
                disabled={loading}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveAdmin}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserMinus className="w-4 h-4" />
                )}
                Remove Access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
