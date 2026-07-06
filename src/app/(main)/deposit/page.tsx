import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DepositView } from "@/components/user/wallet/deposit-view";

export default async function DepositPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <DepositView />;
}
