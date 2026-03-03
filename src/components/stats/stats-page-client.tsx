"use client";

import { useState, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ── Color maps ──────────────────────────────────────────────────────────────────

const PROJECT_COLOR_HEX: Record<string, string> = {
  indigo: "#6366f1",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  cyan: "#06b6d4",
  violet: "#8b5cf6",
  orange: "#f97316",
  gray: "#6b7280",
};

const GRADIENT_ACCENTS = [
  { from: "#6366f1", to: "#8b5cf6" }, // indigo → violet
  { from: "#f97316", to: "#f43f5e" }, // orange → rose
  { from: "#06b6d4", to: "#10b981" }, // cyan → emerald
  { from: "#8b5cf6", to: "#ec4899" }, // violet → pink
];

// ── Types ───────────────────────────────────────────────────────────────────────

type TimeByProject = {
  id: string;
  name: string;
  color: string;
  minutes: number;
};

type DailyHours = {
  date: string;
  deep: number;
  light: number;
  admin: number;
};

type MetricSummary = {
  metricId: string;
  name: string;
  unit: string;
  icon: string;
  aggregation: string;
  value: number;
  prevValue: number;
  entries: { date: string; value: number }[];
};

interface StatsPageClientProps {
  initialData: {
    timeByProject: TimeByProject[];
    dailyHours: DailyHours[];
    metricSummaries: MetricSummary[];
  } | null;
}

type Range = "week" | "month" | "year";

const RANGE_LABELS: Record<Range, string> = {
  week: "This Week",
  month: "This Month",
  year: "This Year",
};

// ── Helpers ─────────────────────────────────────────────────────────────────────

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

function formatHours(m: number): string {
  const h = m / 60;
  if (h < 1) return `${Math.round(m)}m`;
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function trendPct(current: number, prev: number): { pct: number; up: boolean } | null {
  if (prev === 0 && current === 0) return null;
  if (prev === 0) return { pct: 100, up: true };
  const pct = Math.round(((current - prev) / prev) * 100);
  return { pct: Math.abs(pct), up: pct >= 0 };
}

const TOOLTIP_STYLE = {
  backgroundColor: "#1a1a2e",
  border: "1px solid rgba(99,102,241,0.2)",
  borderRadius: 12,
  color: "#e5e7eb",
  fontSize: 12,
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  backdropFilter: "blur(10px)",
};

// ── Micro-sparkline (pure CSS, no recharts overhead) ────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const areaPoints = [...points, `${w},${h}`, `0,${h}`].join(" ");
  return (
    <svg width={w} height={h} className="opacity-60">
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-${color.replace("#", "")})`} />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Activity Heatmap ────────────────────────────────────────────────────────────

function ActivityHeatmap({
  dailyHours,
  range,
}: {
  dailyHours: DailyHours[];
  range: Range;
}) {
  const { cells, maxHours, dayLabels } = useMemo(() => {
    const hoursMap = new Map<string, number>();
    for (const d of dailyHours) {
      hoursMap.set(d.date, d.deep + d.light + d.admin);
    }
    const maxH = Math.max(...Array.from(hoursMap.values()), 0.1);

    const numDays = range === "week" ? 7 : range === "month" ? 30 : 365;
    const today = new Date();
    const cells: { date: string; hours: number; dayOfWeek: number; weekIndex: number }[] = [];

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayOfWeek = d.getDay();
      const dayIndex = numDays - 1 - i;
      const weekIndex = Math.floor(dayIndex / 7);
      cells.push({
        date: dateStr,
        hours: hoursMap.get(dateStr) ?? 0,
        dayOfWeek,
        weekIndex,
      });
    }

    return { cells, maxHours: maxH, dayLabels: ["S", "M", "T", "W", "T", "F", "S"] };
  }, [dailyHours, range]);

  if (range === "week") {
    // Show as horizontal day cards
    return (
      <div className="flex gap-2">
        {cells.map((c) => {
          const intensity = maxHours > 0 ? c.hours / maxHours : 0;
          const d = new Date(c.date + "T12:00:00");
          return (
            <div
              key={c.date}
              className="flex-1 rounded-xl p-3 text-center transition-all hover:scale-105"
              style={{
                background: intensity > 0
                  ? `rgba(99,102,241,${0.08 + intensity * 0.35})`
                  : "rgba(42,42,60,0.3)",
                border: `1px solid rgba(99,102,241,${intensity > 0 ? 0.15 + intensity * 0.3 : 0.05})`,
              }}
            >
              <div className="text-[10px] text-gray-500 uppercase">
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div className="text-lg font-bold text-gray-200 mt-1">
                {c.hours > 0 ? c.hours.toFixed(1) : "-"}
              </div>
              <div className="text-[10px] text-gray-500">
                {c.hours > 0 ? "hrs" : ""}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Grid layout for month/year
  const numWeeks = Math.ceil(cells.length / 7);
  const cellSize = range === "year" ? 11 : 16;
  const gap = range === "year" ? 2 : 3;

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col justify-between pr-1" style={{ gap, height: 7 * (cellSize + gap) - gap }}>
          {dayLabels.map((label, i) => (
            <div key={i} className="text-[9px] text-gray-600 flex items-center" style={{ height: cellSize }}>
              {i % 2 === 1 ? label : ""}
            </div>
          ))}
        </div>
        {/* Grid */}
        <div
          className="grid"
          style={{
            gridTemplateRows: `repeat(7, ${cellSize}px)`,
            gridTemplateColumns: `repeat(${numWeeks}, ${cellSize}px)`,
            gridAutoFlow: "column",
            gap,
          }}
        >
          {cells.map((c) => {
            const intensity = maxHours > 0 ? c.hours / maxHours : 0;
            return (
              <div
                key={c.date}
                className="rounded-sm transition-all hover:ring-1 hover:ring-indigo-400/40"
                style={{
                  width: cellSize,
                  height: cellSize,
                  background: intensity > 0
                    ? `rgba(99,102,241,${0.15 + intensity * 0.7})`
                    : "rgba(42,42,60,0.25)",
                  boxShadow: intensity > 0.6 ? `0 0 ${4 + intensity * 6}px rgba(99,102,241,${intensity * 0.4})` : undefined,
                }}
                title={`${shortDate(c.date)}: ${c.hours.toFixed(1)}h`}
              />
            );
          })}
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3 text-[10px] text-gray-500">
        <span>Less</span>
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => (
          <div
            key={v}
            className="rounded-sm"
            style={{
              width: cellSize - 2,
              height: cellSize - 2,
              background: v === 0 ? "rgba(42,42,60,0.25)" : `rgba(99,102,241,${0.15 + v * 0.7})`,
            }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// ── Hero Stat Card ──────────────────────────────────────────────────────────────

function HeroCard({
  label,
  value,
  subtitle,
  icon,
  gradient,
  sparkData,
  sparkColor,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: string;
  gradient: { from: string; to: string };
  sparkData?: number[];
  sparkColor?: string;
}) {
  return (
    <div className="relative group overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1a1a2e]/80 p-5 transition-all duration-300 hover:border-white/[0.1] hover:shadow-lg hover:shadow-indigo-500/5">
      {/* Gradient glow background */}
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-15 group-hover:opacity-25 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle, ${gradient.from}, ${gradient.to})`,
        }}
      />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
            style={{
              background: `linear-gradient(135deg, ${gradient.from}20, ${gradient.to}20)`,
              border: `1px solid ${gradient.from}30`,
            }}
          >
            {icon}
          </div>
          {sparkData && sparkColor && (
            <Sparkline data={sparkData} color={sparkColor} />
          )}
        </div>
        <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
        <div className="text-xs text-gray-500 mt-1">{label}</div>
        {subtitle && (
          <div className="text-[11px] text-gray-600 mt-0.5">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────

export function StatsPageClient({ initialData }: StatsPageClientProps) {
  const [range, setRange] = useState<Range>("week");
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);

  const loadRange = async (r: Range) => {
    setRange(r);
    setLoading(true);
    try {
      const res = await fetch(`/api/stats?range=${r}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  // ── Derived stats ───────────────────────────────────────────────────────────

  const totalMinutes = data?.timeByProject.reduce((s, p) => s + p.minutes, 0) ?? 0;
  const dailyHours = data?.dailyHours ?? [];
  const metricSummaries = data?.metricSummaries ?? [];

  const { streak, totalBlocks, avgDaily, dailyTotalSpark } = useMemo(() => {
    const dh = data?.dailyHours ?? [];
    // Streak: count consecutive days from today backwards that have > 0 hours
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const entry = dh.find((e) => e.date === dateStr);
      if (entry && entry.deep + entry.light + entry.admin > 0) {
        streak++;
      } else if (i > 0) {
        break;
      }
      // Skip today if no data — streak might still be active from yesterday
    }

    const totalBlocks = dh.reduce(
      (s, d) => s + (d.deep > 0 ? 1 : 0) + (d.light > 0 ? 1 : 0) + (d.admin > 0 ? 1 : 0),
      0
    );

    const activeDays = dh.filter((d) => d.deep + d.light + d.admin > 0).length;
    const avgDaily = activeDays > 0 ? totalMinutes / activeDays : 0;

    const dailyTotalSpark = dh.map((d) => d.deep + d.light + d.admin);

    return { streak, totalBlocks, avgDaily, dailyTotalSpark };
  }, [data, totalMinutes]);

  const pieData = (data?.timeByProject ?? [])
    .filter((p) => p.minutes > 0)
    .map((p) => ({
      name: p.name,
      value: p.minutes,
      color: PROJECT_COLOR_HEX[p.color] ?? "#6b7280",
    }));

  const areaData = dailyHours.map((d) => ({
    ...d,
    total: d.deep + d.light + d.admin,
    label: shortDate(d.date),
  }));

  // Metric trend chart
  const trendMetric =
    selectedMetricId
      ? metricSummaries.find((m) => m.metricId === selectedMetricId) ?? metricSummaries[0]
      : metricSummaries[0];

  const trendData = (trendMetric?.entries ?? []).map((e) => ({
    date: shortDate(e.date),
    value: e.value,
  }));

  return (
    <div className="space-y-6">
      {/* ── Range Selector ─── */}
      <div className="flex items-center gap-3">
        <div className="flex gap-0.5 bg-[#12121c]/80 rounded-xl p-1 border border-white/[0.04]">
          {(["week", "month", "year"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => loadRange(r)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                range === r
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]"
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="w-3.5 h-3.5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            Loading
          </div>
        )}
      </div>

      <div className={`space-y-6 transition-opacity duration-300 ${loading ? "opacity-40 pointer-events-none" : ""}`}>

        {/* ── Hero Stats Row ─── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <HeroCard
            icon="⏱"
            label="Total Time"
            value={formatHours(totalMinutes)}
            subtitle={`across ${pieData.length} project${pieData.length !== 1 ? "s" : ""}`}
            gradient={GRADIENT_ACCENTS[0]}
            sparkData={dailyTotalSpark}
            sparkColor="#6366f1"
          />
          <HeroCard
            icon="🔥"
            label="Active Streak"
            value={`${streak} day${streak !== 1 ? "s" : ""}`}
            subtitle={streak > 3 ? "Keep it going!" : streak > 0 ? "Building momentum" : "Start today"}
            gradient={GRADIENT_ACCENTS[1]}
          />
          <HeroCard
            icon="⚡"
            label="Daily Average"
            value={formatHours(avgDaily)}
            subtitle="on active days"
            gradient={GRADIENT_ACCENTS[2]}
          />
          <HeroCard
            icon="✅"
            label="Sessions"
            value={String(totalBlocks)}
            subtitle={`in ${RANGE_LABELS[range].toLowerCase()}`}
            gradient={GRADIENT_ACCENTS[3]}
          />
        </section>

        {/* ── Activity Heatmap ─── */}
        <section className="rounded-2xl border border-white/[0.06] bg-[#1a1a2e]/80 p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Activity
          </h2>
          <ActivityHeatmap dailyHours={dailyHours} range={range} />
        </section>

        {/* ── Charts Row ─── */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Project Breakdown — Donut */}
          <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-[#1a1a2e]/80 p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              Project Breakdown
            </h2>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-sm text-gray-600">
                No completed blocks yet
              </div>
            ) : (
              <>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                        animationDuration={800}
                        animationEasing="ease-out"
                      >
                        {pieData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.color}
                            style={{ filter: `drop-shadow(0 0 6px ${entry.color}40)` }}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value: number | undefined) => [formatMinutes(value ?? 0), "Time"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{formatHours(totalMinutes)}</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total</div>
                    </div>
                  </div>
                </div>
                {/* Legend */}
                <div className="space-y-2 mt-2">
                  {pieData.map((p) => (
                    <div key={p.name} className="flex items-center gap-2.5 text-sm group">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-[#1a1a2e]"
                        style={{ background: p.color, boxShadow: `0 0 0 2px #1a1a2e, 0 0 0 3px ${p.color}40` }}
                      />
                      <span className="text-gray-400 flex-1 truncate group-hover:text-gray-200 transition-colors">
                        {p.name}
                      </span>
                      <span className="text-gray-300 font-medium tabular-nums">{formatMinutes(p.value)}</span>
                      <span className="text-gray-600 text-xs tabular-nums w-8 text-right">
                        {totalMinutes > 0 ? Math.round((p.value / totalMinutes) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Daily Activity — Area Chart */}
          <div className="lg:col-span-3 rounded-2xl border border-white/[0.06] bg-[#1a1a2e]/80 p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Daily Activity
            </h2>
            {areaData.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-sm text-gray-600">
                No data for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={areaData}>
                  <defs>
                    <linearGradient id="gradDeep" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradLight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradAdmin" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,42,60,0.5)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={{ stroke: "rgba(42,42,60,0.5)" }}
                    tickLine={false}
                    interval={range === "year" ? 29 : 0}
                  />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    unit="h"
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number | undefined, name: string | undefined) => [
                      `${value ?? 0}h`,
                      name === "deep" ? "Deep Focus" : name === "light" ? "Light Work" : "Admin",
                    ]}
                    labelStyle={{ color: "#9ca3af", marginBottom: 4 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="deep"
                    stackId="1"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#gradDeep)"
                    animationDuration={1000}
                  />
                  <Area
                    type="monotone"
                    dataKey="light"
                    stackId="1"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#gradLight)"
                    animationDuration={1200}
                  />
                  <Area
                    type="monotone"
                    dataKey="admin"
                    stackId="1"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#gradAdmin)"
                    animationDuration={1400}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
            {/* Inline legend */}
            <div className="flex items-center gap-5 mt-3 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded-full bg-indigo-500" />
                Deep Focus
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded-full bg-emerald-500" />
                Light Work
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded-full bg-amber-500" />
                Admin
              </div>
            </div>
          </div>
        </section>

        {/* ── Metrics Section ─── */}
        {metricSummaries.length > 0 && (
          <>
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                Metrics
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {metricSummaries.map((m) => {
                  const trend = trendPct(m.value, m.prevValue);
                  const sparkValues = m.entries.map((e) => e.value);
                  const metricColor = trend?.up !== false ? "#10b981" : "#f43f5e";
                  return (
                    <button
                      key={m.metricId}
                      onClick={() => setSelectedMetricId(m.metricId)}
                      className={`text-left relative group overflow-hidden rounded-2xl border p-4 transition-all duration-200 hover:shadow-lg hover:shadow-black/20 ${
                        selectedMetricId === m.metricId
                          ? "border-indigo-500/30 bg-indigo-500/[0.06]"
                          : "border-white/[0.06] bg-[#1a1a2e]/80 hover:border-white/[0.1]"
                      }`}
                    >
                      {/* Subtle glow on hover */}
                      <div
                        className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500"
                        style={{ background: metricColor }}
                      />
                      <div className="relative">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xl">{m.icon}</span>
                          {trend && (
                            <span
                              className={`text-[11px] font-medium px-1.5 py-0.5 rounded-md ${
                                trend.up
                                  ? "text-emerald-400 bg-emerald-400/10"
                                  : "text-red-400 bg-red-400/10"
                              }`}
                            >
                              {trend.up ? "+" : "-"}{trend.pct}%
                            </span>
                          )}
                        </div>
                        <div className="text-2xl font-bold text-white tabular-nums">
                          {Number.isInteger(m.value) ? m.value : m.value.toFixed(1)}
                          <span className="text-xs font-normal text-gray-500 ml-1">{m.unit}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate">{m.name}</div>
                        {sparkValues.length >= 2 && (
                          <div className="mt-2">
                            <Sparkline data={sparkValues} color={metricColor} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ── Metric Trend Chart ─── */}
            <section className="rounded-2xl border border-white/[0.06] bg-[#1a1a2e]/80 p-5">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Trend
                </h2>
                <select
                  value={selectedMetricId ?? trendMetric?.metricId ?? ""}
                  onChange={(e) => setSelectedMetricId(e.target.value || null)}
                  className="ml-auto rounded-xl bg-[#12121c]/80 border border-white/[0.06] px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/30 transition-colors"
                >
                  {metricSummaries.map((m) => (
                    <option key={m.metricId} value={m.metricId}>
                      {m.icon} {m.name}
                    </option>
                  ))}
                </select>
              </div>
              {trendData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-sm text-gray-600">
                  No entries for this metric in the selected period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="gradTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,42,60,0.5)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                      axisLine={{ stroke: "rgba(42,42,60,0.5)" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      unit={` ${trendMetric?.unit ?? ""}`}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value: number | undefined) => [
                        `${value ?? 0} ${trendMetric?.unit ?? ""}`,
                        trendMetric?.name ?? "Value",
                      ]}
                      labelStyle={{ color: "#9ca3af", marginBottom: 4 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#8b5cf6"
                      strokeWidth={2.5}
                      fill="url(#gradTrend)"
                      dot={{ fill: "#8b5cf6", r: 3, strokeWidth: 0 }}
                      activeDot={{
                        r: 6,
                        fill: "#8b5cf6",
                        stroke: "#1a1a2e",
                        strokeWidth: 2,
                      }}
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </section>
          </>
        )}

        {/* ── Empty State ─── */}
        {metricSummaries.length === 0 && totalMinutes === 0 && (
          <div className="text-center py-20">
            <div className="relative inline-block mb-4">
              <div className="text-5xl">📊</div>
              <div className="absolute inset-0 blur-2xl opacity-20 bg-indigo-500 rounded-full" />
            </div>
            <p className="text-sm text-gray-400">No data yet for {RANGE_LABELS[range].toLowerCase()}</p>
            <p className="text-xs text-gray-600 mt-1.5">Complete tasks to start tracking your progress</p>
          </div>
        )}
      </div>
    </div>
  );
}
