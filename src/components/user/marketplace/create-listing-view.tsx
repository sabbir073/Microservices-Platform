"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X, Upload } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "DIGITAL_PRODUCT", label: "Digital Product" },
  { value: "SERVICE", label: "Service" },
  { value: "TEMPLATE", label: "Template" },
  { value: "GUIDE", label: "Guide" },
  { value: "COURSE", label: "Course" },
  { value: "OTHER", label: "Other" },
];

export function CreateListingView() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [price, setPrice] = useState(9.99);
  const [images, setImages] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description required");
      return;
    }
    if (price <= 0) {
      toast.error("Price must be greater than 0");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          category,
          price,
          images,
          currency: "USD",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      toast.success("Listing created!");
      router.push(`/marketplace/${d.listing.id}`);
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold text-white">Create Listing</h1>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            Title *
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="What are you selling?"
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            Description *
          </label>
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell buyers what they're getting..."
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Price (USD)
            </label>
            <input
              type="number"
              step="0.01"
              min={0.5}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">
            Images
          </label>
          <div className="flex items-center gap-2">
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Paste image URL..."
              className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => {
                if (imageUrl.trim()) {
                  setImages([...images, imageUrl.trim()]);
                  setImageUrl("");
                }
              }}
              className="p-2 rounded-lg bg-indigo-500 text-white"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {images.map((img, i) => (
                <div
                  key={i}
                  className="relative aspect-square rounded-lg overflow-hidden bg-gray-800"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setImages(images.filter((_, x) => x !== i))}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={submit}
        disabled={busy}
        className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Upload className="w-4 h-4" />
        )}
        Publish Listing
      </button>
    </div>
  );
}
