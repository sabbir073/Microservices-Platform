import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CreateListingView } from "@/components/user/marketplace/create-listing-view";

export default async function CreateListingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <CreateListingView />;
}
