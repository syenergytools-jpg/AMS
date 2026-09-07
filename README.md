# Evolut Attendance Management System

A clean, production-ready employee attendance system for **Evolut Ecommerce Solutions**.
Built with **Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase** (Auth, Postgres, Storage).

## Features

- **Employee self-registration** — full name, work email, password, **CNIC**, **phone**, **address**, department, position, **shift start/end time**, and **profile photo**.
- **One-tap check-in / check-out** with automatic *Late* detection (checking in more than 30 minutes after your own shift start).
- **Personal dashboard** — today's status, profile card, and 14-day attendance history.
- **Monthly hours tab** — each employee sees a chart of hours worked per day this month against their shift target, plus working days/expected/completed/completion-% stats and a full daily breakdown table. Approved leave days show as their own "On leave" status (not Absent) and are excluded from expected hours.
- **Admin overview** — live counts (present / late / not-in) and a real-time table of who's in today.
- **Employee directory** — searchable cards with full profiles and per-employee 30-day attendance history, with admin-editable check-in/check-out times for correcting or backfilling any day. Each employee's page also shows their leave history, with approve/reject directly there.
- **Salary slips** — admin sets basic salary/allowances/deductions per employee per month; each employee gets a "Salary Slip" tab to view or download a PDF payslip (with an attendance summary for that month baked in). Deductions can be auto-calculated from attendance shortfall (short a full shift's hours costs one day's pay, proportionally).
- **Company-wide Salary page (admin)** — every employee for the selected month in one table: basic/allowances/deductions/net pay and a Paid/Pending status at a glance, with the same salary editor expandable inline per row — no need to open each employee's profile individually.
- **Leave requests** — employees request time off (date range, type, reason) from a "Leave" tab and can withdraw a request while it's still pending; admins review and approve/reject from their own "Leave" tab, with a banner on the admin overview when requests are waiting. Approved leave days are excluded entirely from that month's expected hours, so an excused absence never triggers the salary auto-deduction the way an unexcused one does.
- **Role-based access** — employees see only their own data; admins see everyone (enforced by Postgres Row-Level Security).
- **ZKTeco K50 fingerprint sync (optional)** — a bridge script pulls punches from a physical K50 terminal and turns them into check-in/check-out records automatically.
- Clean, responsive UI in the Evolut navy brand palette.

---

## Quick start

### 1. Create a Supabase project
Go to <https://supabase.com> → **New project**. Once it's ready, open **Project Settings → API** and copy:
- Project URL
- `anon` public key
- `service_role` key (keep secret)

### 2. Run the database schema
In Supabase: **SQL Editor → New query**, paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
This creates the `profiles` and `attendance` tables, the `avatars` storage bucket, and all RLS policies.

### 3. Configure environment variables
```bash
cp .env.local.example .env.local
```
Fill in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_BOOTSTRAP_ADMIN_EMAIL=admin@evolutecomsolutions.com
```
> The email set in `NEXT_PUBLIC_BOOTSTRAP_ADMIN_EMAIL` automatically becomes an **ADMIN** when it registers. Everyone else is an **EMPLOYEE**.

### 4. Install & run
```bash
npm install
npm run dev
```
Open <http://localhost:3000>.

### 5. First login
1. Go to **/register** and sign up using the bootstrap admin email → you land on the admin-enabled dashboard.
2. Register more accounts (any other email) as employees.
3. Employees check in/out from their dashboard; the admin sees everything at **/admin**.

---

## Deploy to Vercel
1. Push the branch you want live to GitHub, then import the repo at <https://vercel.com/new>.
   (This project already has a GitHub remote set up — see `git remote -v`.)
2. Add the same four environment variables from `.env` in
   **Vercel → Project → Settings → Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_BOOTSTRAP_ADMIN_EMAIL`.
   Don't add the `ZKTECO_*` vars here — the sync script never runs on Vercel (see below), those only
   belong in `.env.local` on whatever PC runs `npm run sync:zkteco`.
3. Deploy. (No build config needed — it's a standard Next.js app.)

### Custom domain (e.g. `attendance.evolutecomsolutions.com`)
1. In the Vercel project → **Settings → Domains**, add the subdomain you want.
2. Vercel shows a DNS record to create — for a subdomain this is a **CNAME** record
   (`attendance` → `cname.vercel-dns.com`, exact target shown in the Vercel UI). Add it wherever
   `evolutecomsolutions.com`'s DNS is managed (your registrar or DNS host).
3. Wait for DNS to propagate (minutes to a few hours) — Vercel auto-issues SSL once it verifies.
4. In Supabase: **Authentication → URL Configuration**, add the new domain as the **Site URL** so
   auth email templates and future redirect-based flows point at the right place.

### A note on the ZKTeco sync and Vercel
Moving the web app to Vercel doesn't change anything about the K50 integration — the bridge
script (`npm run sync:zkteco`) never talks to the Next.js server at all; it talks directly to
Supabase (cloud) and separately to the device (LAN). It still has to run on a PC that's physically
on the same local network as the K50, regardless of where the web app itself is hosted.

To promote another existing user to admin later, run in Supabase SQL Editor:
```sql
update public.profiles set role = 'ADMIN' where email = 'someone@evolutecomsolutions.com';
```

---

## ZKTeco K50 fingerprint sync (optional)

The K50 is a standalone LAN device — it can't reach Supabase itself, and Supabase can't reach a
device sitting behind your office router. So a small bridge script runs on a PC on the **same
local network as the terminal**, polls it every minute or so over ZKTeco's TCP protocol, and
writes any new fingerprint punches into the `attendance` table — the same table the web
dashboard's check-in/out buttons write to, so both merge cleanly. The web app itself can still be
deployed to Vercel as usual; only the bridge script needs to be near the device.

**What it doesn't do:** enroll fingerprints. That only happens on the terminal's own keypad, the
same as always — this just syncs the punches it records afterward.

### Setup
1. On the K50: **Menu → COMM. → Ethernet** — give it a static LAN IP (or reserve one on your
   router) and note it down. If a "Comm Key" password is set under COMM., note that too.
2. Re-run [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor — it's safe to re-run and
   adds a `device_user_id` column to `profiles`.
3. In the web app: **Admin → Employees → (an employee)** → under **Fingerprint device user ID**,
   enter the numeric ID that employee was assigned when their finger was enrolled on the K50, and
   save. Repeat for each employee who uses the terminal.
4. On a PC that's on the same network as the K50, set these in `.env.local` (see
   `.env.local.example`): `ZKTECO_DEVICE_IP`, and the Supabase vars from step 3 above.
5. Run the bridge and leave it running:
   ```bash
   npm run sync:zkteco
   ```
   To keep it running unattended, use Windows Task Scheduler ("run at log on") or a process
   manager like `pm2` — it's a plain long-running Node process, nothing Next.js-specific.

**Notes / limits:** every poll re-reads the device's full log and filters to the last
`ZKTECO_LOOKBACK_DAYS` (default 2), so it stays correct even if a poll is missed — but on a device
with a very large log history, that means each poll cost scales with total logs stored, not just
new ones. Multiple punches in a day collapse to earliest = check-in, latest = check-out (the K50
doesn't distinguish break in/out from day in/out on its own). I wasn't able to test this end-to-end
against physical hardware — verify connectivity and the Comm Key setting against your actual unit.

---

## Project structure
```
src/
  app/
    (auth)/login, (auth)/register   # branded auth screens
    dashboard/                      # employee: check-in/out + history
    admin/                          # admin overview + employee directory
    api/register/                   # server-side account + photo + profile creation
  components/                       # Logo, Avatar, header, badges, cards
  lib/
    supabase/                       # browser / server / middleware clients
    data.ts, format.ts, types.ts
scripts/zkteco-sync.js              # optional: K50 fingerprint device bridge
supabase/schema.sql                 # run once in Supabase
```

## Notes
- **Shift & late rule**: each employee has their own `shift_start`/`shift_end` (set at registration); checking in after `shift_start` marks that day `LATE`. See `src/app/dashboard/actions.ts`.
- Times use **Pakistan Standard Time (UTC+5)**.
- Profile photos are stored in the public `avatars` bucket; account creation & uploads happen server-side with the service-role key so the browser never sees it.
