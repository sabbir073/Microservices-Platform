"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/user/primitives/bottom-sheet";
import { ImageUploadField } from "@/components/admin/shared/ImageUploadField";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OwnPost {
  id: string;
  content: string;
  image: string | null;
  likesCount: number;
}

const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

const inp =
  "w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500";

export function CreateAdSheet({
  open,
  onOpenChange,
  campaignId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<"custom" | "post">("custom");
  const [busy, setBusy] = useState(false);

  // Custom creative
  const [brandName, setBrandName] = useState("");
  const [brandLogo, setBrandLogo] = useState("");
  const [headline, setHeadline] = useState("");
  const [image, setImage] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Learn More");
  const [targetUrl, setTargetUrl] = useState("");

  // Promote a post
  const [posts, setPosts] = useState<OwnPost[]>([]);
  const [postId, setPostId] = useState<string | null>(null);

  // Targeting
  const [country, setCountry] = useState("");
  const [genders, setGenders] = useState<string[]>([]);
  const [minLevel, setMinLevel] = useState<number>(0);

  useEffect(() => {
    if (!open || mode !== "post" || posts.length > 0) return;
    fetch("/api/advertiser/posts")
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .catch(() => {});
  }, [open, mode, posts.length]);

  const reset = () => {
    setBrandName("");
    setBrandLogo("");
    setHeadline("");
    setImage("");
    setCtaLabel("Learn More");
    setTargetUrl("");
    setPostId(null);
    setCountry("");
    setGenders([]);
    setMinLevel(0);
    setMode("custom");
  };

  const submit = async () => {
    if (!targetUrl.trim()) {
      toast.error("Destination URL is required");
      return;
    }
    if (mode === "post" && !postId) {
      toast.error("Pick a post to promote");
      return;
    }
    if (mode === "custom" && !headline.trim() && !image) {
      toast.error("Add a headline or an image");
      return;
    }

    const targeting: Record<string, unknown> = {};
    if (country.trim()) targeting.countries = [country.trim()];
    if (genders.length) targeting.genders = genders;
    if (minLevel > 0) targeting.minLevel = minLevel;

    const payload =
      mode === "post"
        ? { format: "NATIVE", promotedPostId: postId, ctaLabel, targetUrl, targeting }
        : {
            format: "NATIVE",
            brandName: brandName || null,
            brandLogo: brandLogo || null,
            headline: headline || null,
            contentUrl: image || null,
            ctaLabel,
            targetUrl,
            targeting,
          };

    setBusy(true);
    try {
      const res = await fetch(`/api/advertiser/campaigns/${campaignId}/ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      toast.success("Ad created");
      reset();
      onCreated();
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Create Ad"
      footer={
        <div className="flex gap-2">
          <button
            disabled={busy}
            onClick={() => onOpenChange(false)}
            className="flex-1 py-2.5 rounded-lg bg-gray-800 text-white text-sm font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={submit}
            className="flex-1 py-2.5 rounded-lg bg-indigo-500 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Ad"}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Creative type */}
        <div className="inline-flex rounded-lg border border-gray-700 overflow-hidden text-xs w-full">
          {(["custom", "post"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 px-3 py-2 font-semibold capitalize",
                mode === m
                  ? "bg-indigo-500 text-white"
                  : "bg-gray-800 text-gray-400"
              )}
            >
              {m === "custom" ? "Custom ad" : "Promote a post"}
            </button>
          ))}
        </div>

        {mode === "custom" ? (
          <>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Brand name</label>
              <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g. NordVPN" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Brand logo</label>
              <ImageUploadField value={brandLogo} onChange={setBrandLogo} previewSize="square" title="Select logo" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Headline / ad copy</label>
              <textarea rows={3} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="What are you promoting?" className={cn(inp, "resize-none")} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Image</label>
              <ImageUploadField value={image} onChange={setImage} previewSize="lg" title="Select ad image" />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Pick one of your posts</label>
            {posts.length === 0 ? (
              <p className="text-xs text-gray-600 py-3">No posts to promote yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {posts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPostId(p.id)}
                    className={cn(
                      "w-full flex items-center gap-2 p-2 rounded-lg border text-left",
                      postId === p.id
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-gray-800 bg-gray-800/50"
                    )}
                  >
                    <div className="w-9 h-9 rounded bg-gray-800 overflow-hidden shrink-0 flex items-center justify-center">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt="" className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <span className="text-xs text-gray-200 line-clamp-2 flex-1">
                      {p.content || "(no text)"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Shared: CTA + destination */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">CTA label</label>
            <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Destination URL *</label>
            <input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://…" className={inp} />
          </div>
        </div>

        {/* Targeting */}
        <div className="rounded-lg border border-gray-800 p-3 space-y-2.5">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
            Targeting (optional)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Country</label>
              <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Any" className={inp} />
            </div>
            <div>
              <label className="block text-[11px] text-gray-400 mb-1">Min level</label>
              <input type="number" min={0} value={minLevel} onChange={(e) => setMinLevel(Number(e.target.value))} className={inp} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-gray-400 mb-1">Gender</label>
            <div className="flex gap-1.5">
              {GENDERS.map((g) => {
                const on = genders.includes(g);
                return (
                  <button
                    key={g}
                    onClick={() =>
                      setGenders((prev) =>
                        on ? prev.filter((x) => x !== g) : [...prev, g]
                      )
                    }
                    className={cn(
                      "flex-1 px-2 py-1.5 rounded-md text-[11px] font-semibold capitalize",
                      on ? "bg-indigo-500 text-white" : "bg-gray-800 text-gray-400"
                    )}
                  >
                    {g.toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
