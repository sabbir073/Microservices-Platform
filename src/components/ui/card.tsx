import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds hover lift + brand ring for clickable cards. */
  interactive?: boolean;
  /** Inner padding preset. */
  padding?: "none" | "sm" | "md" | "lg";
}

const PAD: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

/**
 * Premium surface card — uses the `card` utility (real elevation + hairline
 * border + subtle top highlight) defined in globals.css. Replaces the flat
 * `bg-gray-900 border border-gray-800 rounded-xl` pattern.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, padding = "md", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "card",
        interactive && "card-interactive cursor-pointer",
        PAD[padding],
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";
