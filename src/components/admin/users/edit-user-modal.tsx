"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface EditUserData {
  id: string;
  // Account
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  username: string | null;
  phone: string | null;
  role: string;
  status: string;
  // Balance / progression
  level: number;
  xp: number;
  pointsBalance: number;
  cashBalance: number;
  packageTier: string;
  kycStatus: string;
  isBlueVerified: boolean;
  // Personal
  gender: string | null;
  dateOfBirth: Date | null;
  nidNumber: string | null;
  profession: string | null;
  maritalStatus: string | null;
  studyLevel: string | null;
  nationality: string | null;
  bloodGroup: string | null;
  secondaryEmail: string | null;
  secondaryPhone: string | null;
  bio: string | null;
  // Address
  country: string | null;
  region: string | null;
  division: string | null;
  subDivision: string | null;
  district: string | null;
  subDistrict: string | null;
  city: string | null;
  village: string | null;
  street: string | null;
  postalCode: string | null;
}

interface EditUserModalProps {
  user: EditUserData;
  open: boolean;
  onClose: () => void;
  isSuperAdmin: boolean;
}

type Tab = "account" | "balance" | "personal" | "address";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "account", label: "Account" },
  { id: "balance", label: "Balance & Tier" },
  { id: "personal", label: "Personal Info" },
  { id: "address", label: "Address" },
];

const PROFESSIONS = [
  "Student",
  "Software Engineer",
  "Designer",
  "Teacher",
  "Doctor",
  "Lawyer",
  "Business Owner",
  "Freelancer",
  "Marketing",
  "Sales",
  "Accountant",
  "Engineer",
  "Healthcare",
  "Retail",
  "Other",
];

export function EditUserModal({
  user,
  open,
  onClose,
  isSuperAdmin,
}: EditUserModalProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("account");
  const [submitting, setSubmitting] = useState(false);

  // Form state — initialized from user, all fields strings (or "" / undefined)
  const [form, setForm] = useState({
    name: user.name ?? "",
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    email: user.email,
    username: user.username ?? "",
    password: "", // empty = keep
    phone: user.phone ?? "",
    role: user.role,
    status: user.status,

    level: user.level,
    xp: user.xp,
    pointsBalance: user.pointsBalance,
    cashBalance: user.cashBalance,
    packageTier: user.packageTier,
    kycStatus: user.kycStatus,
    isBlueVerified: user.isBlueVerified,

    gender: user.gender ?? "",
    dateOfBirth: user.dateOfBirth
      ? new Date(user.dateOfBirth).toISOString().slice(0, 10)
      : "",
    nidNumber: user.nidNumber ?? "",
    profession: user.profession ?? "",
    maritalStatus: user.maritalStatus ?? "",
    studyLevel: user.studyLevel ?? "",
    nationality: user.nationality ?? "",
    bloodGroup: user.bloodGroup ?? "",
    secondaryEmail: user.secondaryEmail ?? "",
    secondaryPhone: user.secondaryPhone ?? "",
    bio: user.bio ?? "",

    country: user.country ?? "",
    region: user.region ?? "",
    division: user.division ?? "",
    subDivision: user.subDivision ?? "",
    district: user.district ?? "",
    subDistrict: user.subDistrict ?? "",
    city: user.city ?? "",
    village: user.village ?? "",
    street: user.street ?? "",
    postalCode: user.postalCode ?? "",
  });

  if (!open) return null;

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Build payload — only send changed/non-empty values to keep diff small
      const payload: Record<string, unknown> = {};
      // Account
      if (form.name !== (user.name ?? "")) payload.name = form.name || null;
      if (form.firstName !== (user.firstName ?? ""))
        payload.firstName = form.firstName || null;
      if (form.lastName !== (user.lastName ?? ""))
        payload.lastName = form.lastName || null;
      if (form.email !== user.email) payload.email = form.email;
      if (form.username !== (user.username ?? ""))
        payload.username = form.username || null;
      if (form.password) payload.password = form.password;
      if (form.phone !== (user.phone ?? "")) payload.phone = form.phone || null;
      if (form.role !== user.role) payload.role = form.role;
      if (form.status !== user.status) payload.status = form.status;
      // Balance
      if (form.level !== user.level) payload.level = Number(form.level);
      if (form.xp !== user.xp) payload.xp = Number(form.xp);
      if (form.pointsBalance !== user.pointsBalance)
        payload.pointsBalance = Number(form.pointsBalance);
      if (form.cashBalance !== user.cashBalance)
        payload.cashBalance = Number(form.cashBalance);
      if (form.packageTier !== user.packageTier)
        payload.packageTier = form.packageTier;
      if (form.kycStatus !== user.kycStatus)
        payload.kycStatus = form.kycStatus;
      if (form.isBlueVerified !== user.isBlueVerified)
        payload.isBlueVerified = form.isBlueVerified;
      // Personal
      if (form.gender !== (user.gender ?? ""))
        payload.gender = form.gender || null;
      const newDob = form.dateOfBirth
        ? new Date(form.dateOfBirth).toISOString()
        : null;
      const oldDob = user.dateOfBirth
        ? new Date(user.dateOfBirth).toISOString()
        : null;
      if (newDob !== oldDob) payload.dateOfBirth = newDob;
      if (form.nidNumber !== (user.nidNumber ?? ""))
        payload.nidNumber = form.nidNumber || null;
      if (form.profession !== (user.profession ?? ""))
        payload.profession = form.profession || null;
      if (form.maritalStatus !== (user.maritalStatus ?? ""))
        payload.maritalStatus = form.maritalStatus || null;
      if (form.studyLevel !== (user.studyLevel ?? ""))
        payload.studyLevel = form.studyLevel || null;
      if (form.nationality !== (user.nationality ?? ""))
        payload.nationality = form.nationality || null;
      if (form.bloodGroup !== (user.bloodGroup ?? ""))
        payload.bloodGroup = form.bloodGroup || null;
      if (form.secondaryEmail !== (user.secondaryEmail ?? ""))
        payload.secondaryEmail = form.secondaryEmail || null;
      if (form.secondaryPhone !== (user.secondaryPhone ?? ""))
        payload.secondaryPhone = form.secondaryPhone || null;
      if (form.bio !== (user.bio ?? "")) payload.bio = form.bio || null;
      // Address
      if (form.country !== (user.country ?? ""))
        payload.country = form.country || null;
      if (form.region !== (user.region ?? ""))
        payload.region = form.region || null;
      if (form.division !== (user.division ?? ""))
        payload.division = form.division || null;
      if (form.subDivision !== (user.subDivision ?? ""))
        payload.subDivision = form.subDivision || null;
      if (form.district !== (user.district ?? ""))
        payload.district = form.district || null;
      if (form.subDistrict !== (user.subDistrict ?? ""))
        payload.subDistrict = form.subDistrict || null;
      if (form.city !== (user.city ?? "")) payload.city = form.city || null;
      if (form.village !== (user.village ?? ""))
        payload.village = form.village || null;
      if (form.street !== (user.street ?? ""))
        payload.street = form.street || null;
      if (form.postalCode !== (user.postalCode ?? ""))
        payload.postalCode = form.postalCode || null;

      if (Object.keys(payload).length === 0) {
        toast.info("No changes to save");
        setSubmitting(false);
        return;
      }

      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      toast.success("User updated successfully");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error("Failed to update user", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-3xl mx-4 max-h-[92vh] flex flex-col">
        {/* Sticky header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white">Edit User</h2>
            <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 border-b border-slate-700 overflow-x-auto shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors",
                tab === t.id
                  ? "bg-slate-900 text-white border-b-2 border-blue-500"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-4"
        >
          {tab === "account" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="First Name">
                  <input
                    value={form.firstName}
                    onChange={(e) => set("firstName", e.target.value)}
                    className={fieldCls}
                  />
                </Field>
                <Field label="Last Name">
                  <input
                    value={form.lastName}
                    onChange={(e) => set("lastName", e.target.value)}
                    className={fieldCls}
                  />
                </Field>
              </div>
              <Field label="Display Name">
                <input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className={fieldCls}
                />
              </Field>
              <Field label="Username">
                <input
                  value={form.username}
                  onChange={(e) => set("username", e.target.value)}
                  className={fieldCls}
                />
              </Field>
              <Field label="Email *">
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className={fieldCls}
                />
              </Field>
              <Field label="Password (leave empty to keep current)" hint="Min 6 chars">
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  className={fieldCls}
                  minLength={6}
                  placeholder="••••••"
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className={fieldCls}
                />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Role">
                  <select
                    value={form.role}
                    onChange={(e) => set("role", e.target.value)}
                    className={fieldCls}
                    disabled={!isSuperAdmin && user.role === "SUPER_ADMIN"}
                  >
                    <option value="USER">User</option>
                    <option value="MODERATOR">Moderator</option>
                    <option value="SUPPORT_ADMIN">Support Admin</option>
                    <option value="CONTENT_ADMIN">Content Admin</option>
                    <option value="MARKETING_ADMIN">Marketing Admin</option>
                    <option value="FINANCE_ADMIN">Finance Admin</option>
                    {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                    className={fieldCls}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="PENDING_VERIFICATION">Pending</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="BANNED">Banned</option>
                  </select>
                </Field>
              </div>
            </div>
          )}

          {tab === "balance" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Level (1-100)">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.level}
                    onChange={(e) => set("level", Number(e.target.value))}
                    className={fieldCls}
                  />
                </Field>
                <Field label="XP">
                  <input
                    type="number"
                    min={0}
                    value={form.xp}
                    onChange={(e) => set("xp", Number(e.target.value))}
                    className={fieldCls}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Points Balance">
                  <input
                    type="number"
                    min={0}
                    value={form.pointsBalance}
                    onChange={(e) =>
                      set("pointsBalance", Number(e.target.value))
                    }
                    className={fieldCls}
                  />
                </Field>
                <Field label="Cash Balance ($)">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.cashBalance}
                    onChange={(e) =>
                      set("cashBalance", Number(e.target.value))
                    }
                    className={fieldCls}
                  />
                </Field>
              </div>
              <p className="text-xs text-slate-500">
                Tip: For audited adjustments, use the ± buttons on the user
                detail page (creates a transaction record).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Package Tier">
                  <select
                    value={form.packageTier}
                    onChange={(e) => set("packageTier", e.target.value)}
                    className={fieldCls}
                  >
                    <option value="FREE">Free</option>
                    <option value="STARTER">Starter</option>
                    <option value="PRO">Pro</option>
                    <option value="ELITE">Elite</option>
                    <option value="VIP">VIP</option>
                  </select>
                </Field>
                <Field label="KYC Status">
                  <select
                    value={form.kycStatus}
                    onChange={(e) => set("kycStatus", e.target.value)}
                    className={fieldCls}
                  >
                    <option value="NOT_SUBMITTED">Not Submitted</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved (Verified)</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </Field>
              </div>
              <label className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer hover:border-slate-600">
                <input
                  type="checkbox"
                  checked={form.isBlueVerified}
                  onChange={(e) => set("isBlueVerified", e.target.checked)}
                  className="rounded bg-slate-800 border-slate-600 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-white">
                  🔵 Blue Badge Verified
                </span>
                <span className="ml-auto text-xs text-slate-500">
                  Visible next to user&apos;s name
                </span>
              </label>
            </div>
          )}

          {tab === "personal" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Gender">
                  <select
                    value={form.gender}
                    onChange={(e) => set("gender", e.target.value)}
                    className={fieldCls}
                  >
                    <option value="">—</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>
                <Field label="Date of Birth">
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => set("dateOfBirth", e.target.value)}
                    className={fieldCls}
                  />
                </Field>
              </div>
              <Field label="National ID Number">
                <input
                  value={form.nidNumber}
                  onChange={(e) => set("nidNumber", e.target.value)}
                  className={fieldCls}
                />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Profession">
                  <select
                    value={form.profession}
                    onChange={(e) => set("profession", e.target.value)}
                    className={fieldCls}
                  >
                    <option value="">—</option>
                    {PROFESSIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Marital Status">
                  <select
                    value={form.maritalStatus}
                    onChange={(e) => set("maritalStatus", e.target.value)}
                    className={fieldCls}
                  >
                    <option value="">—</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Divorced">Divorced</option>
                    <option value="Widowed">Widowed</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Study Level">
                  <select
                    value={form.studyLevel}
                    onChange={(e) => set("studyLevel", e.target.value)}
                    className={fieldCls}
                  >
                    <option value="">—</option>
                    <option value="School">School</option>
                    <option value="College">College</option>
                    <option value="University">University</option>
                    <option value="Not study right now">Not study right now</option>
                  </select>
                </Field>
                <Field label="Nationality">
                  <input
                    value={form.nationality}
                    onChange={(e) => set("nationality", e.target.value)}
                    className={fieldCls}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Blood Group">
                  <select
                    value={form.bloodGroup}
                    onChange={(e) => set("bloodGroup", e.target.value)}
                    className={fieldCls}
                  >
                    <option value="">—</option>
                    <option>A+</option>
                    <option>A-</option>
                    <option>B+</option>
                    <option>B-</option>
                    <option>AB+</option>
                    <option>AB-</option>
                    <option>O+</option>
                    <option>O-</option>
                  </select>
                </Field>
                <Field label="Secondary Email">
                  <input
                    type="email"
                    value={form.secondaryEmail}
                    onChange={(e) => set("secondaryEmail", e.target.value)}
                    className={fieldCls}
                  />
                </Field>
              </div>
              <Field label="Secondary Phone">
                <input
                  type="tel"
                  value={form.secondaryPhone}
                  onChange={(e) => set("secondaryPhone", e.target.value)}
                  className={fieldCls}
                />
              </Field>
              <Field label="Bio">
                <textarea
                  rows={3}
                  value={form.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  className={fieldCls + " resize-none"}
                  maxLength={500}
                />
              </Field>
            </div>
          )}

          {tab === "address" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Country">
                  <input
                    value={form.country}
                    onChange={(e) => set("country", e.target.value)}
                    className={fieldCls}
                    placeholder="Bangladesh"
                  />
                </Field>
                <Field label="Region">
                  <input
                    value={form.region}
                    onChange={(e) => set("region", e.target.value)}
                    className={fieldCls}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Division">
                  <input
                    value={form.division}
                    onChange={(e) => set("division", e.target.value)}
                    className={fieldCls}
                  />
                </Field>
                <Field label="Sub Division">
                  <input
                    value={form.subDivision}
                    onChange={(e) => set("subDivision", e.target.value)}
                    className={fieldCls}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="District">
                  <input
                    value={form.district}
                    onChange={(e) => set("district", e.target.value)}
                    className={fieldCls}
                  />
                </Field>
                <Field label="Sub District">
                  <input
                    value={form.subDistrict}
                    onChange={(e) => set("subDistrict", e.target.value)}
                    className={fieldCls}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="City">
                  <input
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    className={fieldCls}
                  />
                </Field>
                <Field label="Village">
                  <input
                    value={form.village}
                    onChange={(e) => set("village", e.target.value)}
                    className={fieldCls}
                  />
                </Field>
              </div>
              <Field label="Street">
                <input
                  value={form.street}
                  onChange={(e) => set("street", e.target.value)}
                  className={fieldCls}
                />
              </Field>
              <Field label="Postal Code">
                <input
                  value={form.postalCode}
                  onChange={(e) => set("postalCode", e.target.value)}
                  className={fieldCls}
                />
              </Field>
            </div>
          )}
        </form>

        {/* Sticky footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-700 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

const fieldCls =
  "w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">
        {label}
        {hint && <span className="text-slate-600 ml-2">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
