"use client";

import type { BuilderState, CategoryOption } from "../types";
import { slugify } from "../types";
import { Field, SectionHeader, inputCls } from "../shared";

interface Props {
  state: BuilderState;
  update: <K extends keyof BuilderState>(key: K, value: BuilderState[K]) => void;
  categories: CategoryOption[];
}

const LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "en", label: "English" },
  { code: "bn", label: "Bangla" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
];

export function BasicsStep({ state, update, categories }: Props) {
  const activeCategory = categories.find((c) => c.id === state.categoryId);
  const subcats = activeCategory?.subcategories ?? [];

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Course basics"
        subtitle="Set the title, the short pitch, and where the course fits in the catalog."
      />
      <Field label="Course title" required>
        <input
          type="text"
          value={state.title}
          onChange={(e) => update("title", e.target.value)}
          className={inputCls}
          placeholder="The Complete Guide to React for 2026"
          maxLength={140}
        />
      </Field>
      <Field
        label="Slug"
        required
        hint="Used in the URL (e.g. /courses/the-complete-react-guide). Lowercase letters, numbers, and dashes only."
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={state.slug}
            onChange={(e) => update("slug", e.target.value.toLowerCase())}
            className={inputCls + " font-mono"}
            placeholder="the-complete-react-guide"
            maxLength={80}
          />
          <button
            type="button"
            onClick={() => update("slug", slugify(state.title))}
            disabled={!state.title}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-bold disabled:opacity-30 whitespace-nowrap"
          >
            From title
          </button>
        </div>
      </Field>
      <Field label="Subtitle">
        <input
          type="text"
          value={state.subtitle}
          onChange={(e) => update("subtitle", e.target.value)}
          className={inputCls}
          placeholder="One sentence that teases the result students will get."
          maxLength={180}
        />
      </Field>
      <Field
        label="Description"
        required
        hint="Markdown supported. Min 30 chars — write at least a short paragraph."
      >
        <textarea
          value={state.description}
          onChange={(e) => update("description", e.target.value)}
          rows={5}
          className={inputCls + " resize-y"}
          maxLength={5000}
          placeholder="Tell students exactly what they'll learn, who this is for, and why you're qualified to teach it."
        />
        <p className="text-[11px] text-slate-500 tabular-nums mt-1">
          {state.description.length} / 5000
        </p>
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Category" required>
          <select
            value={state.categoryId ?? ""}
            onChange={(e) => {
              update("categoryId", e.target.value || null);
              update("subcategoryId", null);
            }}
            className={inputCls}
          >
            <option value="">Pick a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subcategory">
          <select
            value={state.subcategoryId ?? ""}
            onChange={(e) => update("subcategoryId", e.target.value || null)}
            className={inputCls}
            disabled={subcats.length === 0}
          >
            <option value="">
              {subcats.length === 0 ? "—" : "Optional"}
            </option>
            {subcats.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Language">
          <select
            value={state.language}
            onChange={(e) => update("language", e.target.value)}
            className={inputCls}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Skill level">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(["BEGINNER", "INTERMEDIATE", "ADVANCED", "ALL_LEVELS"] as const).map(
            (lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => update("skillLevel", lvl)}
                className={
                  "px-3 py-2 rounded-lg text-xs font-bold border " +
                  (state.skillLevel === lvl
                    ? "border-indigo-500 bg-indigo-500/20 text-white"
                    : "border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300")
                }
              >
                {lvl === "ALL_LEVELS" ? "All levels" : lvl.charAt(0) + lvl.slice(1).toLowerCase()}
              </button>
            )
          )}
        </div>
      </Field>
    </div>
  );
}
