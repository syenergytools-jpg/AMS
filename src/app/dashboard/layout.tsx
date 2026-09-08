import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { getCurrentProfile } from "@/lib/data";
import { getMyNotifications } from "@/app/actions/notifications";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  // Admins don't check in/out — this personal-attendance area isn't for them.
  if (profile.role === "ADMIN") redirect("/admin");
  const notifications = await getMyNotifications();
  return (
    <div className="min-h-screen md:pl-64">
      <Sidebar profile={profile} notifications={notifications} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
