// Lightweight haptic feedback for the installed PWA. Uses the Vibration API,
// which is a no-op on desktop / unsupported browsers (notably iOS Safari, which
// ignores navigator.vibrate) — safe to call anywhere.
//
//   import { haptic } from "@/lib/haptics";
//   haptic("light");   // tab tap, small toggle
//   haptic("success"); // reward claimed, submit ok

type HapticKind = "light" | "medium" | "heavy" | "success" | "warning" | "error";

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 15,
  heavy: 25,
  success: [12, 40, 12],
  warning: [20, 60, 20],
  error: [30, 50, 30, 50, 30],
};

export function haptic(kind: HapticKind = "light"): void {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
      return;
    }
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // ignore — vibration is best-effort
  }
}
