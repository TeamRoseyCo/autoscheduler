"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

// Project color name → hex
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

function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

function TrendArrow({ current, prev }: { current: number; prev: number }) {
  if (prev === 0 && current === 0) return null;
  if (prev === 0) return <span className="text-emerald-400 text-xs">↑ new</span>;
  const pct = Math.round(((current - prev) / prev) * 100);
  if (pct === 0) return <span className="text-gray-500 text-xs">—</span>;
  const up = pct > 0;
  return (
    <span className={`text-xs ${up ? "text-emerald-400" : "text-red-400"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct)}%
    </span>
  );
}

// Format short date label for axis
function shortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const CUSTOM_TOOLTIP_STYLE = {
  backgroundColor: "#1e1e30",
  border: "1px solid #2a2a3c",
  borderRadius: 8,
  color: "#e5e7eb",
  fontSize: 12,
};

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

  const totalMinutes = data?.timeByProject.reduce((s, p) => s + p.minutes, 0) ?? 0;

  const pieData = (data?.timeByProject ?? [])
    .filter((p) => p.minutes > 0)
    .map((p) => ({
      name: p.name,
      value: p.minutes,
      color: PROJECT_COLOR_HEX[p.color] ?? "#6b7280",
    }));

  const barData = (data?.dailyHours ?? []).map((d) => ({
    ...d,
    label: shortDate(d.date),
  }));

  const metricSummaries = data?.metricSummaries ?? [];

  // Selected metric for trend chart
  const trendMetric =
    selectedMetricId
      ? metricSummaries.find((m) => m.metricId === selectedMetricId) ?? metricSummaries[0]
      : metricSummaries[0];

  const trendData = (trendMetric?.entries ?? []).map((e) => ({
    date: shortDate(e.date),
    value: e.value,
  }));

  return (
    <div className="space-y-8">
      {/* Range tabs */}
      <div className="flex gap-1 bg-[#12121c] rounded-lg p-1 w-fit">
        {(["week", "month", "year"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => loadRange(r)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              range === r
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-sm text-gray-500">Loading...</div>
      )}

      <div className={`space-y-8 ${loading ? "opacity-50 pointer-events-none" : ""}`}>
        {/* ─── Section 1: Time Overview ─── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#1e1e30] border border-[#2a2a3c] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Time by Project</h2>
            {pieData.length === 0 ? (
              <p className="text-sm text-gray-600">No completed blocks in this period.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={CUSTOM_TOOLTIP_STYLE}
                      formatter={(value: number | undefined) => [formatMinutes(value ?? 0), "Time"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-3">
                  {pieData.map((p) => (
                    <div key={p.name} className="flex items-center gap-2 text-sm">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      <span className="text-gray-300 flex-1 truncate">{p.name}</span>
                      <span className="text-gray-500">{formatMinutes(p.value)}</span>
                      <span className="text-gray-600 text-xs">
                        {totalMinutes > 0 ? Math.round((p.value / totalMinutes) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-[#2a2a3c] flex justify-between text-sm">
                    <span className="text-gray-500">Total</span>
                    <span className="text-gray-300 font-medium">{formatMinutes(totalMinutes)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ─── Section 2: Daily Hours ─── */}
          <div className="bg-[#1e1e30] border border-[#2a2a3c] rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Daily Hours</h2>
            {barData.length === 0 ? (
              <p className="text-sm text-gray-600">No data for this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} barSize={range === "year" ? 4 : 12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3c" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={{ stroke: "#2a2a3c" }}
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
                    contentStyle={CUSTOM_TOOLTIP_STYLE}
                    formatter={(value: number | undefined, name: string | undefined) => [
                      `${value ?? 0}h`,
                      name === "deep" ? "Deep Focus" : name === "light" ? "Light Work" : "Admin",
                    ]}
                  />
                  <Legend
                    formatter={(value) =>
                      value === "deep" ? "Deep" : value === "light" ? "Light" : "Admin"
                    }
                    wrapperStyle={{ fontSize: 11, color: "#6b7280" }}
                  />
                  <Bar dataKey="deep" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="light" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="admin" stackId="a" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* ─── Section 3: Metric Summary Cards ─── */}
        {metricSummaries.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Metric Summaries
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {metricSummaries.map((m) => (
                <div
                  key={m.metricId}
                  className="bg-[#1e1e30] border border-[#2a2a3c] rounded-xl p-4 space-y-1"
                >
                  <div className="text-xl">{m.icon}</div>
                  <div className="text-xs text-gray-500 truncate">{m.name}</div>
                  <div className="text-2xl font-bold text-gray-100">
                    {Number.isInteger(m.value) ? m.value : m.value.toFixed(1)}
                    <span className="text-sm font-normal text-gray-500 ml-1">{m.unit}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="capitalize">{m.aggregation}</span>
                    <TrendArrow current={m.value} prev={m.prevValue} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Section 4: Metric Trend Chart ─── */}
        {metricSummaries.length > 0 && (
          <section className="bg-[#1e1e30] border border-[#2a2a3c] rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-semibold text-gray-300">Metric Trend</h2>
              <select
                value={selectedMetricId ?? trendMetric?.metricId ?? ""}
                onChange={(e) => setSelectedMetricId(e.target.value || null)}
                className="ml-auto rounded-lg bg-[#12121c] border border-[#2a2a3c] px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50"
              >
                {metricSummaries.map((m) => (
                  <option key={m.metricId} value={m.metricId}>
                    {m.icon} {m.name}
                  </option>
                ))}
              </select>
            </div>
            {trendData.length === 0 ? (
              <p className="text-sm text-gray-600">No entries for this metric in the selected period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3c" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={{ stroke: "#2a2a3c" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    unit={` ${trendMetric?.unit ?? ""}`}
                  />
                  <Tooltip
                    contentStyle={CUSTOM_TOOLTIP_STYLE}
                    formatter={(value: number | undefined) => [
                      `${value ?? 0} ${trendMetric?.unit ?? ""}`,
                      trendMetric?.name ?? "Value",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ fill: "#6366f1", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </section>
        )}

        {metricSummaries.length === 0 && totalMinutes === 0 && (
          <div className="text-center py-16 text-gray-600">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-sm">No data yet for {RANGE_LABELS[range].toLowerCase()}.</p>
            <p className="text-xs mt-1">Complete tasks to start tracking your progress.</p>
          </div>
        )}
      </div>
    </div>
  );
}
