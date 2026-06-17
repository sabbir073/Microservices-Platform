"use client";

import type { BuilderState } from "../types";
import { Field, SectionHeader, inputCls } from "../shared";
import { Plus, X } from "lucide-react";
import { useState } from "react";

interface Props {
  state: BuilderState;
  update: <K extends keyof BuilderState>(key: K, value: BuilderState[K]) => void;
}

export function SeoStep({ state, update }: Props) {
  const [keywordDraft, setKeywordDraft] = useState("");

  const addKeyword = () => {
    const v = keywordDraft.trim();
    if (!v) return;
    if (state.seoKeywords.includes(v)) return;
    if (state.seoKeywords.length >= 20) return;
    update("seoKeywords", [...state.seoKeywords, v]);
    setKeywordDraft("");
  };

  const removeKeyword = (k: string) =>
    update(
      "seoKeywords",
      state.seoKeywords.filter((x) => x !== k)
    );

  return (
    <div className="space-y-5">
      <SectionHeader
        title="SEO"
        subtitle="Optional. These power the page <title>, meta description, and search engine indexing."
      />

      <Field
        label="SEO title"
        hint="Optional — defaults to the course title if blank. Aim for under 60 chars."
      >
        <input
          type="text"
          value={state.seoTitle}
          onChange={(e) => update("seoTitle", e.target.value)}
          className={inputCls}
          maxLength={120}
        />
        <p className="text-[11px] text-slate-500 tabular-nums mt-1">
          {state.seoTitle.length} / 120
        </p>
      </Field>

      <Field
        label="SEO description"
        hint="Optional — shows in Google snippets. 150–160 characters works best."
      >
        <textarea
          value={state.seoDescription}
          onChange={(e) => update("seoDescription", e.target.value)}
          rows={3}
          className={inputCls + " resize-none"}
          maxLength={300}
        />
        <p className="text-[11px] text-slate-500 tabular-nums mt-1">
          {state.seoDescription.length} / 300
        </p>
      </Field>

      <Field label="SEO keywords" hint="Up to 20 tags.">
        <div className="flex gap-2">
          <input
            type="text"
            value={keywordDraft}
            onChange={(e) => setKeywordDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addKeyword();
              }
            }}
            className={inputCls + " flex-1"}
            placeholder="react, frontend, web…"
            maxLength={40}
          />
          <button
            type="button"
            onClick={addKeyword}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {state.seoKeywords.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {state.seoKeywords.map((k) => (
              <span
                key={k}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 text-xs font-medium"
              >
                {k}
                <button
                  type="button"
                  onClick={() => removeKeyword(k)}
                  className="text-indigo-300/70 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Field>
    </div>
  );
}
