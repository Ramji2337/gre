"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";

interface ScorePoint {
  test_title: string;
  test_id: string;
  allocation_id: string;
  date: string;
  verbal_score: number;
  quant_score: number;
  overall_score: number;
  verbal_accuracy: number;
  quant_accuracy: number;
  overall_accuracy: number;
}

interface TopicStat {
  category: string;
  subject: string;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number;
}

interface DifficultyStat {
  difficulty: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface AdaptiveEntry {
  test_title: string;
  section: string;
  subject: string;
  difficulty: string;
  module: string;
  section_score: number;
  section_total: number;
}

interface AnalyticsData {
  score_progression: ScorePoint[];
  topic_stats: TopicStat[];
  difficulty_stats: DifficultyStat[];
  adaptive_history: AdaptiveEntry[];
  improvement: any;
  strengths: TopicStat[];
  weaknesses: TopicStat[];
  aggregate: {
    tests_completed: number;
    total_questions: number;
    total_attempted: number;
    total_correct: number;
    overall_accuracy: number;
    verbal_score: number;
    quant_score: number;
    overall_score: number;
    verbal_accuracy: number;
    quant_accuracy: number;
    verbal_correct: number;
    verbal_total: number;
    quant_correct: number;
    quant_total: number;
  };
}

function ScoreAreaChart({ progression }: { progression: ScorePoint[] }) {
  if (progression.length < 2) {
    return <p className="text-sm text-gray-400 text-center py-8">Take at least 2 tests to see score progression.</p>;
  }
  const top = progression.slice(0, 10);
  const w = 520;
  const h = 180;
  const padL = 36;
  const padR = 16;
  const padT = 20;
  const padB = 36;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const allScores = top.flatMap((p) => [p.verbal_score, p.quant_score, p.overall_score]);
  const minS = Math.min(...allScores) - 5;
  const maxS = Math.max(...allScores) + 5;
  const range = maxS - minS || 1;
  const stepX = plotW / (top.length - 1);

  const toX = (i: number) => padL + i * stepX;
  const toY = (val: number) => padT + plotH - ((val - minS) / range) * plotH;

  // Determine x-axis label format based on time span between first and last test
  const firstDate = new Date(top[0].date);
  const lastDate = new Date(top[top.length - 1].date);
  const spanMs = lastDate.getTime() - firstDate.getTime();
  const spanDays = spanMs / (1000 * 60 * 60 * 24);

  type LabelMode = "day" | "week" | "month";
  let labelMode: LabelMode = "day";
  if (spanDays <= 7) labelMode = "day";
  else if (spanDays <= 60) labelMode = "week";
  else labelMode = "month";

  const formatLabel = (dateStr: string, mode: LabelMode) => {
    const d = new Date(dateStr);
    if (mode === "day") {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    if (mode === "week") {
      const weekNum = Math.ceil(((d.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24) + 1) / 7);
      return `Wk ${weekNum}`;
    }
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  };

  const makeLinePath = (getter: (p: ScorePoint) => number) =>
    top.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(getter(p))}`).join(" ");

  const makeAreaPath = (getter: (p: ScorePoint) => number) =>
    `${makeLinePath(getter)} L ${toX(top.length - 1)} ${padT + plotH} L ${toX(0)} ${padT + plotH} Z`;

  const overallLine = makeLinePath((p) => p.overall_score);
  const overallArea = makeAreaPath((p) => p.overall_score);
  const verbalLine = makeLinePath((p) => p.verbal_score);
  const quantLine = makeLinePath((p) => p.quant_score);

  return (
    <div className="flex items-start gap-4">
      <div className="overflow-x-auto flex-1">
        <svg viewBox={`0 0 ${w} ${h}`} style={{ minWidth: "480px", width: "100%", height: "auto" }}>
          <defs>
            <linearGradient id="overallGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="verbalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64748b" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#64748b" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="quantGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((r) => {
            const y = padT + r * plotH;
            const val = Math.round(maxS - r * range);
            return (
              <g key={r}>
                <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={padL - 4} y={y + 3} textAnchor="end" className="fill-gray-400" style={{ fontSize: "8px" }}>{val}</text>
              </g>
            );
          })}
          {/* Quant area + line */}
          <path d={makeAreaPath((p) => p.quant_score)} fill="url(#quantGrad)" />
          <path d={quantLine} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />
          {/* Verbal area + line */}
          <path d={makeAreaPath((p) => p.verbal_score)} fill="url(#verbalGrad)" />
          <path d={verbalLine} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />
          {/* Overall area + line (on top) */}
          <path d={overallArea} fill="url(#overallGrad)" />
          <path d={overallLine} fill="none" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {top.map((p, i) => {
            const op = { x: toX(i), y: toY(p.overall_score) };
            return (
              <g key={i}>
                <circle cx={op.x} cy={op.y} r="3" fill="#1e293b" />
                <text x={op.x} y={op.y - 8} textAnchor="middle" className="fill-gray-700 font-bold" style={{ fontSize: "8px" }}>{p.overall_score}</text>
                <text x={op.x} y={h - 8} textAnchor="middle" className="fill-gray-400" style={{ fontSize: "7px" }}>{formatLabel(p.date, labelMode)}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="space-y-2 text-xs flex-shrink-0 pt-2">
        <div className="flex items-center gap-2"><span className="w-4 h-0.5 bg-slate-800" /><span className="text-gray-600">Overall</span></div>
        <div className="flex items-center gap-2"><span className="w-4 h-0.5 border-t border-dashed border-slate-500" /><span className="text-gray-600">Verbal</span></div>
        <div className="flex items-center gap-2"><span className="w-4 h-0.5 border-t border-dashed border-slate-400" /><span className="text-gray-600">Quant</span></div>
      </div>
    </div>
  );
}

function AccuracyBarChart({ topics }: { topics: TopicStat[] }) {
  if (topics.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No topic data available yet.</p>;
  }
  const top = topics.slice(0, 12);
  const chartW = 560;
  const chartH = 200;
  const padL = 28;
  const padB = 60;
  const padT = 16;
  const padR = 12;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const barW = plotW / top.length * 0.65;
  const gap = plotW / top.length * 0.35;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ minWidth: "500px" }}>
        {[0, 25, 50, 75, 100].map((v) => {
          const y = padT + plotH - (v / 100) * plotH;
          return (
            <g key={v}>
              <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={padL - 4} y={y + 3} textAnchor="end" className="fill-gray-400" style={{ fontSize: "8px" }}>{v}%</text>
            </g>
          );
        })}
        {top.map((t, i) => {
          const attempted = t.correct + t.incorrect;
          const pct = attempted > 0 ? t.accuracy : 0;
          const barH = (pct / 100) * plotH;
          const x = padL + i * (barW + gap) + gap / 2;
          const y = padT + plotH - barH;
          const color = pct >= 70 ? "#16a34a" : pct >= 50 ? "#f59e0b" : "#ef4444";
          const label = t.category.length > 12 ? t.category.slice(0, 10) + "…" : t.category;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} fill={color} rx="2" className="transition-all duration-700" />
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="fill-gray-700 font-bold" style={{ fontSize: "8px" }}>{pct.toFixed(0)}%</text>
              <text x={x + barW / 2} y={padT + plotH + 12} textAnchor="middle" className="fill-gray-500" style={{ fontSize: "7px" }} transform={`rotate(-25, ${x + barW / 2}, ${padT + plotH + 12})`}>{label}</text>
              <text x={x + barW / 2} y={padT + plotH + 28} textAnchor="middle" className="fill-gray-400" style={{ fontSize: "7px" }}>{t.correct}/{attempted}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DifficultyDonut({ stats }: { stats: DifficultyStat[] }) {
  const colors: Record<string, string> = {
    Easy: "#22c55e",
    Medium: "#f59e0b",
    Hard: "#ef4444",
    Unknown: "#94a3b8",
  };
  const total = stats.reduce((s, d) => s + d.total, 0);
  if (total === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No difficulty data available.</p>;
  }
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-32 h-32 flex-shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="14" />
          {stats.map((d, i) => {
            const pct = d.total / total;
            const dash = pct * circumference;
            const circle = (
              <circle
                key={i}
                cx="60" cy="60" r={radius} fill="none"
                stroke={colors[d.difficulty] || "#94a3b8"}
                strokeWidth="14"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return circle;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-gray-900">{total}</span>
          <span className="text-[10px] text-gray-400">Questions</span>
        </div>
      </div>
      <div className="space-y-2">
        {stats.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-full" style={{ background: colors[d.difficulty] || "#94a3b8" }} />
            <span className="font-medium text-gray-700">{d.difficulty}</span>
            <span className="text-gray-400">{d.total} q · {d.accuracy.toFixed(0)}% acc</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<string>("all");

  const getDateParams = useCallback((range: string) => {
    if (range === "all") return {};
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    if (range === "7d") {
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from: from.toISOString().slice(0, 10), to };
    }
    if (range === "30d") {
      const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { from: from.toISOString().slice(0, 10), to };
    }
    if (range === "90d") {
      const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return { from: from.toISOString().slice(0, 10), to };
    }
    if (range === "1y") {
      const from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      return { from: from.toISOString().slice(0, 10), to };
    }
    return {};
  }, []);

  const fetchAnalytics = useCallback(() => {
    setLoading(true);
    const params = getDateParams(dateRange);
    api
      .get("/student/analytics", { params })
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [dateRange, getDateParams]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="p-6 mx-auto max-w-6xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-40 bg-gray-200 rounded-2xl" />
          <div className="grid grid-cols-3 gap-6">
            <div className="h-56 bg-gray-200 rounded-2xl" />
            <div className="h-56 bg-gray-200 rounded-2xl" />
            <div className="h-56 bg-gray-200 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.aggregate.tests_completed === 0) {
    return (
      <div className="p-6 mx-auto max-w-6xl w-full">
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Analytics Available</h3>
          <p className="text-gray-500 text-sm mb-4">Complete at least one test to see your analytics.</p>
          <button onClick={() => router.push("/student/tests")} className="bg-slate-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-900 transition">
            View Available Tests
          </button>
        </div>
      </div>
    );
  }

  const agg = data.aggregate;
  const imp = data.improvement;
  const hasImprovement = imp && imp.first_score !== undefined;

  return (
    <div className="p-6 mx-auto max-w-6xl w-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Performance Analytics</h2>
          <p className="text-gray-500 mt-1">Cross-test insights and progression analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="all">All Time</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
          <button
            onClick={() => { fetchAnalytics(); toast.success("Analytics refreshed"); }}
            className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Overall Score</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{agg.overall_score}<span className="text-lg text-gray-300">/340</span></p>
          <p className="text-xs text-gray-400 mt-1">V: {agg.verbal_score} · Q: {agg.quant_score}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Overall Accuracy</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{agg.overall_accuracy.toFixed(1)}%</p>
          <p className="text-xs text-gray-400 mt-1">{agg.total_correct}/{agg.total_attempted} correct</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Tests Completed</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{agg.tests_completed}</p>
          <p className="text-xs text-gray-400 mt-1">{agg.total_questions} questions attempted</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Improvement</p>
          {hasImprovement ? (
            <>
              <p className={`text-3xl font-bold mt-2 ${imp.score_delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                {imp.score_delta >= 0 ? "+" : ""}{imp.score_delta}
              </p>
              <p className="text-xs text-gray-400 mt-1">{imp.tests_improved} of {agg.tests_completed} tests improved</p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-300 mt-2">—</p>
              <p className="text-xs text-gray-400 mt-1">Need 2+ tests</p>
            </>
          )}
        </div>
      </div>

      {/* Score Progression Chart */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Score Progression Across Tests</h3>
        <ScoreAreaChart progression={data.score_progression} />
      </div>

      {/* Improvement Detail + Subject Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Improvement */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Improvement Analysis</h3>
          {hasImprovement ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-xs text-gray-400">First Test</p>
                  <p className="text-xl font-bold text-gray-900">{imp.first_score}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-xs text-gray-400">Latest Test</p>
                  <p className="text-xl font-bold text-gray-900">{imp.latest_score}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Overall Score Change</span>
                  <span className={`text-sm font-bold ${imp.score_delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {imp.score_delta >= 0 ? "+" : ""}{imp.score_delta} pts
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Verbal Score Change</span>
                  <span className={`text-sm font-bold ${imp.verbal_delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {imp.verbal_delta >= 0 ? "+" : ""}{imp.verbal_delta} pts
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Quant Score Change</span>
                  <span className={`text-sm font-bold ${imp.quant_delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {imp.quant_delta >= 0 ? "+" : ""}{imp.quant_delta} pts
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Accuracy Change</span>
                  <span className={`text-sm font-bold ${imp.accuracy_delta >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {imp.accuracy_delta >= 0 ? "+" : ""}{imp.accuracy_delta.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Complete at least 2 tests to see improvement analysis.</p>
          )}
        </div>

        {/* Subject Comparison */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Subject Performance</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-gray-700">Verbal Reasoning</span>
                <span className="text-sm font-bold text-gray-900">{agg.verbal_score}/170</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-700 rounded-full" style={{ width: `${((agg.verbal_score - 130) / 40) * 100}%`, transition: "width 1s ease-out" }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{agg.verbal_correct}/{agg.verbal_total} correct · {agg.verbal_accuracy.toFixed(1)}% accuracy</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-gray-700">Quantitative Reasoning</span>
                <span className="text-sm font-bold text-gray-900">{agg.quant_score}/170</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-700 rounded-full" style={{ width: `${((agg.quant_score - 130) / 40) * 100}%`, transition: "width 1s ease-out" }} />
              </div>
              <p className="text-xs text-gray-400 mt-1">{agg.quant_correct}/{agg.quant_total} correct · {agg.quant_accuracy.toFixed(1)}% accuracy</p>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Stronger Subject</span>
                <span className="text-sm font-bold text-gray-900">
                  {agg.verbal_score > agg.quant_score ? "Verbal" : agg.quant_score > agg.verbal_score ? "Quant" : "Equal"}
                  {Math.abs(agg.verbal_score - agg.quant_score) > 0 && ` (+${Math.abs(agg.verbal_score - agg.quant_score)})`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Topic Performance + Difficulty Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Topic Performance */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Topic-wise Accuracy (All Tests)</h3>
          <AccuracyBarChart topics={data.topic_stats} />
        </div>

        {/* Difficulty Distribution */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Difficulty Distribution</h3>
          <DifficultyDonut stats={data.difficulty_stats} />
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-green-700 uppercase tracking-wide mb-4">Top Strengths</h3>
          {data.strengths.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">Not enough data yet. Topics with 70%+ accuracy will appear here.</p>
          ) : (
            <div className="space-y-3">
              {data.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{s.category} — {s.accuracy.toFixed(0)}%</p>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${s.accuracy}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.subject} · {s.correct}/{s.correct + s.incorrect} correct</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-red-700 uppercase tracking-wide mb-4">Focus Areas</h3>
          {data.weaknesses.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">Great! No weak topics detected. Topics below 50% accuracy will appear here.</p>
          ) : (
            <div className="space-y-3">
              {data.weaknesses.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{s.category} — {s.accuracy.toFixed(0)}%</p>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${s.accuracy}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.subject} · {s.correct}/{s.correct + s.incorrect} correct</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section Difficulty Progression */}
      {data.adaptive_history.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Section Difficulty Progression</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Test</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Section</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Subject</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Difficulty</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Module</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.adaptive_history.map((a, i) => {
                  const diffColor = a.difficulty === "Hard" ? "bg-red-100 text-red-700" : a.difficulty === "Medium" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700";
                  return (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="py-3 px-3 text-gray-700 truncate max-w-[180px]">{a.test_title}</td>
                      <td className="py-3 px-3 text-gray-600 text-xs">{a.section}</td>
                      <td className="py-3 px-3 text-gray-600">{a.subject}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${diffColor}`}>{a.difficulty}</span>
                      </td>
                      <td className="py-3 px-3 text-center text-gray-600 text-xs">{a.module || "-"}</td>
                      <td className="py-3 px-3 text-center text-gray-700 font-medium">{a.section_score}/{a.section_total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Test-by-test Score Table */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Test-by-Test Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">#</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Test</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Overall</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Verbal</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Quant</th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Accuracy</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Report</th>
              </tr>
            </thead>
            <tbody>
              {data.score_progression.map((p, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer" onClick={() => router.push(`/student/results/${p.allocation_id}`)}>
                  <td className="py-3 px-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="py-3 px-3 font-medium text-gray-800 truncate max-w-[200px]">{p.test_title}</td>
                  <td className="py-3 px-3 text-center text-gray-500 text-xs">{new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                  <td className="py-3 px-3 text-center font-bold text-gray-900">{p.overall_score}</td>
                  <td className="py-3 px-3 text-center text-gray-700">{p.verbal_score}</td>
                  <td className="py-3 px-3 text-center text-gray-700">{p.quant_score}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.overall_accuracy >= 70 ? "bg-gray-700 text-white" : p.overall_accuracy >= 50 ? "bg-gray-200 text-gray-700" : "bg-gray-100 text-gray-500"}`}>
                      {p.overall_accuracy.toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="text-xs text-slate-700 font-semibold">View →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
