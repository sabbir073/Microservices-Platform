"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Users,
  Lock,
  Crown,
  Loader2,
  Check,
  X,
  LogOut,
} from "lucide-react";
import { ListSkeleton } from "@/components/user/primitives/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";

interface PendingRequest {
  id: string;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
  createdAt: string;
}

interface GroupDetail {
  group: {
    id: string;
    name: string;
    description: string | null;
    type: "PUBLIC" | "PRIVATE";
    avatarUrl: string | null;
    bannerUrl: string | null;
    memberCount: number;
    ownerId: string;
    createdAt: string;
  };
  myRole: "OWNER" | "ADMIN" | "MEMBER" | null;
  isMember: boolean;
  isOwner: boolean;
  hasPendingRequest: boolean;
  pendingRequests: PendingRequest[];
}

interface Props {
  groupId: string;
  currentUserId: string;
}

export function GroupDetailView({ groupId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`);
      if (!res.ok) throw new Error(await res.text());
      const d = (await res.json()) as GroupDetail;
      setData(d);
    } catch (err) {
      toast.error("Couldn't load group", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const join = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/join`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      toast.success(d.status === "joined" ? "Joined!" : "Request sent");
      load();
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (!confirm("Leave this group?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/leave`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      toast.success("Left group");
      router.push("/social");
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
      setBusy(false);
    }
  };

  const decide = async (
    reqId: string,
    action: "approve" | "reject"
  ) => {
    try {
      const res = await fetch(
        `/api/groups/${groupId}/requests/${reqId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      toast.success(action === "approve" ? "Approved" : "Rejected");
      load();
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <ListSkeleton rows={5} />
      </div>
    );
  }

  if (!data) return null;

  const { group, myRole, isMember, isOwner, hasPendingRequest, pendingRequests } =
    data;

  return (
    <div className="space-y-4">
      <Link
        href="/social"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to community
      </Link>

      {/* Banner / header */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-800">
        <div className="h-28 bg-linear-to-br from-indigo-500 to-purple-600">
          {group.bannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={group.bannerUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
        </div>
        <div className="bg-gray-900 p-4 -mt-8 relative">
          <div className="flex items-end gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 border-4 border-gray-900 overflow-hidden flex items-center justify-center text-white shrink-0">
              {group.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={group.avatarUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <Users className="w-7 h-7" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white truncate">
                  {group.name}
                </h1>
                {group.type === "PRIVATE" && (
                  <Lock className="w-4 h-4 text-amber-400" />
                )}
                {isOwner && <Crown className="w-4 h-4 text-amber-400" />}
              </div>
              <p className="text-xs text-gray-500">
                {group.memberCount.toLocaleString()} member
                {group.memberCount === 1 ? "" : "s"} · created{" "}
                {format(new Date(group.createdAt), "MMM d, yyyy")}
              </p>
            </div>
          </div>
          {group.description && (
            <p className="text-sm text-gray-300 mt-3">{group.description}</p>
          )}
          <div className="mt-3 flex gap-2">
            {!isMember && !hasPendingRequest && (
              <button
                onClick={join}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {group.type === "PRIVATE" ? "Request to join" : "Join group"}
              </button>
            )}
            {hasPendingRequest && (
              <span className="px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-bold">
                Request pending
              </span>
            )}
            {isMember && !isOwner && (
              <button
                onClick={leave}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                Leave group
              </button>
            )}
            <span className="ml-auto text-xs text-gray-500 self-center">
              {myRole === "OWNER"
                ? "You own this group"
                : myRole === "ADMIN"
                ? "You are an admin"
                : myRole === "MEMBER"
                ? "Member"
                : null}
            </span>
          </div>
        </div>
      </div>

      {/* Pending requests (admin only) */}
      {pendingRequests.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm font-bold text-amber-400 mb-3">
            Pending Join Requests ({pendingRequests.length})
          </p>
          <div className="space-y-2">
            {pendingRequests.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-950 border border-gray-800"
              >
                <div className="w-9 h-9 rounded-full bg-gray-800 overflow-hidden flex items-center justify-center text-white font-bold shrink-0">
                  {r.userAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.userAvatar}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (r.userName ?? "U")[0]?.toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {r.userName ?? "Unknown"}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {format(new Date(r.createdAt), "PP p")}
                  </p>
                </div>
                <button
                  onClick={() => decide(r.id, "approve")}
                  className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  title="Approve"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => decide(r.id, "reject")}
                  className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  title="Reject"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group feed placeholder — group-filtered post feed */}
      <div className="rounded-xl border border-dashed border-gray-800 p-8 text-center">
        <p className="text-sm text-gray-400">
          {isMember
            ? "Group-filtered post feed coming up. For now, posts to this group appear in the main Feed tab tagged with the group."
            : "Join this group to see posts and contribute."}
        </p>
      </div>
    </div>
  );
}
