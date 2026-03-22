import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { authOptions } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="flex min-h-screen">
        <SidebarNav />

        <div className="flex min-h-screen flex-1 flex-col">
          <main className="flex-1 px-4 py-6 md:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
