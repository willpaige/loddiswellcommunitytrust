import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "@/components/layout/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  return (
    <>
      {/* Override the public site header/footer via a separate layout */}
      <div className="flex min-h-screen">
        <AdminSidebar user={session.user} />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
