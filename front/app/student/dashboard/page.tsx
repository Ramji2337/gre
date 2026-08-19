"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";

interface SubjectBreakdown {
  verbal_score: number;
  quant_score: number;
  overall_score: number;
  verbal_correct: number;
  verbal_total: number;
  quant_correct: number;
  quant_total: number;
  awa_count: number;
  accuracy: string;
}

interface CompletedTest {
  _id: string;
  test_title: string;
  test_type: string;
  status: string;
  created_at: string;
  total_correct: number;
  total_questions: number;
  subject_breakdown: SubjectBreakdown;
}

interface DashboardData {
  next_test: any | null;
  score_prediction: {
    verbal_score: number;
    quant_score: number;
    overall_score: number;
    verbal_accuracy: string;
    quant_accuracy: string;
    overall_accuracy: string;
  };
  subject_stats: {
    verbal_answered: number;
    quant_answered: number;
    awa_answered: number;
  };
  practice_stats: {
    tests_taken: number;
    total_correct: number;
    total_questions: number;
    overall_accuracy: string;
    best_score: number;
    avg_score: number;
  };
  score_trend: { test_title: string; score: number; verbal_score: number; quant_score: number; created_at: string }[];
  completed_tests: CompletedTest[];
  upcoming_count: number;
  completed_count: number;
  expired_count: number;
  in_progress_count: number;
  upcoming_tests: any[];
  recent_attempts: any[];
}

function ScoreGauge({ score, max, min, label, color, sublabel }: { score: number; max: number; min: number; label: string; color: string; sublabel: string }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const pct = score > min ? Math.min(100, ((score - min) / (max - min)) * 100) : 0;
  const offset = circ - (pct / 100) * circ;
  const isUnknown = score <= min;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="7" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 1.2s ease-out" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-gray-800">{isUnknown ? "-" : score}</span>
          <span className="text-[9px] text-gray-400">/ {max}</span>
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-700 mt-2">{label}</p>
      <p className="text-[11px] text-gray-400">{sublabel}</p>
    </div>
  );
}

function TrendChart({ trend }: { trend: { test_title: string; score: number }[] }) {
  if (trend.length < 2) {
    return <p className="text-sm text-gray-400 text-center py-8">Take at least 2 tests to see your score trend.</p>;
  }
  const w = 320;
  const h = 120;
  const pad = 30;
  const scores = trend.map((t) => t.score);
  const minS = Math.min(...scores) - 10;
  const maxS = Math.max(...scores) + 10;
  const range = maxS - minS || 1;
  const stepX = (w - pad * 2) / (trend.length - 1);

  const points = trend.map((t, i) => ({
    x: pad + i * stepX,
    y: h - pad - ((t.score - minS) / range) * (h - pad * 2),
    score: t.score,
    label: t.test_title.substring(0, 12),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x} ${h - pad} L ${points[0].x} ${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-md mx-auto">
      <defs>
        <linearGradient id="trendGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(59,130,246,0.2)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0)" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((r) => (
        <line key={r} x1={pad} y1={pad + r * (h - pad * 2)} x2={w - pad} y2={pad + r * (h - pad * 2)} stroke="#f1f5f9" strokeWidth="1" />
      ))}
      <path d={areaD} fill="url(#trendGrad)" />
      <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#3b82f6" />
          <text x={p.x} y={p.y - 10} textAnchor="middle" className="fill-gray-700 font-bold" style={{ fontSize: "10px" }}>{p.score}</text>
          <text x={p.x} y={h - 8} textAnchor="middle" className="fill-gray-400" style={{ fontSize: "8px" }}>{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

export default function StudentDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedTestFilter, setSelectedTestFilter] = useState<string>("all");

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    api
      .get("/student/dashboard")
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) setUser(JSON.parse(u));
    fetchDashboard();
  }, [fetchDashboard]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Not scheduled";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  };

  const getTimeUntil = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    if (diff <= 0) return "Expired";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${mins}m remaining`;
    return `${mins}m remaining`;
  };

  // Compute filtered scores based on selected test
  const filteredScores = useMemo(() => {
    if (!data) return { verbal: 0, quant: 0, overall: 0, verbalAcc: "0", quantAcc: "0", awaCount: 0 };
    if (selectedTestFilter === "all") {
      return {
        verbal: data.score_prediction.verbal_score,
        quant: data.score_prediction.quant_score,
        overall: data.score_prediction.overall_score,
        verbalAcc: data.score_prediction.verbal_accuracy,
        quantAcc: data.score_prediction.quant_accuracy,
        awaCount: data.subject_stats.awa_answered,
      };
    }
    const test = data.completed_tests.find((t) => t._id === selectedTestFilter);
    if (!test) return { verbal: 0, quant: 0, overall: 0, verbalAcc: "0", quantAcc: "0", awaCount: 0 };
    const sb = test.subject_breakdown;
    const vAcc = sb.verbal_total > 0 ? ((sb.verbal_correct / sb.verbal_total) * 100).toFixed(1) : "0";
    const qAcc = sb.quant_total > 0 ? ((sb.quant_correct / sb.quant_total) * 100).toFixed(1) : "0";
    return { verbal: sb.verbal_score, quant: sb.quant_score, overall: sb.overall_score, verbalAcc: vAcc, quantAcc: qAcc, awaCount: sb.awa_count };
  }, [data, selectedTestFilter]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
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

  const nextTest = data?.next_test;
  const practice = data?.practice_stats;
  const upcoming = data?.upcoming_tests || [];
  const completedTests = data?.completed_tests || [];
  const scoreTrend = data?.score_trend || [];

  const trendUp = scoreTrend.length >= 2 && scoreTrend[scoreTrend.length - 1].score > scoreTrend[0].score;

  const recentTests = completedTests.slice(0, 10);

  return (
    <div className="p-6 mx-auto max-w-6xl w-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Welcome back, {user?.name || "Student"}!</h2>
          <p className="text-gray-500 mt-1">Ready for your next GRE practice session?</p>
        </div>
        <button
          onClick={() => { fetchDashboard(); toast.success("Dashboard refreshed"); }}
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

      {/* Next Test Banner */}
      {nextTest ? (
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-slate-800 text-white px-3 py-1 rounded-full text-xs font-medium">
                  {nextTest.status === "IN_PROGRESS" ? "Resume Test" : "Next Upcoming Test"}
                </span>
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">{nextTest.test_title}</h3>
              <div className="space-y-1 text-sm text-gray-500">
                <p><span className="text-gray-400">Scheduled:</span> {formatDate(nextTest.scheduled_at)}</p>
                {nextTest.status === "SCHEDULED" && <p className="font-medium text-amber-600">{getTimeUntil(nextTest.scheduled_at)}</p>}
                {nextTest.status === "IN_PROGRESS" && <p className="font-medium text-amber-600">Expires {getTimeUntil(nextTest.expires_at)}</p>}
              </div>
            </div>
            {(() => {
              const isStartable = nextTest.status === "IN_PROGRESS" || (nextTest.status === "SCHEDULED" && new Date().getTime() >= new Date(nextTest.scheduled_at).getTime());
              return (
                <button
                  disabled={!isStartable}
                  onClick={() => isStartable && router.push(`/student/exam/${nextTest._id}`)}
                  className={`px-6 py-3 rounded-xl font-bold text-sm transition whitespace-nowrap ${
                    isStartable
                      ? "bg-slate-800 text-white hover:bg-slate-900 cursor-pointer"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {nextTest.status === "IN_PROGRESS" ? "Resume Test" : isStartable ? "Start Test" : "Available Soon"}
                </button>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-6 text-center border border-gray-200 shadow-sm mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No tests scheduled</h3>
          <p className="text-gray-500 text-sm mb-4">Check back later for tests allocated by your admin</p>
          <button onClick={() => router.push("/student/tests")} className="bg-slate-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-900 transition">
            View Available Tests
          </button>
        </div>
      )}

      {/* Hero Score Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-1">Overall Estimated GRE Score</p>
            <p className="text-5xl font-extrabold tracking-tight text-gray-900">{filteredScores.overall}<span className="text-2xl text-gray-300"> / 340</span></p>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-gray-500 text-sm">Based on {selectedTestFilter === "all" ? `${practice?.tests_taken || 0} completed tests` : "selected test"}</p>
              {trendUp && (
                <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                  Trending up
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center min-w-[80px] border border-gray-100">
              <p className="text-2xl font-bold text-gray-900">{practice?.best_score || 0}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Best Score</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center min-w-[80px] border border-gray-100">
              <p className="text-2xl font-bold text-gray-900">{practice?.avg_score || 0}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Average</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center min-w-[80px] border border-gray-100">
              <p className="text-2xl font-bold text-gray-900">{practice?.tests_taken || 0}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Tests Taken</p>
            </div>
          </div>
        </div>
      </div>

      {/* Test Filter Pills */}
      {completedTests.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSelectedTestFilter("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedTestFilter === "all" ? "bg-slate-800 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
          >
            All Tests
          </button>
          {completedTests.map((t) => (
            <button
              key={t._id}
              onClick={() => setSelectedTestFilter(t._id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition truncate max-w-[200px] ${selectedTestFilter === t._id ? "bg-slate-800 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
            >
              {t.test_title}
            </button>
          ))}
        </div>
      )}

      {/* Subject Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Verbal */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Verbal Reasoning</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{filteredScores.verbalAcc}%</span>
          </div>
          <div className="flex items-center gap-4">
            <ScoreGauge score={filteredScores.verbal} max={170} min={130} label="" color="#475569" sublabel="" />
            <div className="flex-1">
              <p className="text-3xl font-extrabold text-gray-900">{filteredScores.verbal > 130 ? filteredScores.verbal : "-"}</p>
              <p className="text-xs text-gray-400">/ 170 GRE Scale</p>
              <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-700 rounded-full" style={{ width: `${filteredScores.verbal > 130 ? ((filteredScores.verbal - 130) / 40) * 100 : 0}%`, transition: "width 1s ease-out" }} />
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">Accuracy: {filteredScores.verbalAcc}%</p>
            </div>
          </div>
        </div>

        {/* Quant */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Quantitative</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{filteredScores.quantAcc}%</span>
          </div>
          <div className="flex items-center gap-4">
            <ScoreGauge score={filteredScores.quant} max={170} min={130} label="" color="#475569" sublabel="" />
            <div className="flex-1">
              <p className="text-3xl font-extrabold text-gray-900">{filteredScores.quant > 130 ? filteredScores.quant : "-"}</p>
              <p className="text-xs text-gray-400">/ 170 GRE Scale</p>
              <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-700 rounded-full" style={{ width: `${filteredScores.quant > 130 ? ((filteredScores.quant - 130) / 40) * 100 : 0}%`, transition: "width 1s ease-out" }} />
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">Accuracy: {filteredScores.quantAcc}%</p>
            </div>
          </div>
        </div>

        {/* AWA */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Analytical Writing</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Essay</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="7" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#475569" strokeWidth="7" strokeLinecap="round" strokeDasharray={2 * Math.PI * 42} strokeDashoffset={2 * Math.PI * 42 - (filteredScores.awaCount > 0 ? 0.3 : 0) * 2 * Math.PI * 42} style={{ transition: "stroke-dashoffset 1.2s ease-out" }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-gray-900">{filteredScores.awaCount > 0 ? "Done" : "-"}</span>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-3xl font-extrabold text-gray-900">{filteredScores.awaCount > 0 ? "Essay" : "-"}</p>
              <p className="text-xs text-gray-400">Scored 0–6 (ESS)</p>
              <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-700 rounded-full" style={{ width: filteredScores.awaCount > 0 ? "100%" : "0%", transition: "width 1s ease-out" }} />
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">{filteredScores.awaCount} essay{filteredScores.awaCount !== 1 ? "s" : ""} submitted</p>
            </div>
          </div>
        </div>
      </div>

      {/* Score Trend + Test Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Trend Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Score Trend</h3>
          <TrendChart trend={scoreTrend} />
        </div>

        {/* Test Overview */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Test Overview</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <p className="text-2xl font-bold text-gray-900">{data?.upcoming_count || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Upcoming</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <p className="text-2xl font-bold text-gray-900">{data?.in_progress_count || 0}</p>
              <p className="text-xs text-gray-500 mt-1">In Progress</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <p className="text-2xl font-bold text-gray-900">{data?.completed_count || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Completed</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <p className="text-2xl font-bold text-gray-900">{data?.expired_count || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Expired</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Tests Table — Top 10 */}
      {completedTests.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Recent Completed Tests</h3>
            {completedTests.length > 10 && (
              <button
                onClick={() => router.push("/student/history")}
                className="text-sm font-medium text-slate-700 hover:text-slate-900 flex items-center gap-1"
              >
                View Full Test History
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Test</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Score</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Verbal</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Quant</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Accuracy</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Report</th>
                </tr>
              </thead>
              <tbody>
                {recentTests.map((test) => {
                  const sb = test.subject_breakdown;
                  return (
                    <tr key={test._id} className="border-b border-gray-50 hover:bg-gray-50 transition cursor-pointer" onClick={() => router.push(`/student/results/${test._id}`)}>
                      <td className="py-3 px-3">
                        <p className="font-medium text-gray-800 truncate max-w-[200px]">{test.test_title}</p>
                      </td>
                      <td className="py-3 px-3 text-center text-gray-500 text-xs">{new Date(test.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-bold text-gray-900">{sb.overall_score}</span>
                        <span className="text-gray-400 text-xs">/340</span>
                      </td>
                      <td className="py-3 px-3 text-center text-gray-700 font-medium">{sb.verbal_score}</td>
                      <td className="py-3 px-3 text-center text-gray-700 font-medium">{sb.quant_score}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${parseFloat(sb.accuracy) >= 70 ? "bg-gray-700 text-white" : parseFloat(sb.accuracy) >= 50 ? "bg-gray-200 text-gray-700" : "bg-gray-100 text-gray-500"}`}>
                          {sb.accuracy}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-xs text-slate-700 font-semibold">View Report →</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upcoming Tests */}
      {upcoming.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm mb-6">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Upcoming Tests</h3>
          <div className="space-y-3">
            {upcoming.map((test, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                onClick={() => router.push(`/student/exam/${test._id}`)}
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{test.test_title}</p>
                  <p className="text-xs text-gray-500">{formatDate(test.scheduled_at)}</p>
                </div>
                <span className="text-xs text-slate-700 font-medium">{getTimeUntil(test.scheduled_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
