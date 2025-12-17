import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, type UserRole } from "@/lib/rbac";
import { LotteryForm } from "../_components/LotteryForm";
import { ArrowLeft, Ticket } from "lucide-react";
import Link from "next/link";

export default async function CreateLotteryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const adminRole = session.user.role as UserRole | undefined;
  if (!hasPermission(adminRole, "settings.edit")) {
    redirect("/admin/lottery");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/lottery"
          className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gray-800">
            <Ticket className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Create Lottery</h1>
            <p className="text-gray-400">Set up a new lottery draw</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <LotteryForm />
    </div>
  );
}
