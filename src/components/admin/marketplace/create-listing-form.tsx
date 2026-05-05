"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Image as ImageIcon, Trash2, Package, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { MediaSelector } from "@/components/media/MediaSelector";
import type { MediaItem } from "@/types/media";

const CATEGORIES = [
  "Digital Products",
  "Services",
  "Gift Cards",
  "Game Items",
  "Account Upgrades",
  "Premium Features",
  "Other",
];

export function CreateListingForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Digital Products",
    price: "",
    images: [] as string[],
    files: [] as string[],
  });
  const [imageUrl, setImageUrl] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  const handleMediaPick = (media: MediaItem | MediaItem[]) => {
    const items = Array.isArray(media) ? media : [media];
    const urls = items
      .map((m) => m.cloudFrontUrl || m.s3Url)
      .filter((u): u is string => !!u && !formData.images.includes(u));
    if (urls.length) {
      setFormData((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
    }
    setMediaPickerOpen(false);
  };

  const handleAddImage = () => {
    if (imageUrl.trim() && !formData.images.includes(imageUrl.trim())) {
      try {
        new URL(imageUrl.trim());
        setFormData({ ...formData, images: [...formData.images, imageUrl.trim()] });
        setImageUrl("");
      } catch {
        toast.error("Please enter a valid image URL");
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    setFormData({
      ...formData,
      images: formData.images.filter((_, i) => i !== index),
    });
  };

  const handleAddFile = () => {
    if (fileUrl.trim() && !formData.files.includes(fileUrl.trim())) {
      try {
        new URL(fileUrl.trim());
        setFormData({ ...formData, files: [...formData.files, fileUrl.trim()] });
        setFileUrl("");
      } catch {
        toast.error("Please enter a valid file URL");
      }
    }
  };

  const handleRemoveFile = (index: number) => {
    setFormData({
      ...formData,
      files: formData.files.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.title.length < 3 || formData.title.length > 100) {
      toast.error("Title must be between 3 and 100 characters");
      return;
    }
    if (formData.description.length < 10 || formData.description.length > 1000) {
      toast.error("Description must be between 10 and 1000 characters");
      return;
    }
    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
      toast.error("Please enter a valid price greater than 0");
      return;
    }

    setIsSubmitting(true);
    try {
      const requestData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        price,
        images: formData.images,
        files: formData.files,
      };

      const response = await fetch("/api/admin/marketplace/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.details && Array.isArray(data.details)) {
          const errorMessages = data.details
            .map((err: { path?: string[]; message?: string }) => {
              const path = err.path?.join(".") || "Field";
              return `${path}: ${err.message}`;
            })
            .join("; ");
          throw new Error(errorMessages);
        }
        throw new Error(data.error || "Failed to create listing");
      }

      toast.success("Listing created successfully");
      router.push("/admin/marketplace");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create listing"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden"
    >
      <div className="p-6 space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Title *{" "}
            <span className="text-gray-500 text-xs">(min. 3 characters)</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            required
            minLength={3}
            maxLength={100}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Enter listing title"
          />
          <p className="text-xs text-gray-500 mt-1 tabular-nums">
            {formData.title.length}/100
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description *{" "}
            <span className="text-gray-500 text-xs">(min. 10 characters)</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            required
            minLength={10}
            maxLength={1000}
            rows={5}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            placeholder="Describe the listing…"
          />
          <p className="text-xs text-gray-500 mt-1 tabular-nums">
            {formData.description.length}/1000
          </p>
        </div>

        {/* Category + Price */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Category *
            </label>
            <select
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
              required
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Price (USD) *
            </label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) =>
                setFormData({ ...formData, price: e.target.value })
              }
              required
              min="0.01"
              step="0.01"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Images */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <ImageIcon className="w-4 h-4 inline mr-1" />
            Images
          </label>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setMediaPickerOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm font-semibold"
            >
              <Upload className="w-4 h-4" />
              Upload / Pick from Library
            </button>
            <div className="flex gap-2">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddImage();
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="…or paste an image URL"
              />
              <button
                type="button"
                onClick={handleAddImage}
                className="px-4 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {formData.images.length > 0 && (
              <div className="space-y-2">
                {formData.images.map((img, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-gray-800 border border-gray-700 rounded-lg"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={`Preview ${index + 1}`}
                      className="w-12 h-12 object-cover rounded"
                      onError={(e) => {
                        e.currentTarget.src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect fill='%23374151' width='48' height='48'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239CA3AF' font-family='sans-serif' font-size='12'%3ENo Image%3C/text%3E%3C/svg%3E";
                      }}
                    />
                    <span className="flex-1 text-sm text-gray-400 truncate">
                      {img}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500">
              {formData.images.length === 0 &&
                "No images added yet. The first image will be the featured image."}
              {formData.images.length === 1 && "1 image added (featured image)"}
              {formData.images.length > 1 &&
                `${formData.images.length} images added (first is featured)`}
            </p>
          </div>
        </div>

        {/* Files */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Package className="w-4 h-4 inline mr-1" />
            Files (URLs) — Optional
          </label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="url"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddFile();
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://example.com/file.zip"
              />
              <button
                type="button"
                onClick={handleAddFile}
                className="px-4 py-2.5 bg-gray-800 border border-gray-700 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {formData.files.length > 0 && (
              <div className="space-y-2">
                {formData.files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-gray-800 border border-gray-700 rounded-lg"
                  >
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="flex-1 text-sm text-gray-400 truncate">
                      {file}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500">
              {formData.files.length === 0
                ? "No files added yet"
                : `${formData.files.length} file(s) added`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 p-6 border-t border-slate-800 sticky bottom-0 bg-slate-900">
        <button
          type="button"
          onClick={() => router.push("/admin/marketplace")}
          disabled={isSubmitting}
          className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 inline-flex items-center justify-center gap-2 font-bold"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Package className="w-4 h-4" />
          )}
          {isSubmitting ? "Creating…" : "Create Listing"}
        </button>
      </div>

      <MediaSelector
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleMediaPick}
        multiple
        fileType="IMAGE"
        title="Select Listing Images"
      />
    </form>
  );
}
