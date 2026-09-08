import { Sidebar } from "@/components/Sidebar";
import { requireAdmin } from "@/lib/data";
import { getMyNotifications } from "@/app/actions/notifications";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdmin();
  const notifications = await getMyNotifications();
  return (
    <div className="min-h-screen md:pl-64">
      <Sidebar profile={profile} notifications={notifications} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
