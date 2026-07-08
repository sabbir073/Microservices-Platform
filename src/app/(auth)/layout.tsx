import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // Redirect to the social feed (app home) if already logged in
  if (session?.user) {
    redirect("/social");
  }

  return <>{children}</>;
}
