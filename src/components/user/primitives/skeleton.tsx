import { cn } from "@/lib/utils";

// `animate-pulse` fades a block in and out where it stands, which reads as a
// broken element rather than as loading. `.skeleton` (globals.css) is a sweep
// across the block — the shape people recognise as "arriving" — and it stops
// under prefers-reduced-motion. Every loading screen in the app uses this
// primitive, so they all change together.

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("skeleton rounded-md", className)}
    />
  );
}

/**
 * A skeleton's whole job is to hold the exact shape the real thing will take,
 * so the page does not jump when it arrives. These are matched to the cards
 * they stand in for: same `app-card` surface, same radius, same padding, same
 * 44px avatar, same row heights. A skeleton in a different shape from its
 * content is a second layout, briefly.
 */
export function CardSkeleton() {
  return (
    <div className="app-card">
      <div className="flex items-start gap-3">
        <Skeleton className="w-12 h-12 rounded-(--app-r-control) shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-(--app-gap)">
      {Array.from({ length: rows }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Matches FeedPostCard: 44px avatar, name + meta, two text lines, media. */
export function FeedPostSkeleton() {
  return (
    <div className="app-card space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-11 h-11 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-9 w-20 rounded-(--app-r-chip) shrink-0" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-48 w-full rounded-(--app-r-control)" />
      {/* The action row, so the card does not grow by 56px on arrival. */}
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-11 w-16 rounded-(--app-r-chip)" />
        <Skeleton className="h-11 w-16 rounded-(--app-r-chip)" />
        <Skeleton className="h-11 w-16 rounded-(--app-r-chip)" />
      </div>
    </div>
  );
}

/** Matches the gradient balance panel — same height, so the feed does not jump. */
export function BalanceSkeleton() {
  return (
    <div className="app-card space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-10 w-44" />
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Skeleton className="h-20 rounded-(--app-r-control)" />
        <Skeleton className="h-20 rounded-(--app-r-control)" />
      </div>
    </div>
  );
}
