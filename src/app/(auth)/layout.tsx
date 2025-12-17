import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Redirect to dashboard if already logged in
  if (session?.user) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
