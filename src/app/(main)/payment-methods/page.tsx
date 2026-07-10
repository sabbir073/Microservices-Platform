import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PaymentMethodsView } from "@/components/user/payment-methods/payment-methods-view";

export default async function PaymentMethodsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return <PaymentMethodsView />;
}
