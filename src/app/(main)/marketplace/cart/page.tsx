import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CartView } from "@/components/user/marketplace/cart-view";

export default async function CartPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <CartView />;
}
