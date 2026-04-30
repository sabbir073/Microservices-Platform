"use client";

import { useState } from "react";
import { Scale } from "lucide-react";
import { DisputeResolveModal } from "./dispute-resolve-modal";

interface DisputeResolveButtonProps {
  disputeId: string;
  buyerName: string;
  sellerName: string;
  amount: number;
}

export function DisputeResolveButton(props: DisputeResolveButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-lg text-sm hover:bg-purple-500/20 transition-colors"
      >
        <Scale className="w-4 h-4" />
        Resolve
      </button>
      <DisputeResolveModal {...props} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
