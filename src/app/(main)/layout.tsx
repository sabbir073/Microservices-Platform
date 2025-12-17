import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Server-side redirect if not authenticated
  // This prevents any flash - user never sees the page
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Sidebar */}
      <Sidebar user={session.user} />

      {/* Main Content */}
      <div className="lg:pl-72">
        {/* Header */}
        <Header user={session.user} />

        {/* Page Content */}
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
