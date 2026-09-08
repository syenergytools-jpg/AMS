"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { getMyNotifications, markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import type { Notification } from "@/lib/types";

const POLL_MS = 45_000;

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-PK", { day: "2-digit", month: "short" });
}

export function NotificationBell({
  initial,
  align = "right",
}: {
  initial: Notification[];
  /** Which side the dropdown's edge anchors to relative to the bell. Use
   * "left" when the bell sits near the right edge of a narrow column (e.g.
   * the sidebar header) — anchoring "right" there pushes the panel off the
   * left edge of the viewport instead of into the visible content area. */
  align?: "left" | "right";
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initial);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  useEffect(() => {
    const interval = setInterval(async () => {
      const fresh = await getMyNotifications();
      setNotifications(fresh);
    }, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function onSelect(n: Notification) {
    if (!n.read_at) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      markNotificationRead(n.id);
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  function onMarkAllRead() {
    setNotifications((prev) => prev.map((x) => (x.read_at ? x : { ...x, read_at: new Date().toISOString() })));
    markAllNotificationsRead();
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-100 bg-white shadow-soft ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-navy">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onSelect(n)}
                  className={`block w-full border-b border-slate-50 px-4 py-3 text-left transition last:border-0 hover:bg-slate-50 ${
                    n.read_at ? "" : "bg-brand-50/50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />}
                    <div className={`min-w-0 flex-1 ${n.read_at ? "pl-3.5" : ""}`}>
                      <p className="text-sm text-slate-700">{n.message}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
