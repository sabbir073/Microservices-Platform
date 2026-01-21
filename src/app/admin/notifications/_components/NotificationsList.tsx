"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Users,
  Megaphone,
  Wallet,
  Trophy,
  Ticket,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Check,
  Trash2,
  CheckCheck,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
}

interface NotificationsListProps {
  notifications: Notification[];
  canSend: boolean;
}

interface DeleteModalProps {
  isOpen: boolean;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function DeleteConfirmModal({ isOpen, count, onConfirm, onCancel, isLoading }: DeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-red-500/10 rounded-full">
            <Trash2 className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Delete Notification{count > 1 ? 's' : ''}</h3>
            <p className="text-sm text-gray-400">This action cannot be undone</p>
          </div>
        </div>

        <p className="text-gray-300 mb-6">
          Are you sure you want to delete {count} notification{count > 1 ? 's' : ''}?
          This will permanently remove {count > 1 ? 'them' : 'it'} from the system.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const NOTIFICATION_TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof Bell; color: string }
> = {
  SYSTEM: { label: "System", icon: AlertCircle, color: "text-gray-400" },
  TASK: { label: "Task", icon: CheckCircle, color: "text-blue-400" },
  WALLET: { label: "Wallet", icon: Wallet, color: "text-emerald-400" },
  REFERRAL: { label: "Referral", icon: Users, color: "text-purple-400" },
  PROMOTION: { label: "Promotion", icon: Megaphone, color: "text-amber-400" },
  ACHIEVEMENT: { label: "Achievement", icon: Trophy, color: "text-yellow-400" },
  LOTTERY: { label: "Lottery", icon: Ticket, color: "text-pink-400" },
  SOCIAL: { label: "Social", icon: MessageSquare, color: "text-indigo-400" },
};

export function NotificationsList({
  notifications: initialNotifications,
  canSend,
}: NotificationsListProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; ids: string[] }>({
    isOpen: false,
    ids: [],
  });

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map((n) => n.id)));
    }
  };

  const handleMarkAsRead = async (notificationIds: string[]) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            notificationIds.includes(n.id) ? { ...n, isRead: true } : n
          )
        );
        setSelectedIds(new Set());
        router.refresh();
      }
    } catch (error) {
      console.error("Error marking as read:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const openDeleteModal = (notificationIds: string[]) => {
    setDeleteModal({ isOpen: true, ids: notificationIds });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, ids: [] });
  };

  const handleDelete = async () => {
    const notificationIds = deleteModal.ids;
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/notifications/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.filter((n) => !notificationIds.includes(n.id))
        );
        setSelectedIds(new Set());
        closeDeleteModal();
        router.refresh();
      }
    } catch (error) {
      console.error("Error deleting notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const unreadSelectedCount = notifications.filter(
    (n) => selectedIds.has(n.id) && !n.isRead
  ).length;

  if (notifications.length === 0) {
    return (
      <div className="p-16 text-center">
        <Bell className="w-12 h-12 mx-auto mb-4 text-gray-600" />
        <h3 className="text-lg font-medium text-white mb-2">No notifications</h3>
        <p className="text-gray-400">Sent notifications will appear here</p>
      </div>
    );
  }

  return (
    <>
      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        count={deleteModal.ids.length}
        onConfirm={handleDelete}
        onCancel={closeDeleteModal}
        isLoading={isLoading}
      />

      <div>
        {/* Bulk Actions Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-800/30">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedIds.size === notifications.length && notifications.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-indigo-500 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-400">
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : "Select all"}
            </span>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              {unreadSelectedCount > 0 && (
                <button
                  onClick={() => handleMarkAsRead(Array.from(selectedIds))}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark as read
                </button>
              )}
              <button
                onClick={() => openDeleteModal(Array.from(selectedIds))}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Notifications List */}
        <div className="divide-y divide-gray-800">
          {notifications.map((notification) => {
            const typeConfig =
              NOTIFICATION_TYPE_CONFIG[notification.type] ||
              NOTIFICATION_TYPE_CONFIG.SYSTEM;
            const Icon = typeConfig.icon;
            const isSelected = selectedIds.has(notification.id);

            return (
              <div
                key={notification.id}
                className={cn(
                  "p-4 hover:bg-gray-800/50 transition-colors",
                  isSelected && "bg-indigo-500/5"
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(notification.id)}
                    className="mt-1 w-4 h-4 rounded border-gray-700 bg-gray-900 text-indigo-500 focus:ring-indigo-500"
                  />

                  {/* Icon */}
                  <div className={`p-2 rounded-lg bg-gray-800 ${typeConfig.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-medium text-white">
                          {notification.title}
                        </h3>
                        <p className="text-sm text-gray-400 mt-0.5">
                          {notification.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            notification.isRead
                              ? "bg-gray-700 text-gray-400"
                              : "bg-indigo-500/10 text-indigo-400"
                          }`}
                        >
                          {notification.isRead ? "Read" : "Unread"}
                        </span>

                        {/* Individual Actions */}
                        <div className="flex items-center gap-1">
                          {!notification.isRead && (
                            <button
                              onClick={() => handleMarkAsRead([notification.id])}
                              disabled={isLoading}
                              className="p-1.5 text-gray-400 hover:text-indigo-400 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openDeleteModal([notification.id])}
                            disabled={isLoading}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>To: {notification.user.name || notification.user.email}</span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(notification.createdAt))} ago
                      </span>
                      <span>•</span>
                      <span className={typeConfig.color}>{typeConfig.label}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
