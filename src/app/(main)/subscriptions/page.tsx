import { redirect } from "next/navigation";

// The real, DB-backed plan list + purchase flow lives at /packages. This route
// used to render a hardcoded placeholder; redirect so existing links land on the
// live page instead of showing stale, non-functional plans.
export default function SubscriptionsPage() {
  redirect("/packages");
}
