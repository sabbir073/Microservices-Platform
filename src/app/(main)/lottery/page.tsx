import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LotteryView } from "@/components/user/lottery/lottery-view";

export default async function LotteryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <LotteryView />;
}
