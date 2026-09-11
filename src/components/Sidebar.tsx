"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { SignOutButton } from "@/components/SignOutButton";
import { NotificationBell } from "@/components/NotificationBell";
import { getMyNotifications, markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import type { Notification, Profile } from "@/lib/types";
import { LayoutDashboard, Users, ShieldCheck, BarChart3, Wallet, CalendarOff, LifeBuoy, Menu, X } from "lucide-react";

// Long-ish on purpose: notifications aren't time-critical, and this fires
// once for the whole sidebar (see below) rather than once per bell.
const NOTIFICATION_POLL_MS = 120_000;

function navItems(isAdmin: boolean) {
  // Admins don't check in/out, so the personal dashboard & hours tracker aren't for them.
  if (isAdmin) {
    return [
      { href: "/admin", label: "Admin", icon: ShieldCheck },
      { href: "/admin/employees", label: "Employees", icon: Users },
      { href: "/admin/salary", label: "Salary", icon: Wallet },
      { href: "/admin/leave", label: "Leave", icon: CalendarOff },
      { href: "/admin/support", label: "Support", icon: LifeBuoy },
    ];
  }
  return [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/hours", label: "Monthly Hours", icon: BarChart3 },
    { href: "/dashboard/salary", label: "Salary Slip", icon: Wallet },
    { href: "/dashboard/leave", label: "Leave", icon: CalendarOff },
    { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  ];
}

function isActive(pathname: string, href: string) {
  // "/admin/employees" also covers its per-employee detail sub-route.
  if (href === "/admin/employees") return pathname.startsWith("/admin/employees");
  return pathname === href;
}

export function Sidebar({
  profile,
  notifications: initialNotifications = [],
}: {
  profile: Profile;
  notifications?: Notification[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const isAdmin = profile.role === "ADMIN";
  const items = navItems(isAdmin);
  const homeHref = isAdmin ? "/admin" : "/dashboard";

  // One shared poll for both bell instances below (desktop + mobile) — they
  // used to each run their own interval, silently doubling notification
  // request volume since both always show the same data anyway.
  useEffect(() => {
    const interval = setInterval(async () => {
      setNotifications(await getMyNotifications());
    }, NOTIFICATION_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  function handleMarkRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    markNotificationRead(id);
  }

  function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
    markAllNotificationsRead();
  }

  const body = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-6">
        <Link href={homeHref} onClick={() => setOpen(false)}>
          <Logo size="lg" />
        </Link>
        <NotificationBell
          notifications={notifications}
          onMarkRead={handleMarkRead}
          onMarkAllRead={handleMarkAllRead}
          align="left"
        />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isActive(pathname, href)
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-navy"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={profile.full_name} src={profile.avatar_url} size={38} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-navy">{profile.full_name}</div>
            <div className="truncate text-xs text-slate-400">
              {isAdmin ? "Administrator" : profile.position || "Employee"}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <SignOutButton />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur md:hidden">
        <Link href={homeHref}>
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell
            notifications={notifications}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
          />
          <button
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-navy"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-navy/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-soft">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
            >
              <X className="h-5 w-5" />
            </button>
            {body}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-200 bg-white md:block">
        {body}
      </aside>
    </>
  );
}
