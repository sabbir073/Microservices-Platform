"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (/sw.js) on app load so the app is installable
 * as a PWA and can receive web-push. Renders nothing. No offline caching — the
 * SW only handles push/notificationclick.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // ignore registration failures (unsupported / offline)
    });
  }, []);

  return null;
}
