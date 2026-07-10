"use client";

import { promptDialog } from "@/lib/confirm";

import { useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
// Tiptap v3: TextStyle + Color both live in @tiptap/extension-text-style.
import { TextStyle, Color } from "@tiptap/extension-text-style";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Baseline,
  ImagePlus,
  Code,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OFFER_RICHTEXT_CLASS } from "@/lib/offers";

const TEXT_COLORS = [
  "#ffffff", "#94a3b8", "#ef4444", "#f59e0b",
  "#eab308", "#22c55e", "#06b6d4", "#3b82f6",
  "#8b5cf6", "#ec4899",
];

// Tiptap v3 StarterKit already bundles Link + Underline; we add TextAlign,
// TextStyle+Color (text color), and Image (inline, aligned via text-align).
export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const [showSource, setShowSource] = useState(false);
  const [source, setSource] = useState(value);

  const editor = useEditor({
    immediatelyRender: false, // required for Next.js SSR (no hydration mismatch)
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Image.configure({ inline: true, allowBase64: false }),
    ],
    content: value || "<p></p>",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: `${OFFER_RICHTEXT_CLASS} min-h-32 px-3 py-2 focus:outline-none`,
      },
    },
  });

  const toggleSource = () => {
    if (!editor) return;
    if (showSource) {
      editor.commands.setContent(source); // apply edited HTML back
      onChange(source);
      setShowSource(false);
    } else {
      setSource(editor.getHTML());
      setShowSource(true);
    }
  };

  if (!editor) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-950 min-h-40 animate-pulse" />
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950 overflow-hidden">
      {showSource ? (
        <>
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-2 py-1.5">
            <span className="text-xs text-slate-400 px-1">HTML source</span>
            <Btn title="Back to editor" active onClick={toggleSource}>
              <Code className="w-4 h-4" />
            </Btn>
          </div>
          <textarea
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              onChange(e.target.value);
            }}
            spellCheck={false}
            className="w-full min-h-40 px-3 py-2 bg-slate-950 text-slate-200 font-mono text-xs focus:outline-none resize-y"
          />
        </>
      ) : (
        <>
          <Toolbar editor={editor} onToggleSource={toggleSource} />
          <EditorContent editor={editor} />
        </>
      )}
    </div>
  );
}

function Btn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-1.5 rounded text-slate-300 hover:bg-slate-800 disabled:opacity-40",
        active && "bg-slate-800 text-white"
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({
  editor,
  onToggleSource,
}: {
  editor: Editor;
  onToggleSource: () => void;
}) {
  const [colorOpen, setColorOpen] = useState(false);

  const setLink = async () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = await promptDialog({ title: "Link URL", defaultValue: prev ?? "https://", tone: "info", confirmLabel: "Set link" });
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const insertImage = async () => {
    const url = await promptDialog({ title: "Image URL", defaultValue: "https://", tone: "info", confirmLabel: "Insert" });
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  const currentColor =
    (editor.getAttributes("textStyle").color as string | undefined) ?? "#ffffff";

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-800 bg-slate-900 px-2 py-1.5">
      <Btn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="w-4 h-4" />
      </Btn>
      <Btn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="w-4 h-4" />
      </Btn>
      <Btn title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="w-4 h-4" />
      </Btn>

      {/* Text color */}
      <div className="relative">
        <Btn title="Text color" active={colorOpen} onClick={() => setColorOpen((v) => !v)}>
          <Baseline className="w-4 h-4" style={{ color: currentColor }} />
        </Btn>
        {colorOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setColorOpen(false)} />
            <div className="absolute left-0 top-full mt-1 z-50 w-48 p-2 rounded-lg bg-slate-900 border border-slate-700 shadow-xl">
              <div className="grid grid-cols-5 gap-1.5">
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => {
                      editor.chain().focus().setColor(c).run();
                      setColorOpen(false);
                    }}
                    className="w-7 h-7 rounded-full border border-white/10"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="color"
                  onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                  className="w-8 h-8 rounded bg-transparent cursor-pointer"
                  title="Custom color"
                />
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().unsetColor().run();
                    setColorOpen(false);
                  }}
                  className="flex-1 text-xs text-slate-300 hover:text-white rounded bg-slate-800 py-1.5"
                >
                  Default
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <span className="w-px h-5 bg-slate-700 mx-1" />
      <Btn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="w-4 h-4" />
      </Btn>
      <Btn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="w-4 h-4" />
      </Btn>
      <Btn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="w-4 h-4" />
      </Btn>
      <Btn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="w-4 h-4" />
      </Btn>
      <Btn title="Link" active={editor.isActive("link")} onClick={setLink}>
        <LinkIcon className="w-4 h-4" />
      </Btn>
      <Btn title="Insert image (align with the L/C/R buttons)" onClick={insertImage}>
        <ImagePlus className="w-4 h-4" />
      </Btn>

      <span className="w-px h-5 bg-slate-700 mx-1" />
      <Btn title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft className="w-4 h-4" />
      </Btn>
      <Btn title="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter className="w-4 h-4" />
      </Btn>
      <Btn title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight className="w-4 h-4" />
      </Btn>

      <span className="w-px h-5 bg-slate-700 mx-1" />
      <Btn title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo className="w-4 h-4" />
      </Btn>
      <Btn title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo className="w-4 h-4" />
      </Btn>

      <span className="ml-auto" />
      <Btn title="Edit HTML source" onClick={onToggleSource}>
        <Code className="w-4 h-4" />
      </Btn>
    </div>
  );
}
