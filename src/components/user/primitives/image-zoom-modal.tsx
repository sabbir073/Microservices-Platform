"use client";

import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageZoomModalProps {
  open: boolean;
  images: string[];
  index: number;
  onClose: () => void;
  onIndexChange?: (next: number) => void;
}

export function ImageZoomModal({
  open,
  images,
  index,
  onClose,
  onIndexChange,
}: ImageZoomModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onIndexChange && index > 0)
        onIndexChange(index - 1);
      if (e.key === "ArrowRight" && onIndexChange && index < images.length - 1)
        onIndexChange(index + 1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, index, images.length, onClose, onIndexChange]);

  if (!open || images.length === 0) return null;
  const src = images[index];
  const hasNav = images.length > 1 && onIndexChange;
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
      {hasNav && index > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(index - 1);
          }}
          className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
          aria-label="Previous"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {hasNav && index < images.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange(index + 1);
          }}
          className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
          aria-label="Next"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        )}
      />
      {hasNav && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-medium">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
