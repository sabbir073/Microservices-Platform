// Imperative, promise-based dialog API — replaces native window.confirm/prompt
// with a themed in-app dialog. Backed by a tiny module store (like sonner) so any
// async handler can call it without prop-drilling:
//
//   if (!(await confirmDialog({ title: "Delete?", tone: "danger" }))) return;
//   const reason = await promptDialog({ title: "Why?", required: true });
//
// A single <ConfirmHost /> mounted in the root layout renders the active request.

export type DialogTone = "info" | "success" | "warning" | "danger";

export interface ConfirmOptions {
  title: string;
  description?: string;
  tone?: DialogTone;
  confirmLabel?: string;
  cancelLabel?: string;
  /** If set, the user must type this exact text to enable the confirm button. */
  requireText?: string;
}

export interface PromptOptions {
  title: string;
  description?: string;
  tone?: DialogTone;
  placeholder?: string;
  defaultValue?: string;
  multiline?: boolean;
  /** Confirm stays disabled until the input is non-empty. */
  required?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface DialogRequest {
  id: number;
  kind: "confirm" | "prompt";
  options: ConfirmOptions & PromptOptions;
  resolve: (value: boolean | string | null) => void;
}

let queue: DialogRequest[] = [];
const listeners = new Set<() => void>();
let counter = 0;

function emit() {
  for (const l of listeners) l();
}

export function subscribeDialogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The active (front-of-queue) request, or null. Stable reference between changes. */
export function getDialogSnapshot(): DialogRequest | null {
  return queue[0] ?? null;
}

function push(
  kind: DialogRequest["kind"],
  options: ConfirmOptions & PromptOptions
): Promise<boolean | string | null> {
  return new Promise((resolve) => {
    queue = [...queue, { id: ++counter, kind, options, resolve }];
    emit();
  });
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return push("confirm", options) as Promise<boolean>;
}

export function promptDialog(options: PromptOptions): Promise<string | null> {
  return push("prompt", options) as Promise<string | null>;
}

/** Called by the host to resolve + dismiss the active dialog. */
export function resolveActiveDialog(
  id: number,
  value: boolean | string | null
) {
  const req = queue.find((r) => r.id === id);
  if (!req) return;
  req.resolve(value);
  queue = queue.filter((r) => r.id !== id);
  emit();
}
