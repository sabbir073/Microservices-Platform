"use client";

import type { BuilderState, BuilderFaq } from "../types";
import { Field, SectionHeader, inputCls } from "../shared";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  state: BuilderState;
  update: <K extends keyof BuilderState>(key: K, value: BuilderState[K]) => void;
}

export function DetailStep({ state, update }: Props) {
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Landing page detail"
        subtitle="The Udemy-style sections students read before they enrol. At least 2 learning outcomes are required."
      />

      <BulletEditor
        label="Learning outcomes"
        required
        hint="What students will be able to do after this course."
        placeholder="Build a production-ready Next.js app from scratch"
        values={state.learningOutcomes}
        onChange={(v) => update("learningOutcomes", v)}
      />

      <BulletEditor
        label="Requirements"
        hint="Prerequisites — tools, prior knowledge, hardware."
        placeholder="Basic JavaScript familiarity"
        values={state.requirements}
        onChange={(v) => update("requirements", v)}
      />

      <BulletEditor
        label="What's included"
        hint="Lifetime access, downloadable resources, certificate, etc."
        placeholder="Lifetime access + downloadable code"
        values={state.whatsIncluded}
        onChange={(v) => update("whatsIncluded", v)}
      />

      <FaqEditor
        values={state.faqs}
        onChange={(v) => update("faqs", v)}
      />
    </div>
  );
}

function BulletEditor({
  label,
  required,
  hint,
  values,
  placeholder,
  onChange,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  values: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
}) {
  const set = (i: number, v: string) =>
    onChange(values.map((s, idx) => (idx === i ? v : s)));
  const remove = (i: number) =>
    onChange(values.filter((_, idx) => idx !== i));
  const add = () => onChange([...values, ""]);

  return (
    <Field label={label} required={required} hint={hint}>
      <div className="space-y-2">
        {values.length === 0 && (
          <p className="text-xs text-slate-500 italic">No entries yet.</p>
        )}
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-6 text-right">{i + 1}.</span>
            <input
              type="text"
              value={v}
              onChange={(e) => set(i, e.target.value)}
              className={inputCls + " flex-1"}
              placeholder={placeholder}
              maxLength={200}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-rose-400 hover:bg-rose-500/10 p-1.5 rounded shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 font-bold"
        >
          <Plus className="w-3.5 h-3.5" />
          Add entry
        </button>
      </div>
    </Field>
  );
}

function FaqEditor({
  values,
  onChange,
}: {
  values: BuilderFaq[];
  onChange: (next: BuilderFaq[]) => void;
}) {
  const set = (i: number, patch: Partial<BuilderFaq>) =>
    onChange(values.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const remove = (i: number) =>
    onChange(values.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([...values, { question: "", answer: "" }]);

  return (
    <Field label="FAQs" hint="Common questions answered up-front.">
      <div className="space-y-3">
        {values.length === 0 && (
          <p className="text-xs text-slate-500 italic">No FAQs yet.</p>
        )}
        {values.map((f, i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-700 bg-slate-950 p-3 space-y-2"
          >
            <div className="flex items-start gap-2">
              <span className="text-xs text-slate-500 mt-2 w-6 text-right">Q{i + 1}</span>
              <input
                type="text"
                value={f.question}
                onChange={(e) => set(i, { question: e.target.value })}
                className={inputCls + " flex-1"}
                placeholder="Question"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-rose-400 hover:bg-rose-500/10 p-1.5 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <textarea
              value={f.answer}
              onChange={(e) => set(i, { answer: e.target.value })}
              rows={2}
              className={inputCls + " resize-none ml-8"}
              placeholder="Answer"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 font-bold"
        >
          <Plus className="w-3.5 h-3.5" />
          Add FAQ
        </button>
      </div>
    </Field>
  );
}
