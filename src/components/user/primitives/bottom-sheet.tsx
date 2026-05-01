"use client";

import { Drawer } from "vaul";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: BottomSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" />
        <Drawer.Content
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-3xl flex flex-col rounded-t-2xl bg-gray-900 border-t border-gray-800 outline-none",
            className
          )}
        >
          <div className="mx-auto mt-2 mb-1 h-1.5 w-12 rounded-full bg-gray-700" />
          {(title || description) && (
            <div className="px-5 pt-2 pb-3 border-b border-gray-800">
              {title && (
                <Drawer.Title className="text-base font-semibold text-white">
                  {title}
                </Drawer.Title>
              )}
              {description && (
                <Drawer.Description className="text-xs text-gray-400 mt-0.5">
                  {description}
                </Drawer.Description>
              )}
            </div>
          )}
          <div className="px-5 py-4 overflow-y-auto max-h-[70vh]">
            {children}
          </div>
          {footer && (
            <div className="px-5 py-3 border-t border-gray-800 bg-gray-900/95">
              {footer}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
