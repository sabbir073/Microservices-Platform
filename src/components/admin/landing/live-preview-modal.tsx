"use client";

import { useState } from "react";
import {
  X,
  RefreshCw,
  Smartphone,
  Tablet,
  Monitor,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LivePreviewModalProps {
  open: boolean;
  onClose: () => void;
}

const DEVICES = [
  { key: "mobile", label: "Mobile", icon: Smartphone, width: 375 },
  { key: "tablet", label: "Tablet", icon: Tablet, width: 768 },
  { key: "desktop", label: "Desktop", icon: Monitor, width: 1280 },
] as const;

type DeviceKey = (typeof DEVICES)[number]["key"];

export function LivePreviewModal({ open, onClose }: LivePreviewModalProps) {
  const [device, setDevice] = useState<DeviceKey>("desktop");
  const [reloadKey, setReloadKey] = useState(0);

  if (!open) return null;

  const reload = () => setReloadKey((k) => k + 1);
  const activeDevice = DEVICES.find((d) => d.key === device) ?? DEVICES[2];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
        <div>
          <p className="text-sm font-bold text-white">Live Preview</p>
          <p className="text-[11px] text-slate-500">
            Saved changes appear after you reload the iframe.
          </p>
        </div>

        <div className="flex items-center gap-1">
          {DEVICES.map((d) => {
            const isActive = d.key === device;
            return (
              <button
                key={d.key}
                onClick={() => setDevice(d.key)}
                title={`${d.label} (${d.width}px)`}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors",
                  isActive
                    ? "bg-blue-500/15 text-blue-300 border border-blue-500/40"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
              >
                <d.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{d.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={reload}
            title="Reload iframe"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title="Open in new tab"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            title="Close"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Iframe stage */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 grid place-items-start sm:place-items-center">
        <div
          className="bg-slate-950 rounded-xl border border-slate-800 shadow-2xl overflow-hidden mx-auto transition-[width] duration-300"
          style={{
            width:
              device === "desktop"
                ? "min(100%, 1280px)"
                : `${activeDevice.width}px`,
            maxWidth: "100%",
            height: "calc(100vh - 120px)",
          }}
        >
          <iframe
            key={`${device}-${reloadKey}`}
            src="/"
            title="Landing live preview"
            className="w-full h-full border-0 bg-slate-950"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
    </div>
  );
}
