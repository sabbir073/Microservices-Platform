"use client";

import { useState } from "react";
import { ShoppingCart, Eye, MessageCircle, Flag, Loader2 } from "lucide-react";
import { ImageZoomModal } from "@/components/user/primitives/image-zoom-modal";
import { ShareModal } from "@/components/user/primitives/share-modal";
import { ReportContent } from "@/components/user/primitives/report-content";
import { format } from "date-fns";
import { toast } from "sonner";

interface Listing {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  images: string[];
  status: string;
  views: number;
  createdAt: string;
  seller: {
    id: string;
    name: string | null;
    avatar: string | null;
    username: string | null;
  };
}

interface ListingDetailViewProps {
  listing: Listing;
  isOwner: boolean;
}

export function ListingDetailView({ listing, isOwner }: ListingDetailViewProps) {
  const [zoom, setZoom] = useState<number | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [busy, setBusy] = useState(false);

  const buy = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/marketplace/${listing.id}/checkout`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      toast.success("Purchase initiated");
      if (d.checkoutUrl) window.location.href = d.checkoutUrl;
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : "Try again",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 -mx-4">
      <div className="aspect-square bg-gray-900 relative">
        {listing.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.images[0]}
            alt={listing.title}
            onClick={() => setZoom(0)}
            className="w-full h-full object-cover cursor-zoom-in"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600">
            No image
          </div>
        )}
      </div>

      {listing.images.length > 1 && (
        <div className="px-4 grid grid-cols-4 gap-1.5">
          {listing.images.slice(1, 9).map((img, i) => (
            <button
              key={i}
              onClick={() => setZoom(i + 1)}
              className="aspect-square bg-gray-800 rounded-lg overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="px-4 space-y-3">
        <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 text-[10px] font-bold uppercase">
          {listing.category}
        </span>
        <h1 className="text-xl font-bold text-white">{listing.title}</h1>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Eye className="w-3.5 h-3.5" />
          {listing.views.toLocaleString()} views ·{" "}
          {format(new Date(listing.createdAt), "MMM d, yyyy")}
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-800 bg-gray-900">
          {listing.seller.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.seller.avatar}
              alt=""
              className="w-10 h-10 rounded-full bg-gray-800 object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
              {listing.seller.name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {listing.seller.name ?? "Anonymous"}
            </p>
            {listing.seller.username && (
              <p className="text-[11px] text-gray-500">
                @{listing.seller.username}
              </p>
            )}
          </div>
          {!isOwner && (
            <a
              href={`/chat?with=${listing.seller.id}`}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-indigo-400"
              aria-label="Message seller"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
          )}
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-3">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">
            Description
          </p>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">
            {listing.description}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShare(true)}
            className="flex-1 py-2 rounded-lg bg-gray-800 text-white text-xs font-semibold"
          >
            Share
          </button>
          {!isOwner && (
            <button
              onClick={() => setShowReport(true)}
              className="px-3 py-2 rounded-lg bg-gray-800 text-red-400"
              aria-label="Report"
            >
              <Flag className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="sticky bottom-20 mx-4">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/95 backdrop-blur-md p-3 flex items-center gap-3 shadow-2xl">
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
              Price
            </p>
            <p className="text-2xl font-extrabold text-white tabular-nums">
              ${listing.price.toFixed(2)}
            </p>
          </div>
          {isOwner ? (
            <a
              href={`/marketplace/${listing.id}/edit`}
              className="px-5 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-bold"
            >
              Edit Listing
            </a>
          ) : (
            <button
              onClick={buy}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
              Buy Now
            </button>
          )}
        </div>
      </div>

      <ImageZoomModal
        open={zoom !== null}
        images={listing.images}
        index={zoom ?? 0}
        onClose={() => setZoom(null)}
        onIndexChange={setZoom}
      />
      <ShareModal
        open={showShare}
        onOpenChange={setShowShare}
        url={
          typeof window !== "undefined"
            ? `${window.location.origin}/marketplace/${listing.id}`
            : `/marketplace/${listing.id}`
        }
        title={listing.title}
        text={listing.description.slice(0, 120)}
      />
      <ReportContent
        open={showReport}
        onOpenChange={setShowReport}
        targetType="LISTING"
        targetId={listing.id}
      />
    </div>
  );
}
