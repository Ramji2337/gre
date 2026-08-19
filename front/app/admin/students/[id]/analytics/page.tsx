"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";

export default function StudentAnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading...</div>}>
      <StudentAnalytics />
    </Suspense>
  );
}

function StudentAnalytics() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string || "";

  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      router.back();
      return;
    }
    fetchAnalytics();
  }, [studentId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/students/${studentId}/analytics`);
      setAnalytics(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-gray-400">Loading analytics...</div>;
  if (!analytics) return <div className="p-8 text-gray-400">No data available</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Student Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">{analytics.student_name || analytics.name || ""} — {analytics.email || ""}</p>
        </div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-100"
        >
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Total Tests</div>
          <div className="text-3xl font-bold text-gray-900">{analytics.total_tests || 0}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Completed</div>
          <div className="text-3xl font-bold text-green-600">{analytics.completed_tests || 0}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Upcoming</div>
          <div className="text-3xl font-bold text-blue-600">{analytics.upcoming_tests || 0}</div>
        </div>
      </div>

      {analytics.estimated_score && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Estimated GRE Score</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 font-semibold mb-1">Verbal</div>
              <div className="text-2xl font-bold text-gray-900">{analytics.estimated_score.verbal || 130}</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500 font-semibold mb-1">Quant</div>
              <div className="text-2xl font-bold text-gray-900">{analytics.estimated_score.quant || 130}</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-xs text-blue-500 font-semibold mb-1">Overall</div>
              <div className="text-2xl font-bold text-blue-700">{analytics.estimated_score.overall || 260}</div>
            </div>
          </div>
        </div>
      )}

      {analytics.weak_topics && analytics.weak_topics.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Weak Topics (accuracy &lt; 50%)</h3>
          <div className="space-y-2">
            {analytics.weak_topics.map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">{t.topic || t.category}</span>
                <span className="text-sm font-semibold text-red-600">{t.accuracy}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {analytics.strong_topics && analytics.strong_topics.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Strong Topics (accuracy &ge; 75%)</h3>
          <div className="space-y-2">
            {analytics.strong_topics.map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">{t.topic || t.category}</span>
                <span className="text-sm font-semibold text-green-600">{t.accuracy}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {analytics.allocations && analytics.allocations.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Test History</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Test</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analytics.allocations.map((a: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-800">{a.test_title || a.test_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{a.test_type}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        a.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                        a.status === "SCHEDULED" ? "bg-blue-100 text-blue-700" :
                        a.status === "IN_PROGRESS" ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {a.scheduled_at ? (() => { const d = new Date(a.scheduled_at); const h = d.getHours(); const ampm = h >= 12 ? "PM" : "AM"; const hour12 = h % 12 === 0 ? 12 : h % 12; return `${d.toLocaleDateString("en-GB")}, ${hour12}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`; })() : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {a.score_percent !== undefined ? `${a.score_percent}%` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
