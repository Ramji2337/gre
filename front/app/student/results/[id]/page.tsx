"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";

interface ScoreData {
  verbal_score: number;
  quant_score: number;
  overall_score: number;
  verbal_accuracy: string;
  quant_accuracy: string;
  overall_accuracy: string;
  verbal_correct: number;
  verbal_total: number;
  quant_correct: number;
  quant_total: number;
}

interface Summary {
  total_questions: number;
  total_attempted: number;
  total_correct: number;
  total_incorrect: number;
  total_unanswered: number;
}

interface SectionResult {
  name: string;
  subject: string;
  difficulty: string;
  score: number;
  total_questions: number;
  attempted: number;
  unanswered: number;
}

interface CategoryResult {
  category: string;
  subject: string;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
}

interface ViolationEntry {
  violation_type: string;
  details: string;
  severity: string;
  timestamp: string;
}

interface ResultData {
  allocation_id: string;
  test_id: string;
  test_type: string;
  test_title: string;
  student_name: string;
  student_email: string;
  scheduled_at: string;
  completed_at: string;
  status: string;
  violation_count: number;
  malpractice_at: string | null;
  violations: ViolationEntry[];
  scores: ScoreData;
  summary: Summary;
  section_results: SectionResult[];
  category_results: CategoryResult[];
}

const GRE_SCALE_MIN = 260;
const GRE_SCALE_MAX = 340;

function performanceLabel(accuracy: number) {
  if (accuracy >= 85) return { label: "Excellent", color: "text-green-700 bg-green-100" };
  if (accuracy >= 70) return { label: "Strong", color: "text-blue-700 bg-blue-100" };
  if (accuracy >= 50) return { label: "Good", color: "text-yellow-700 bg-yellow-100" };
  return { label: "Needs Improvement", color: "text-red-700 bg-red-100" };
}

function topicLevel(accuracy: number) {
  if (accuracy >= 70) return { label: "Strong", color: "bg-green-500", text: "text-green-700", bg: "bg-green-50" };
  if (accuracy >= 40) return { label: "Medium", color: "bg-yellow-500", text: "text-yellow-700", bg: "bg-yellow-50" };
  return { label: "Weak", color: "bg-red-500", text: "text-red-700", bg: "bg-red-50" };
}

/* ---------- SVG Donut Chart ---------- */
function DonutChart({
  correct,
  incorrect,
  unanswered,
  total,
  label,
}: {
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  label: string;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const correctPct = total > 0 ? correct / total : 0;
  const incorrectPct = total > 0 ? incorrect / total : 0;
  const unansweredPct = total > 0 ? unanswered / total : 0;

  const correctDash = correctPct * circumference;
  const incorrectDash = incorrectPct * circumference;
  const unansweredDash = unansweredPct * circumference;

  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="14" />
          {correct > 0 && (
            <circle
              cx="60" cy="60" r={radius} fill="none" stroke="#22c55e" strokeWidth="14"
              strokeDasharray={`${correctDash} ${circumference - correctDash}`}
              strokeDashoffset={0}
            />
          )}
          {incorrect > 0 && (
            <circle
              cx="60" cy="60" r={radius} fill="none" stroke="#ef4444" strokeWidth="14"
              strokeDasharray={`${incorrectDash} ${circumference - incorrectDash}`}
              strokeDashoffset={-correctDash}
            />
          )}
          {unanswered > 0 && (
            <circle
              cx="60" cy="60" r={radius} fill="none" stroke="#d1d5db" strokeWidth="14"
              strokeDasharray={`${unansweredDash} ${circumference - unansweredDash}`}
              strokeDashoffset={-(correctDash + incorrectDash)}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900">{accuracy}%</span>
          <span className="text-[10px] text-gray-400 uppercase tracking-wide">Accuracy</span>
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-700 mt-2 text-center">{label}</p>
      <div className="flex gap-3 mt-1.5 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>{correct} Correct
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>{incorrect} Wrong
        </span>
        {unanswered > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-300"></span>{unanswered} Skip
          </span>
        )}
      </div>
    </div>
  );
}

export default function ResultReportPage() {
  const params = useParams();
  const router = useRouter();
  const allocationId = params.id as string;

  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchResult = () => {
    setLoading(true);
    setError("");
    api
      .get(`/student/tests/${allocationId}/result`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || "Failed to load report"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocationId]);

  const sortedCategories = useMemo(() => {
    if (!data) return [];
    const withAccuracy = data.category_results.map((c) => {
      const attempted = c.correct + c.incorrect;
      const accuracy = attempted > 0 ? (c.correct / attempted) * 100 : 0;
      return { ...c, accuracy };
    });
    return [...withAccuracy].sort((a, b) => b.accuracy - a.accuracy);
  }, [data]);

  const strengths = useMemo(
    () => [...sortedCategories].filter((c) => c.correct + c.incorrect >= 1).sort((a, b) => b.accuracy - a.accuracy).slice(0, 5),
    [sortedCategories]
  );
  const weaknesses = useMemo(
    () => [...sortedCategories].filter((c) => c.correct + c.incorrect >= 1).sort((a, b) => a.accuracy - b.accuracy).slice(0, 5),
    [sortedCategories]
  );

  // Aggregate section data by subject for donut charts
  const subjectAgg = useMemo(() => {
    if (!data) return {};
    const map: Record<string, { correct: number; incorrect: number; unanswered: number; total: number }> = {};
    for (const s of data.section_results) {
      const key = s.subject || "General";
      if (!map[key]) map[key] = { correct: 0, incorrect: 0, unanswered: 0, total: 0 };
      map[key].correct += s.score;
      map[key].total += s.total_questions;
      map[key].unanswered += s.unanswered;
      map[key].incorrect += s.attempted - s.score;
    }
    return map;
  }, [data]);

  const handleDownloadPdf = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
          <div className="h-24 bg-white rounded-2xl border border-gray-200"></div>
          <div className="h-56 bg-white rounded-2xl border border-gray-200"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-white rounded-2xl border border-gray-200"></div>
            ))}
          </div>
          <div className="h-64 bg-white rounded-2xl border border-gray-200"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="text-red-600 text-lg mb-4">{error || "Could not load report"}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={fetchResult} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700">
              Retry
            </button>
            <button onClick={() => router.push("/student/dashboard")} className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200">
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Terminated / Malpractice view — no score report shown
  if (data.status === "MALPRACTICE" || data.status === "TERMINATED") {
    const violationTypeLabels: Record<string, string> = {
      TAB_SWITCH: "Tab Switch",
      FULLSCREEN_EXIT: "Exited Fullscreen Mode",
      COPY_PASTE: "Copy/Paste Detected",
      WINDOW_BLUR: "Window Lost Focus",
      RIGHT_CLICK: "Right-Click Detected",
      DEVTOOLS_OPEN: "Developer Tools Opened",
    };
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="no-print sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
          <button onClick={() => router.push("/student/dashboard")} className="text-sm text-gray-600 hover:text-gray-900 font-medium">
            ← Back to Dashboard
          </button>
        </div>
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-white rounded-2xl border border-red-200 p-8 shadow-sm text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Test Terminated</h1>
            <p className="text-sm text-gray-600 mb-1">Your test <strong>{data.test_title}</strong> was terminated due to a violation of exam rules.</p>
            <p className="text-xs text-gray-400 mb-6">
              {data.malpractice_at
                ? `Terminated on ${new Date(data.malpractice_at).toLocaleString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}`
                : `Terminated on ${new Date(data.completed_at).toLocaleString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}`
              }
            </p>
          </div>

          {data.violations && data.violations.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mt-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Recorded Violations</h2>
              <div className="space-y-3">
                {data.violations.map((v, i) => (
                  <div key={i} className="flex items-start gap-3 border border-gray-100 rounded-xl p-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                      v.severity === "high" ? "bg-red-100 text-red-700" : v.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                    }`}>{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{violationTypeLabels[v.violation_type] || v.violation_type}</p>
                      {v.details && <p className="text-xs text-gray-500 mt-0.5">{v.details}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(v.timestamp).toLocaleString("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-center mt-6">
            <button onClick={() => router.push("/student/dashboard")} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
              Back to Dashboard
            </button>
            <button onClick={() => router.push("/student/history")} className="px-5 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-black">
              View Test History
            </button>
          </div>
        </div>
      </div>
    );
  }

  const overall = performanceLabel(parseFloat(data.scores.overall_accuracy));
  const scalePercent = Math.max(
    0,
    Math.min(100, ((data.scores.overall_score - GRE_SCALE_MIN) / (GRE_SCALE_MAX - GRE_SCALE_MIN)) * 100)
  );

  const subjectOrder = ["Verbal", "Quant", "AWA"];
  const subjectLabels: Record<string, string> = { Verbal: "Verbal Reasoning", Quant: "Quantitative Reasoning", AWA: "Analytical Writing" };

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      {/* Sticky action bar */}
      <div className="no-print sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <button onClick={() => router.push("/student/dashboard")} className="text-sm text-gray-600 hover:text-gray-900 font-medium">
          ← Back to Dashboard
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/student/history")}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
          >
            View History
          </button>
          <button
            onClick={handleDownloadPdf}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Download PDF Report
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* 1. Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{data.test_title}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {data.test_type.replace("_", " ")} · Completed{" "}
                {new Date(data.completed_at).toLocaleString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">Student: {data.student_name || data.student_email}</p>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${overall.color}`}>{overall.label}</span>
          </div>
        </div>

        {/* 2. GRE Total Score + Verbal/Quant */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">GRE Score</h2>
          <div className="flex flex-wrap items-center gap-8 mb-6">
            <div>
              <p className="text-5xl font-bold text-gray-900">
                {data.scores.overall_score}
                <span className="text-xl text-gray-400"> / 340</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">260–340 GRE Scale</p>
            </div>
            <div className="flex-1 min-w-[220px]">
              <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full" style={{ width: `${scalePercent}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{GRE_SCALE_MIN}</span>
                <span>{GRE_SCALE_MAX}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Verbal Reasoning</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {data.scores.verbal_score} <span className="text-sm text-gray-400">/ 170</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data.scores.verbal_correct}/{data.scores.verbal_total} correct · {data.scores.verbal_accuracy}%
              </p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Quantitative Reasoning</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {data.scores.quant_score} <span className="text-sm text-gray-400">/ 170</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data.scores.quant_correct}/{data.scores.quant_total} correct · {data.scores.quant_accuracy}%
              </p>
            </div>
          </div>
        </div>

        {/* 3. KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Verbal Reasoning"
            main={`${data.scores.verbal_score}/170`}
            sub={`${data.scores.verbal_correct}/${data.scores.verbal_total} correct`}
            accent="blue"
            badge={performanceLabel(parseFloat(data.scores.verbal_accuracy)).label}
          />
          <KpiCard
            title="Quantitative Reasoning"
            main={`${data.scores.quant_score}/170`}
            sub={`${data.scores.quant_correct}/${data.scores.quant_total} correct`}
            accent="green"
            badge={performanceLabel(parseFloat(data.scores.quant_accuracy)).label}
          />
          <KpiCard
            title="Questions Solved"
            main={`${data.summary.total_attempted}/${data.summary.total_questions}`}
            sub={`${data.summary.total_correct} correct · ${data.summary.total_incorrect} wrong · ${data.summary.total_unanswered} skipped`}
            accent="purple"
          />
          <KpiCard
            title="Overall Accuracy"
            main={`${data.scores.overall_accuracy}%`}
            sub={`${data.summary.total_correct} correct of ${data.summary.total_attempted} attempted`}
            accent="orange"
            badge={overall.label}
          />
        </div>

        {/* 4. Section-wise Donut Charts */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-6">Section-wise Performance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {subjectOrder.map((subj) => {
              const agg = subjectAgg[subj];
              if (!agg || agg.total === 0) return null;
              return (
                <DonutChart
                  key={subj}
                  correct={agg.correct}
                  incorrect={agg.incorrect}
                  unanswered={agg.unanswered}
                  total={agg.total}
                  label={subjectLabels[subj] || subj}
                />
              );
            })}
          </div>
          {/* Overall donut */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <DonutChart
                correct={data.summary.total_correct}
                incorrect={data.summary.total_incorrect}
                unanswered={data.summary.total_unanswered}
                total={data.summary.total_questions}
                label="Overall Test"
              />
            </div>
          </div>
        </div>

        {/* 5. Section Breakdown Bars */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Section Breakdown</h2>
          <div className="space-y-4">
            {data.section_results.map((s, i) => {
              const accuracy = s.attempted > 0 ? (s.score / s.attempted) * 100 : 0;
              const level = topicLevel(accuracy);
              return (
                <div key={i} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                      <p className="text-xs text-gray-400">
                        {s.subject} {s.difficulty && `· ${s.difficulty}`}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${level.text} ${level.bg}`}>{level.label}</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div className={`h-full ${level.color} rounded-full transition-all duration-700`} style={{ width: `${accuracy}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                    <span>{s.total_questions} questions</span>
                    <span>{s.attempted} attempted</span>
                    <span className="text-green-600 font-medium">{s.score} correct</span>
                    <span className="text-red-500 font-medium">{s.attempted - s.score} wrong</span>
                    <span className="text-gray-400">{s.unanswered} skipped</span>
                    <span className="font-semibold">{accuracy.toFixed(0)}% accuracy</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 6. Topic Performance — Strong / Medium / Weak */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Topic-wise Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Summary chips */}
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-700">
                {sortedCategories.filter((c) => c.accuracy >= 70 && c.correct + c.incorrect >= 1).length}
              </p>
              <p className="text-xs text-green-600 font-medium uppercase tracking-wide mt-1">Strong Topics</p>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-yellow-700">
                {sortedCategories.filter((c) => c.accuracy >= 40 && c.accuracy < 70 && c.correct + c.incorrect >= 1).length}
              </p>
              <p className="text-xs text-yellow-600 font-medium uppercase tracking-wide mt-1">Medium Topics</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-700">
                {sortedCategories.filter((c) => c.accuracy < 40 && c.correct + c.incorrect >= 1).length}
              </p>
              <p className="text-xs text-red-600 font-medium uppercase tracking-wide mt-1">Weak Topics</p>
            </div>
          </div>
          <div className="space-y-3">
            {sortedCategories.map((c, i) => {
              const level = topicLevel(c.accuracy);
              return (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-44 flex-shrink-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.category}</p>
                    <p className="text-xs text-gray-400">{c.subject}</p>
                  </div>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${level.color} rounded-full transition-all duration-700`} style={{ width: `${c.accuracy}%` }} />
                  </div>
                  <div className="w-32 flex-shrink-0 text-right">
                    <span className={`text-xs font-semibold ${level.text}`}>
                      {level.label}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">
                      {c.correct}/{c.total} · {c.accuracy.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 7. Strengths & Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-green-700 uppercase tracking-wide mb-4">Top Strengths</h2>
            <div className="space-y-3">
              {strengths.length === 0 && <p className="text-sm text-gray-400">Not enough data yet.</p>}
              {strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">
                      {s.category} — {s.accuracy.toFixed(0)}%
                    </p>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${s.accuracy}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-4">Top Weaknesses</h2>
            <div className="space-y-3">
              {weaknesses.length === 0 && <p className="text-sm text-gray-400">Not enough data yet.</p>}
              {weaknesses.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">
                      {s.category} — {s.accuracy.toFixed(0)}%
                    </p>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${s.accuracy}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 8. Score Interpretation */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">What Your Score Means</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            <strong>
              {data.scores.overall_score} / {GRE_SCALE_MAX}
            </strong>{" "}
            — Your {data.scores.quant_score >= data.scores.verbal_score ? "Quantitative" : "Verbal"} score is
            {" "}
            {Math.abs(data.scores.quant_score - data.scores.verbal_score)} point(s){" "}
            {data.scores.quant_score >= data.scores.verbal_score ? "higher" : "lower"} than your{" "}
            {data.scores.quant_score >= data.scores.verbal_score ? "Verbal" : "Quantitative"} score.
            {weaknesses.length > 0 && (
              <> Improving {weaknesses.slice(0, 3).map((w) => w.category).join(", ")} could raise your overall performance.</>
            )}
          </p>
          <p className="text-xs text-gray-400 mt-3">Estimated percentile is not available for this practice test.</p>
        </div>

        {/* 9. Improvement Plan */}
        {weaknesses.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Recommended Next Steps</h2>
            <div className="space-y-4">
              {weaknesses.slice(0, 3).map((w, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-800">
                    Priority {i + 1}: Practice {w.category}
                  </p>
                  <ul className="text-xs text-gray-500 mt-1.5 list-disc list-inside space-y-0.5">
                    <li>Review all incorrect and unanswered questions in this category</li>
                    <li>Attempt additional {w.category} practice questions</li>
                    <li>Focus on concept review before your next attempt</li>
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex flex-wrap gap-3 justify-center no-print pb-6">
          <button onClick={() => router.push("/student/dashboard")} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
            Back to Dashboard
          </button>
          <button onClick={() => router.push("/student/history")} className="px-5 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-black">
            View Test History
          </button>
          <button onClick={handleDownloadPdf} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Download PDF Report
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 pb-8">
          This is a practice performance report and is not an official ETS GRE score report.
        </p>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  main,
  sub,
  accent,
  badge,
}: {
  title: string;
  main: string;
  sub: string;
  accent: "blue" | "green" | "purple" | "orange";
  badge?: string;
}) {
  const accentMap: Record<string, string> = {
    blue: "text-blue-600 bg-blue-50",
    green: "text-green-600 bg-green-50",
    purple: "text-purple-600 bg-purple-50",
    orange: "text-orange-600 bg-orange-50",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</p>
        {badge && <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${accentMap[accent]}`}>{badge}</span>}
      </div>
      <p className="text-2xl font-bold text-gray-900">{main}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}
