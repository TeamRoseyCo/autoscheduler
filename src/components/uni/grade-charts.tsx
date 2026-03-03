"use client";

import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const COURSE_COLORS = [
  "#818cf8", "#60a5fa", "#34d399", "#a78bfa", "#f472b6",
  "#fbbf24", "#fb923c", "#2dd4bf", "#e879f9", "#f87171",
];

interface GradeChartsProps {
  grades: any[];
  courses: any[];
}

export function GradeCharts({ grades, courses }: GradeChartsProps) {
  // Grades over time per course
  const timeData = useMemo(() => {
    const sorted = [...grades]
      .filter((g) => g.date && g.maxScore > 0)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const points: any[] = [];
    for (const g of sorted) {
      const dateStr = new Date(g.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const courseCode = g.course?.code || "N/A";
      const pct = (g.score / g.maxScore) * 100;
      let point = points.find((p) => p.date === dateStr);
      if (!point) {
        point = { date: dateStr };
        points.push(point);
      }
      point[courseCode] = pct;
    }
    return points;
  }, [grades]);

  // Grades by category
  const categoryData = useMemo(() => {
    const cats: Record<string, { total: number; count: number }> = {};
    for (const g of grades) {
      if (g.maxScore > 0) {
        const cat = g.category || "other";
        if (!cats[cat]) cats[cat] = { total: 0, count: 0 };
        cats[cat].total += (g.score / g.maxScore) * 100;
        cats[cat].count += 1;
      }
    }
    return Object.entries(cats).map(([name, { total, count }]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      average: total / count,
    }));
  }, [grades]);

  const courseCodesInData = useMemo(() => {
    const codes = new Set<string>();
    grades.forEach((g) => { if (g.course?.code) codes.add(g.course.code); });
    return Array.from(codes);
  }, [grades]);

  if (grades.length < 2) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Grade trends */}
      <div className="p-4 rounded-lg bg-[#12121c] border border-[#2a2a3c]">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Grade Trends</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={timeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3c" />
            <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1e1e30", border: "1px solid #2a2a3c", borderRadius: "8px" }}
              labelStyle={{ color: "#fff" }}
            />
            {courseCodesInData.map((code, i) => (
              <Area
                key={code}
                type="monotone"
                dataKey={code}
                stroke={COURSE_COLORS[i % COURSE_COLORS.length]}
                fill={COURSE_COLORS[i % COURSE_COLORS.length]}
                fillOpacity={0.1}
                strokeWidth={2}
              />
            ))}
            <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* By category */}
      <div className="p-4 rounded-lg bg-[#12121c] border border-[#2a2a3c]">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Average by Category</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={categoryData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3c" />
            <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1e1e30", border: "1px solid #2a2a3c", borderRadius: "8px" }}
              labelStyle={{ color: "#fff" }}
              formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, "Average"]}
            />
            <Bar dataKey="average" fill="#818cf8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
