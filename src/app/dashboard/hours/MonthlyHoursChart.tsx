"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { formatHours } from "@/lib/format";
import { STATUS_COLOR, STATUS_LABEL, type DayHours, type DayStatus } from "./status";

const STATUS_ORDER: DayStatus[] = ["MET", "PARTIAL", "ABSENT", "ON_LEAVE", "UPCOMING"];

/** A zero-hour day (absent, upcoming, or checked in with nothing elapsed yet) still
 * needs a visible, hoverable mark — a true 0 renders no bar and nothing to hover. */
const MIN_BAR_HOURS = 0.25;

interface ChartRow extends DayHours {
  barValue: number;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartRow }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-soft">
      <div className="font-semibold text-navy">{d.label}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[d.status] }} />
        <span className="font-medium text-navy">
          {d.status === "ON_LEAVE" ? "—" : d.inProgress ? "In progress" : formatHours(d.hours)}
        </span>
        <span className="text-slate-400">· {STATUS_LABEL[d.status]}</span>
      </div>
    </div>
  );
}

export function MonthlyHoursChart({ data, targetHours }: { data: DayHours[]; targetHours: number }) {
  const counts = data.reduce<Record<DayStatus, number>>(
    (acc, d) => ({ ...acc, [d.status]: (acc[d.status] ?? 0) + 1 }),
    { MET: 0, PARTIAL: 0, ABSENT: 0, ON_LEAVE: 0, UPCOMING: 0 }
  );
  const tickInterval = data.length > 15 ? 1 : 0;
  const chartData: ChartRow[] = data.map((d) => ({ ...d, barValue: Math.max(d.hours, MIN_BAR_HOURS) }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={{ stroke: "#e2e8f0" }}
            tickLine={false}
            interval={tickInterval}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={28}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
          <ReferenceLine
            y={targetHours}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            label={{
              value: `Target ${formatHours(targetHours)}`,
              position: "insideTopRight",
              fill: "#64748b",
              fontSize: 11,
            }}
          />
          <Bar dataKey="barValue" radius={[4, 4, 0, 0]} barSize={18} activeBar={{ stroke: "#0B1B2E", strokeWidth: 1.5 }}>
            {chartData.map((d) => (
              <Cell key={d.date} fill={STATUS_COLOR[d.status]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        {STATUS_ORDER.map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: STATUS_COLOR[s] }} />
            {STATUS_LABEL[s]} ({counts[s]})
          </div>
        ))}
      </div>
    </div>
  );
}
