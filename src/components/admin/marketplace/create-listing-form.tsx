"use client";

import { MarketplaceListingForm } from "./listing-form/MarketplaceListingForm";

/**
 * Thin wrapper kept for back-compat with existing imports. The actual form
 * lives in `listing-form/MarketplaceListingForm.tsx` and is a multi-step,
 * asset-type-aware builder.
 */
export function CreateListingForm() {
  return <MarketplaceListingForm />;
}
