/**
 * Custom task — admin defines arbitrary input fields (image, text, link,
 * file, choice, etc.); user submits answers; admin reviews. The flexible
 * "do anything" task type.
 */

export type CustomFieldType =
  | "TEXT" // single-line text
  | "TEXTAREA" // multi-line text
  | "LINK" // URL
  | "EMAIL"
  | "PHONE"
  | "NUMBER"
  | "IMAGE" // single image upload
  | "IMAGES" // multiple image upload
  | "FILE" // any file upload
  | "VIDEO" // video file or URL
  | "SELECT" // dropdown / radio
  | "CHECKBOX_GROUP"; // multi-select

export interface CustomField {
  /** Stable cuid-style id used in answer maps. */
  id: string;
  order: number;
  type: CustomFieldType;
  /** Question label / prompt shown to the user. */
  label: string;
  /** Optional short hint rendered under the label. */
  hint?: string;
  /** Required by default. */
  required: boolean;

  // Optional per-type constraints
  /** Max characters for TEXT/TEXTAREA. */
  maxLength?: number;
  /** Allowed file/image types (mime list, e.g. "image/jpeg,image/png"). */
  accept?: string;
  /** Max file size in MB (FILE/IMAGE/VIDEO). Default 8. */
  maxSizeMb?: number;
  /** Max number of images for IMAGES (default 5). */
  maxImages?: number;
  /** Options for SELECT and CHECKBOX_GROUP. */
  options?: string[];
  /** Number-input min/max */
  min?: number;
  max?: number;
}

export interface CustomConfig {
  /** Admin-defined field list, in display order. */
  fields: CustomField[];
  /** Optional intro shown above the form. */
  introMessage?: string;
  /** Optional thank-you message after submission. */
  thankYouMessage?: string;
  /** When false, user submission goes to PENDING for admin review (default).
   *  When true, the task auto-approves on submit. */
  autoApprove?: boolean;
}

export const DEFAULT_CUSTOM_CONFIG: CustomConfig = {
  fields: [],
  introMessage: "",
  thankYouMessage: "",
  autoApprove: false,
};

/** Field types that result in URL strings (uploaded media). */
const FILE_TYPES: CustomFieldType[] = ["IMAGE", "IMAGES", "FILE", "VIDEO"];

/** A user-submitted answer keyed by field.id. */
export type CustomAnswer = string | string[] | number | null;
export type CustomAnswers = Record<string, CustomAnswer>;

const URL_RE = /^https?:\/\/[^\s]+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s().-]{6,20}$/;

/** Validate a CustomConfig before persisting. Returns null if OK, or the
 *  first user-friendly error message. */
export function validateCustomConfig(cfg: CustomConfig): string | null {
  if (!cfg || !Array.isArray(cfg.fields)) return "fields[] missing";
  if (cfg.fields.length === 0)
    return "Add at least one field for this custom task";
  if (cfg.fields.length > 25)
    return "Too many fields (max 25 per task)";
  const seenIds = new Set<string>();
  for (const f of cfg.fields) {
    if (!f.id) return "Every field needs an id";
    if (seenIds.has(f.id)) return `Duplicate field id: ${f.id}`;
    seenIds.add(f.id);
    if (!f.label || !f.label.trim()) return `Field "${f.id}" is missing a label`;
    if (f.label.length > 200) return `Label too long for field "${f.id}"`;
    if ((f.type === "SELECT" || f.type === "CHECKBOX_GROUP") &&
        (!f.options || f.options.length === 0)) {
      return `Field "${f.label}" needs at least one option`;
    }
    if (f.maxLength !== undefined && (f.maxLength < 1 || f.maxLength > 5000)) {
      return `maxLength out of range for "${f.label}"`;
    }
    if (f.maxSizeMb !== undefined && (f.maxSizeMb < 1 || f.maxSizeMb > 100)) {
      return `maxSizeMb out of range for "${f.label}"`;
    }
  }
  return null;
}

/** Validate a user's submission against the admin's CustomConfig.
 *  Returns null on success, or a friendly error string. */
export function validateCustomAnswers(
  cfg: CustomConfig,
  answers: CustomAnswers
): string | null {
  for (const f of cfg.fields) {
    const v = answers[f.id];
    const isEmpty =
      v === null ||
      v === undefined ||
      (typeof v === "string" && v.trim() === "") ||
      (Array.isArray(v) && v.length === 0);

    if (f.required && isEmpty) {
      return `"${f.label}" is required`;
    }
    if (isEmpty) continue; // optional + empty is fine

    switch (f.type) {
      case "TEXT":
      case "TEXTAREA":
        if (typeof v !== "string") return `"${f.label}" must be text`;
        if (f.maxLength && v.length > f.maxLength)
          return `"${f.label}" exceeds ${f.maxLength} characters`;
        break;
      case "LINK":
        if (typeof v !== "string" || !URL_RE.test(v.trim()))
          return `"${f.label}" must be a valid http(s) URL`;
        break;
      case "EMAIL":
        if (typeof v !== "string" || !EMAIL_RE.test(v.trim()))
          return `"${f.label}" must be a valid email`;
        break;
      case "PHONE":
        if (typeof v !== "string" || !PHONE_RE.test(v.trim()))
          return `"${f.label}" must be a valid phone number`;
        break;
      case "NUMBER": {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n))
          return `"${f.label}" must be a number`;
        if (f.min !== undefined && n < f.min)
          return `"${f.label}" must be ≥ ${f.min}`;
        if (f.max !== undefined && n > f.max)
          return `"${f.label}" must be ≤ ${f.max}`;
        break;
      }
      case "IMAGE":
      case "FILE":
      case "VIDEO":
        if (typeof v !== "string" || !v.startsWith("http"))
          return `"${f.label}" must be uploaded`;
        break;
      case "IMAGES":
        if (!Array.isArray(v))
          return `"${f.label}" must be a list of uploaded images`;
        if (
          f.maxImages !== undefined &&
          v.length > Math.max(1, f.maxImages)
        )
          return `"${f.label}" — too many images (max ${f.maxImages})`;
        for (const url of v) {
          if (typeof url !== "string" || !url.startsWith("http"))
            return `"${f.label}" — every entry must be an uploaded image URL`;
        }
        break;
      case "SELECT":
        if (typeof v !== "string" || !(f.options ?? []).includes(v))
          return `"${f.label}" — invalid choice`;
        break;
      case "CHECKBOX_GROUP":
        if (!Array.isArray(v))
          return `"${f.label}" must be a list`;
        for (const choice of v) {
          if (typeof choice !== "string" || !(f.options ?? []).includes(choice))
            return `"${f.label}" — invalid choice`;
        }
        break;
    }
  }
  return null;
}

/** Field types that require a file upload. Useful for UI. */
export function isFileField(t: CustomFieldType): boolean {
  return FILE_TYPES.includes(t);
}

export const FIELD_TYPE_LABEL: Record<CustomFieldType, string> = {
  TEXT: "Short text",
  TEXTAREA: "Long text",
  LINK: "Link / URL",
  EMAIL: "Email",
  PHONE: "Phone",
  NUMBER: "Number",
  IMAGE: "Single image",
  IMAGES: "Multiple images",
  FILE: "File upload",
  VIDEO: "Video",
  SELECT: "Dropdown choice",
  CHECKBOX_GROUP: "Multi-select",
};
