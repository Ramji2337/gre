"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";

interface AvailableTest {
  _id: string;
  test_id: string;
  test_type: string;
  test_title: string;
  status: string;
  scheduled_at: string;
  expires_at: string;
  end_time: string;
  duration_mins: number;
  can_start: boolean;
  button_state: string;
  button_label: string;
  created_at: string;
}

export default function AvailableTestsPage() {
  const router = useRouter();
  const [tests, setTests] = useState<AvailableTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "SCHEDULED" | "IN_PROGRESS" | "EXPIRED">("ALL");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(new Date());

  const fetchTests = useCallback(() => {
    setLoading(true);
    api
      .get("/student/available-tests")
      .then((res) => setTests(res.data.tests || []))
      .catch(() => toast.error("Failed to load tests"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTests();
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [fetchTests]);

  const formatDateTime12 = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getTimeUntil = (dateStr: string) => {
    const d = new Date(dateStr);
    const diff = d.getTime() - now.getTime();
    if (diff <= 0) return "Available now";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const getTestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      FULL_LENGTH: "FULL LENGTH",
      SECTIONAL: "SECTIONAL",
      TOPIC_WISE: "TOPIC WISE",
    };
    return labels[type] || type;
  };

  const getTestTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      FULL_LENGTH: "bg-indigo-100 text-indigo-700",
      SECTIONAL: "bg-blue-100 text-blue-700",
      TOPIC_WISE: "bg-green-100 text-green-700",
    };
    return colors[type] || "bg-gray-100 text-gray-700";
  };

  const isExpired = (test: AvailableTest) => {
    if (test.status === "EXPIRED") return true;
    const expiryStr = test.expires_at && test.expires_at !== "0001-01-01T00:00:00Z" ? test.expires_at : test.end_time;
    if (!expiryStr) return false;
    const expDate = new Date(expiryStr);
    if (isNaN(expDate.getTime()) || expDate.getFullYear() < 2000) return false;
    return now.getTime() > expDate.getTime();
  };

  const canStartNow = (test: AvailableTest) => {
    if (test.status === "IN_PROGRESS") return true;
    if (isExpired(test)) return false;
    if (test.status === "SCHEDULED" && now.getTime() >= new Date(test.scheduled_at).getTime()) {
      return true;
    }
    return false;
  };

  const filteredTests = tests.filter((t) => {
    const expired = isExpired(t);
    const effectiveStatus = expired || t.status === "EXPIRED" ? "EXPIRED" : t.status;
    if (filter !== "ALL" && effectiveStatus !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !t.test_title.toLowerCase().includes(q) &&
        !t.test_type.toLowerCase().includes(q) &&
        !formatDateTime12(t.scheduled_at).toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const handleAction = (test: AvailableTest) => {
    if (test.status === "IN_PROGRESS") {
      router.push(`/student/exam/${test._id}`);
    } else if (canStartNow(test)) {
      router.push(`/student/exam/${test._id}`);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 mx-auto max-w-6xl w-full">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Allocated GRE Tests & Practice Exams</h2>
        <p className="text-gray-500 mt-1">
          Your scheduled and in-progress tests
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Total Available</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{tests.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <p className="text-sm text-gray-500">Scheduled</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {tests.filter((t) => t.status === "SCHEDULED" && !isExpired(t)).length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
          <p className="text-sm text-gray-500">In Progress</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">
            {tests.filter((t) => t.status === "IN_PROGRESS").length}
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Status:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search date, title, type..."
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={() => {
              fetchTests();
              toast.success("Tests refreshed");
            }}
            className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Tests Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {filteredTests.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm font-medium text-gray-500">No tests available</p>
            <p className="text-xs mt-1">
              {tests.length === 0
                ? "Your admin has not allocated any tests yet"
                : "No tests match your filter"}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">S.No.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Test Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Scheduled Window</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTests.map((test, i) => {
                const expired = isExpired(test);
                const canStart = canStartNow(test);
                const isScheduled = test.status === "SCHEDULED" && !expired;
                const isInProgress = test.status === "IN_PROGRESS";

                return (
                  <tr
                    key={test._id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition"
                  >
                    <td className="px-4 py-4 text-sm text-gray-500">{i + 1}</td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-gray-800">{test.test_title}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getTestTypeColor(test.test_type)}`}>
                        {getTestTypeLabel(test.test_type)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <p>
                          <span className="text-gray-400">Start: </span>
                          {formatDateTime12(test.scheduled_at)}
                        </p>
                        <p>
                          <span className="text-gray-400">End: </span>
                          {formatDateTime12(test.end_time || test.expires_at)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {expired || test.status === "EXPIRED" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                          Expired
                        </span>
                      ) : isInProgress ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
                          In Progress
                        </span>
                      ) : canStart ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                          Ready to Start
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          Scheduled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {expired || test.status === "EXPIRED" ? (
                        <div className="flex flex-col gap-1">
                          <button
                            disabled
                            className="px-4 py-2 bg-red-50 text-red-400 border border-red-200 rounded-lg text-xs font-semibold cursor-not-allowed flex items-center gap-1.5"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Expired
                          </button>
                          <span className="text-[11px] text-red-500 font-medium">
                            Test window ended
                          </span>
                        </div>
                      ) : isInProgress ? (
                        <button
                          onClick={() => handleAction(test)}
                          className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-xs font-semibold hover:bg-yellow-600 transition flex items-center gap-1.5 shadow-sm"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Continue
                        </button>
                      ) : canStart ? (
                        <button
                          onClick={() => handleAction(test)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition flex items-center gap-1.5 shadow-sm"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Start Test
                        </button>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <button
                            disabled
                            className="px-4 py-2 bg-gray-100 text-gray-400 rounded-lg text-xs font-semibold cursor-not-allowed flex items-center gap-1.5"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-9V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Start Test
                          </button>
                          <span className="text-xs text-blue-600 font-medium">
                            ⏰ {getTimeUntil(test.scheduled_at)}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Info */}
      {filteredTests.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <p>
            Page 1 of 1 ({filteredTests.length} total{" "}
            {filteredTests.length === 1 ? "test" : "tests"})
          </p>
        </div>
      )}
    </div>
  );
}
