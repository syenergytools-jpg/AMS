/**
 * Bridges a ZKTeco K50 fingerprint terminal to the attendance database.
 *
 * The K50 is a standalone LAN device — it has no way to reach Supabase (a
 * cloud service) on its own, and Supabase has no way to reach a device that
 * sits behind the office router/NAT. So this script runs on a PC that's on
 * the SAME local network as the terminal, polls it periodically over the
 * ZKTeco TCP protocol (port 4370), and writes any new fingerprint punches
 * into the same `attendance` table the web dashboard's check-in/out buttons
 * use — so both sources of truth merge cleanly.
 *
 * It does NOT enroll fingerprints — that only happens on the terminal itself.
 * An admin maps each employee to the numeric "user ID" the terminal assigned
 * during enrollment from Admin -> Employees -> (employee) in the web app.
 *
 * Usage:
 *   npm run sync:zkteco
 *
 * Config (see .env.local.example):
 *   ZKTECO_DEVICE_IP               required, e.g. 192.168.1.201
 *   ZKTECO_DEVICE_PORT             default 4370
 *   ZKTECO_COMM_KEY                default 0 (device's numeric "Comm Key", if set)
 *   ZKTECO_POLL_INTERVAL_SECONDS   default 60
 *   ZKTECO_LOOKBACK_DAYS           default 2 — how much device history to consider each poll
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const ZKLib = require("node-zklib");
const { createClient } = require("@supabase/supabase-js");

const DEVICE_IP = process.env.ZKTECO_DEVICE_IP;
const DEVICE_PORT = Number(process.env.ZKTECO_DEVICE_PORT || 4370);
const COMM_KEY = Number(process.env.ZKTECO_COMM_KEY || 0);
const POLL_SECONDS = Number(process.env.ZKTECO_POLL_INTERVAL_SECONDS || 60);
const LOOKBACK_DAYS = Number(process.env.ZKTECO_LOOKBACK_DAYS || 2);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DEVICE_IP) {
  console.error("[zkteco-sync] Set ZKTECO_DEVICE_IP in .env (the K50's LAN IP address).");
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("[zkteco-sync] Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Splits a UTC Date into Pakistan Standard Time (UTC+5, no DST) parts. */
function pktParts(date) {
  const pkt = new Date(date.getTime() + 5 * 3600 * 1000);
  return {
    workDate: pkt.toISOString().slice(0, 10),
    hour: pkt.getUTCHours(),
    minute: pkt.getUTCMinutes(),
  };
}

// Keep in sync with LATE_GRACE_MINUTES / isLateCheckIn in src/lib/format.ts —
// this script runs standalone and can't import from the Next.js app.
const LATE_GRACE_MINUTES = 30;

function isLateCheckIn(hour, minute, shiftStart) {
  const [shiftHour, shiftMinute] = (shiftStart || "09:00").split(":").map(Number);
  return hour * 60 + minute > shiftHour * 60 + shiftMinute + LATE_GRACE_MINUTES;
}

async function syncOnce() {
  const { data: mapped, error: profErr } = await admin
    .from("profiles")
    .select("id, shift_start, device_user_id")
    .not("device_user_id", "is", null);
  if (profErr) {
    console.error("[zkteco-sync] could not load employee mappings:", profErr.message);
    return;
  }

  const byDeviceId = new Map(mapped.map((p) => [String(p.device_user_id), p]));
  if (byDeviceId.size === 0) {
    console.log(
      "[zkteco-sync] no employees are mapped to a device user ID yet " +
        "(Admin -> Employees -> pick someone -> Fingerprint device user ID) — skipping."
    );
    return;
  }

  const zk = new ZKLib(DEVICE_IP, DEVICE_PORT, 10000, 4000, COMM_KEY, "tcp");
  try {
    await zk.createSocket();
  } catch (err) {
    console.error(
      `[zkteco-sync] could not connect to ${DEVICE_IP}:${DEVICE_PORT} —`,
      err?.err?.message || err
    );
    return;
  }

  try {
    const { data: logs, err: logsErr } = await zk.getAttendances();
    if (logsErr) {
      console.error("[zkteco-sync] device returned an error reading logs:", logsErr);
      return;
    }

    const cutoff = Date.now() - LOOKBACK_DAYS * 86_400_000;

    // Group recent punches by (employee, work day) — earliest scan of the
    // day becomes check-in, latest becomes check-out (if there's more than one).
    const groups = new Map();
    for (const log of logs || []) {
      const profile = byDeviceId.get(String(log.deviceUserId));
      if (!profile) continue;
      const scannedAt = log.recordTime instanceof Date ? log.recordTime : new Date(log.recordTime);
      if (Number.isNaN(scannedAt.getTime()) || scannedAt.getTime() < cutoff) continue;

      const { workDate } = pktParts(scannedAt);
      const key = `${profile.id}|${workDate}`;
      if (!groups.has(key)) {
        groups.set(key, { userId: profile.id, workDate, shiftStart: profile.shift_start, scans: [] });
      }
      groups.get(key).scans.push(scannedAt);
    }

    let saved = 0;
    for (const { userId, workDate, shiftStart, scans } of groups.values()) {
      scans.sort((a, b) => a.getTime() - b.getTime());
      const first = scans[0];
      const last = scans[scans.length - 1];

      const { data: existing } = await admin
        .from("attendance")
        .select("check_in, check_out")
        .eq("user_id", userId)
        .eq("work_date", workDate)
        .maybeSingle();

      const check_in =
        existing?.check_in && new Date(existing.check_in) < first ? existing.check_in : first.toISOString();
      const check_out =
        scans.length > 1
          ? existing?.check_out && new Date(existing.check_out) > last
            ? existing.check_out
            : last.toISOString()
          : existing?.check_out ?? null;

      const { hour, minute } = pktParts(new Date(check_in));
      const isLate = isLateCheckIn(hour, minute, shiftStart);

      const { error: upsertErr } = await admin.from("attendance").upsert(
        {
          user_id: userId,
          work_date: workDate,
          check_in,
          check_out,
          status: isLate ? "LATE" : "PRESENT",
        },
        { onConflict: "user_id,work_date" }
      );

      if (upsertErr) console.error(`[zkteco-sync] failed to save ${userId} ${workDate}:`, upsertErr.message);
      else saved++;
    }

    console.log(
      `[zkteco-sync] ${new Date().toISOString()} — ${logs?.length ?? 0} device logs, ` +
        `${groups.size} day-records touched, ${saved} saved.`
    );
  } finally {
    await zk.disconnect();
  }
}

async function main() {
  console.log(
    `[zkteco-sync] starting — device ${DEVICE_IP}:${DEVICE_PORT}, polling every ${POLL_SECONDS}s, ` +
      `${LOOKBACK_DAYS}-day lookback. Ctrl+C to stop.`
  );
  await syncOnce().catch((err) => console.error("[zkteco-sync] unexpected error:", err));
  setInterval(() => {
    syncOnce().catch((err) => console.error("[zkteco-sync] unexpected error:", err));
  }, POLL_SECONDS * 1000);
}

main();
