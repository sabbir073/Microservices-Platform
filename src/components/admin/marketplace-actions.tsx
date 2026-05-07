"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

interface CreateListingButtonProps {
  canManage: boolean;
}

export function CreateListingButton({ canManage }: CreateListingButtonProps) {
  if (!canManage) return null;

  return (
    <Link
      href="/admin/marketplace/new"
      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
    >
      <Plus className="w-4 h-4" />
      Create Listing
    </Link>
  );
}
