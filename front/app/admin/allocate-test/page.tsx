"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";

export default function AllocateTestPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading...</div>}>
      <AllocateTestContent />
    </Suspense>
  );
}

function AllocateTestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [students, setStudents] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 50;

  const todayStr = new Date().toISOString().split("T")[0];

  // Form state
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [testType, setTestType] = useState("FULL_LENGTH");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTimeHour, setScheduledTimeHour] = useState("");
  const [scheduledTimeMinute, setScheduledTimeMinute] = useState("00");
  const [scheduledTimeAmPm, setScheduledTimeAmPm] = useState("AM");

  // Filters
  const [fSearch, setFSearch] = useState(searchParams.get("search") || "");
  const [fStatus, setFStatus] = useState(searchParams.get("status") || "");
  const [fTestType, setFTestType] = useState(searchParams.get("test_type") || "");
  const [fDateFrom, setFDateFrom] = useState(searchParams.get("date_from") || "");
  const [fDateTo, setFDateTo] = useState(searchParams.get("date_to") || "");
  const [fTimeFrom, setFTimeFrom] = useState("");
  const [fTimeTo, setFTimeTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  // Modal
  const [viewAlloc, setViewAlloc] = useState<any>(null);
  const [viewQuestions, setViewQuestions] = useState<any[]>([]);
  const [viewSections, setViewSections] = useState<any[]>([]);
  const [showQuestions, setShowQuestions] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [rescheduleAlloc, setRescheduleAlloc] = useState<any>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTimeHour, setRescheduleTimeHour] = useState("");
  const [rescheduleTimeMinute, setRescheduleTimeMinute] = useState("00");
  const [rescheduleTimeAmPm, setRescheduleTimeAmPm] = useState("AM");
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [violationsData, setViolationsData] = useState<any>(null);
  const [loadingViolations, setLoadingViolations] = useState(false);
  const [reallocateAlloc, setReallocateAlloc] = useState<any>(null);
  const [reallocateDate, setReallocateDate] = useState("");
  const [reallocateTimeHour, setReallocateTimeHour] = useState("");
  const [reallocateTimeMinute, setReallocateTimeMinute] = useState("00");
  const [reallocateTimeAmPm, setReallocateTimeAmPm] = useState("AM");

  const fetchStudents = useCallback(() => {
    if (!studentSearch.trim()) {
      setStudents([]);
      setHasSearched(false);
      return;
    }
    setHasSearched(true);
    api.get("/admin/students", { params: { page: 1, search: studentSearch } })
      .then((res) => setStudents(res.data.students || []))
      .catch(() => setStudents([]));
  }, [studentSearch]);

  const fetchAllocations = useCallback((page: number) => {
    const params: any = { page: String(page) };
    if (fSearch) params.search = fSearch;
    if (fStatus) params.status = fStatus;
    if (fTestType) params.test_type = fTestType;
    if (fDateFrom) params.date_from = fDateFrom;
    if (fDateTo) params.date_to = fDateTo;
    if (fTimeFrom) params.time_from = fTimeFrom;
    if (fTimeTo) params.time_to = fTimeTo;

    api.get("/admin/tests/allocations", { params })
      .then((res) => {
        setAllocations(res.data.allocations || []);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
        setStatusCounts(res.data.statusCounts || {});
      })
      .finally(() => setLoading(false));
  }, [fSearch, fStatus, fTestType, fDateFrom, fDateTo, fTimeFrom, fTimeTo]);

  // Fetch allocations on mount and when filters change
  useEffect(() => { fetchAllocations(currentPage); }, [currentPage, fetchAllocations]);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const applyFilters = () => {
    setLoading(true);
    setCurrentPage(1);
    fetchAllocations(1);
  };

  const filterByStatus = (statusValue: string) => {
    setFStatus(statusValue);
    setLoading(true);
    setCurrentPage(1);
    const params: any = { page: "1" };
    if (fSearch) params.search = fSearch;
    if (statusValue) params.status = statusValue;
    if (fTestType) params.test_type = fTestType;
    if (fDateFrom) params.date_from = fDateFrom;
    if (fDateTo) params.date_to = fDateTo;
    api.get("/admin/tests/allocations", { params })
      .then((res) => {
        setAllocations(res.data.allocations || []);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
        setStatusCounts(res.data.statusCounts || {});
      })
      .finally(() => setLoading(false));
  };

  const clearFilters = () => {
    setFSearch(""); setFStatus(""); setFTestType(""); setFDateFrom(""); setFDateTo("");
    setFTimeFrom(""); setFTimeTo("");
    setCurrentPage(1);
    setLoading(true);
    api.get("/admin/tests/allocations", { params: { page: "1" } })
      .then((res) => {
        setAllocations(res.data.allocations || []);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
        setStatusCounts(res.data.statusCounts || {});
      })
      .finally(() => setLoading(false));
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const selectAllStudents = () => {
    setSelectedStudentIds(students.map((s) => s._id));
  };

  const deselectAllStudents = () => {
    setSelectedStudentIds([]);
  };

  const convertTo24Hour = (hour: string, minute: string, ampm: string) => {
    let h = parseInt(hour, 10);
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${minute}`;
  };

  const convertTo12Hour = (time24: string) => {
    const [h, m] = time24.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return { hour: String(hour12), minute: String(m).padStart(2, "0"), ampm };
  };

  const formatDateTime12 = (d: Date) => {
    const date = d.toLocaleDateString("en-GB");
    const h = d.getHours();
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${date}, ${hour12}:${mm} ${ampm}`;
  };

  const getEndTime = () => {
    if (!scheduledDate || !scheduledTimeHour) return null;
    const time24 = convertTo24Hour(scheduledTimeHour, scheduledTimeMinute, scheduledTimeAmPm);
    const start = new Date(`${scheduledDate}T${time24}`);
    const durationMins = testType === "FULL_LENGTH" ? 120 : testType === "SECTIONAL" ? 40 : 20;
    const end = new Date(start.getTime() + durationMins * 60000);
    const endH = end.getHours();
    const endAmpm = endH >= 12 ? "PM" : "AM";
    const endHour12 = endH % 12 === 0 ? 12 : endH % 12;
    return { date: end.toLocaleDateString("en-GB"), time: `${endHour12}:${String(end.getMinutes()).padStart(2, "0")} ${endAmpm}`, full: end };
  };

  const getExpiryTime = () => {
    if (!scheduledDate || !scheduledTimeHour) return null;
    const time24 = convertTo24Hour(scheduledTimeHour, scheduledTimeMinute, scheduledTimeAmPm);
    const start = new Date(`${scheduledDate}T${time24}`);
    const durationMins = testType === "FULL_LENGTH" ? 120 : testType === "SECTIONAL" ? 40 : 20;
    const expiry = new Date(start.getTime() + (durationMins + 30) * 60000);
    return expiry;
  };

  const handleAllocate = async () => {
    if (selectedStudentIds.length === 0) {
      toast.error("Select at least one student");
      return;
    }
    if (!scheduledDate || !scheduledTimeHour) {
      toast.error("Select scheduled date and time");
      return;
    }
    const time24 = convertTo24Hour(scheduledTimeHour, scheduledTimeMinute, scheduledTimeAmPm);
    const scheduledAt = new Date(`${scheduledDate}T${time24}`).toISOString();

    setAllocating(true);
    try {
      const res = await api.post("/admin/tests/allocate", {
        student_ids: selectedStudentIds,
        test_type: testType,
        scheduled_at: scheduledAt,
      });
      const { created, failed } = res.data.summary;
      if (created > 0) toast.success(`${created} test(s) allocated successfully`);
      if (failed > 0) toast.error(`${failed} allocation(s) failed (slot conflict or error)`);
      setSelectedStudentIds([]);
      setScheduledDate("");
      setScheduledTimeHour("");
      setScheduledTimeMinute("00");
      setScheduledTimeAmPm("AM");
      setStudentSearch("");
      setHasSearched(false);
      setStudents([]);
      setShowForm(false);
      fetchAllocations(currentPage);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to allocate test");
    } finally {
      setAllocating(false);
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const isTerminate = cancelTarget.status === "IN_PROGRESS";
    try {
      const res = await api.delete(`/admin/tests/allocations/${cancelTarget._id}`);
      toast.success(res.data?.status === "TERMINATED" ? "Test terminated successfully" : "Test cancelled successfully");
      fetchAllocations(currentPage);
    } catch (err: any) {
      toast.error(err.response?.data?.error || (isTerminate ? "Failed to terminate test" : "Failed to cancel test"));
    } finally {
      setCancelTarget(null);
    }
  };

  const confirmReschedule = async () => {
    if (!rescheduleAlloc || !rescheduleDate || !rescheduleTimeHour) {
      toast.error("Select new date and time");
      return;
    }
    const time24 = convertTo24Hour(rescheduleTimeHour, rescheduleTimeMinute, rescheduleTimeAmPm);
    const newDate = new Date(`${rescheduleDate}T${time24}`);
    if (newDate.getTime() <= Date.now()) {
      toast.error("Cannot reschedule to a time in the past");
      return;
    }
    const scheduledAt = newDate.toISOString();
    try {
      await api.put(`/admin/tests/allocations/${rescheduleAlloc._id}`, { scheduled_at: scheduledAt });
      toast.success("Test rescheduled successfully");
      setRescheduleAlloc(null);
      setRescheduleDate("");
      setRescheduleTimeHour("");
      setRescheduleTimeMinute("00");
      setRescheduleTimeAmPm("AM");
      fetchAllocations(currentPage);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to reschedule");
    }
  };

  const fetchViewQuestions = async (alloc: any) => {
    setLoadingQuestions(true);
    try {
      const res = await api.get(`/admin/tests/allocations/${alloc._id}/questions`);
      setViewQuestions(res.data.questions || []);
      setViewSections(res.data.sections || []);
      setShowQuestions(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to load questions");
    } finally {
      setLoadingQuestions(false);
    }
  };

  const confirmReallocate = async () => {
    if (!reallocateAlloc || !reallocateDate || !reallocateTimeHour) {
      toast.error("Select new date and time");
      return;
    }
    const time24 = convertTo24Hour(reallocateTimeHour, reallocateTimeMinute, reallocateTimeAmPm);
    const scheduledAt = new Date(`${reallocateDate}T${time24}`).toISOString();
    try {
      await api.post(`/admin/tests/allocations/${reallocateAlloc._id}/reallocate`, { scheduled_at: scheduledAt });
      toast.success("Test reallocated successfully");
      setReallocateAlloc(null);
      setReallocateDate("");
      setReallocateTimeHour("");
      setReallocateTimeMinute("00");
      setReallocateTimeAmPm("AM");
      fetchAllocations(currentPage);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to reallocate");
    }
  };

  const statusColors: Record<string, string> = {
    SCHEDULED: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-orange-100 text-orange-700",
    COMPLETED: "bg-green-100 text-green-700",
    EXPIRED: "bg-gray-100 text-gray-500",
    CANCELLED: "bg-red-100 text-red-700",
    TERMINATED: "bg-rose-100 text-rose-700",
    REALLOCATED: "bg-purple-100 text-purple-700",
  };

  const testTypeLabels: Record<string, string> = {
    FULL_LENGTH: "Full-Length GRE",
    SECTIONAL: "Sectional Test",
    TOPIC_WISE: "Topic-Wise Test",
  };

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Allocate Test</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${showForm ? "bg-gray-200 text-gray-700 hover:bg-gray-300" : "bg-blue-600 text-white hover:bg-blue-700"}`}
        >
          {showForm ? "Close Form" : "+ Allocate New Test"}
        </button>
      </div>

      <div className={`grid gap-6 ${showForm ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"}`}>
        {/* Left: Allocation Form — only when showForm */}
        {showForm && (
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm p-6 sticky top-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">New Test Allocation</h3>

            {/* Student Search */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Search Students by Email or Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. kpriet.ac.in or John..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchStudents()}
                  className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-black"
                />
                <button
                  onClick={fetchStudents}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                >
                  Search
                </button>
              </div>
            </div>

            {/* Student List — only show after search */}
            {hasSearched && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold text-gray-700">
                    Select Student(s) — {selectedStudentIds.length} selected
                  </label>
                  {students.length > 0 && (
                    <div className="flex gap-2">
                      <button onClick={selectAllStudents} className="text-xs text-blue-600 font-medium hover:underline">Select All</button>
                      <button onClick={deselectAllStudents} className="text-xs text-gray-500 font-medium hover:underline">Clear</button>
                    </div>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto border-2 border-gray-200 rounded-lg">
                  {students.length === 0 ? (
                    <div className="p-3 text-sm text-gray-400 text-center">No students found. Try a different search.</div>
                  ) : (
                    students.map((s) => (
                      <label
                        key={s._id}
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50 border-b border-gray-100 ${
                          selectedStudentIds.includes(s._id) ? "bg-blue-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(s._id)}
                          onChange={() => toggleStudent(s._id)}
                          className="w-4 h-4 accent-blue-600 text-black"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{s.name}</div>
                          <div className="text-xs text-gray-500 truncate">{s.email}</div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Test Type */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Test Type</label>
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-black"
              >
                <option value="FULL_LENGTH">Full-Length GRE Exam (55 Qs, 120 min)</option>
                <option value="SECTIONAL" disabled>Sectional Test (Coming Soon)</option>
                <option value="TOPIC_WISE" disabled>Topic-Wise Test (Coming Soon)</option>
              </select>
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Start Date</label>
                <input
                  type="date"
                  min={todayStr}
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Start Time</label>
                <div className="flex gap-1">
                  <select value={scheduledTimeHour} onChange={(e) => setScheduledTimeHour(e.target.value)}
                    className="flex-1 px-2 py-2 border-2 border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-black">
                    <option value="">Hr</option>
                    {Array.from({length: 12}, (_, i) => i + 1).map(h => <option key={h} value={String(h)}>{h}</option>)}
                  </select>
                  <span className="self-center text-gray-400">:</span>
                  <input type="number" min={0} max={59} value={scheduledTimeMinute} onChange={(e) => { const v = Math.max(0, Math.min(59, parseInt(e.target.value) || 0)); setScheduledTimeMinute(String(v).padStart(2, "0")); }}
                    className="w-12 px-1 py-2 border-2 border-gray-300 rounded-lg text-sm text-center outline-none focus:ring-2 focus:ring-blue-500 text-black" />
                  <select value={scheduledTimeAmPm} onChange={(e) => setScheduledTimeAmPm(e.target.value)}
                    className="flex-1 px-2 py-2 border-2 border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-black">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Auto-calculated end time */}
            {scheduledDate && scheduledTimeHour && (() => {
              const end = getEndTime();
              const expiry = getExpiryTime();
              const durationMins = testType === "FULL_LENGTH" ? 120 : testType === "SECTIONAL" ? 40 : 20;
              if (!end || !expiry) return null;
              return (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 space-y-1">
                  <div><strong>Test Duration:</strong> {durationMins} minutes</div>
                  <div><strong>End Time:</strong> {formatDateTime12(end.full)}</div>
                  <div><strong>Expiry (with 30 min grace):</strong> {formatDateTime12(expiry)}</div>
                </div>
              );
            })()}

            <button
              onClick={handleAllocate}
              disabled={allocating}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
            >
              {allocating ? "Allocating..." : "Allocate Test Now"}
            </button>
          </div>
        </div>
        )}

        {/* Right: Allocations List or View Panel */}
        <div className={showForm ? "lg:col-span-2" : ""}>
          {/* Status Summary Cards */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
            {[
              { key: "", label: "Total", value: statusCounts.total || 0, color: "text-gray-900", bg: "bg-white" },
              { key: "SCHEDULED", label: "Assigned", value: statusCounts.SCHEDULED || 0, color: "text-blue-700", bg: "bg-blue-50" },
              { key: "IN_PROGRESS", label: "In Progress", value: statusCounts.IN_PROGRESS || 0, color: "text-orange-700", bg: "bg-orange-50" },
              { key: "COMPLETED", label: "Completed", value: statusCounts.COMPLETED || 0, color: "text-green-700", bg: "bg-green-50" },
              { key: "EXPIRED", label: "Expired", value: statusCounts.EXPIRED || 0, color: "text-gray-600", bg: "bg-gray-50" },
              { key: "CANCELLED", label: "Cancelled", value: (statusCounts.CANCELLED || 0) + (statusCounts.TERMINATED || 0), color: "text-red-700", bg: "bg-red-50" },
            ].map((card) => (
              <button
                key={card.label}
                onClick={() => filterByStatus(card.key)}
                className={`${card.bg} rounded-xl shadow-sm p-4 text-left border-2 transition ${
                  fStatus === card.key ? "border-blue-500" : "border-transparent hover:border-gray-200"
                }`}
              >
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">{card.label}</div>
                <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
              </button>
            ))}
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <div className="flex gap-3 items-center">
              <input
                type="text"
                placeholder="Search by email or name (e.g. kpriet.ac.in)..."
                value={fSearch}
                onChange={(e) => setFSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-black"
              />
              <button onClick={applyFilters} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                Search
              </button>
              <button onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                {showFilters ? "Hide" : "Filters"}
              </button>
            </div>

            {showFilters && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                  <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-black">
                    <option value="">All Statuses</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="REALLOCATED">Reallocated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Date From</label>
                  <input type="date" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-black" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Date To</label>
                  <input type="date" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-black" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Time Range</label>
                  <div className="flex gap-1 items-center">
                    <select value={fTimeFrom} onChange={(e) => setFTimeFrom(e.target.value)}
                      className="flex-1 px-1 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 text-black">
                      <option value="">From</option>
                      {Array.from({length: 24}, (_, i) => { const h = i % 12 === 0 ? 12 : i % 12; const ap = i < 12 ? "AM" : "PM"; return <option key={i} value={`${String(i).padStart(2,"0")}:00`}>{h}:00 {ap}</option>; })}
                    </select>
                    <select value={fTimeTo} onChange={(e) => setFTimeTo(e.target.value)}
                      className="flex-1 px-1 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 text-black">
                      <option value="">To</option>
                      {Array.from({length: 24}, (_, i) => { const h = i % 12 === 0 ? 12 : i % 12; const ap = i < 12 ? "AM" : "PM"; return <option key={i} value={`${String(i).padStart(2,"0")}:00`}>{h}:00 {ap}</option>; })}
                    </select>
                  </div>
                </div>
                <div className="sm:col-span-4 flex gap-2 mt-2">
                  <button onClick={applyFilters} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                    Apply Filters
                  </button>
                  <button onClick={clearFilters} className="px-4 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Clear All
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Allocations Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Test Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Scheduled</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Allocated By</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allocations.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-400">No allocations found</td></tr>
                ) : (
                  allocations.map((a) => (
                    <tr key={a._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{a.student_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{a.student_email}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{testTypeLabels[a.test_type] || a.test_type}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {(() => { const d = new Date(a.scheduled_at); return formatDateTime12(d); })()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[a.status] || "bg-gray-100 text-gray-600"}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{a.allocated_by}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => setViewAlloc(a)}
                            title="View"
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                          </button>
                          <button
                            onClick={() => {
                              setRescheduleAlloc(a);
                              const d = new Date(a.scheduled_at);
                              setRescheduleDate(d.toISOString().split("T")[0]);
                              const t12 = convertTo12Hour(`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`);
                              setRescheduleTimeHour(t12.hour);
                              setRescheduleTimeMinute(t12.minute);
                              setRescheduleTimeAmPm(t12.ampm);
                            }}
                            disabled={a.status !== "SCHEDULED"}
                            title="Reschedule"
                            className={`p-1.5 rounded-lg ${a.status === "SCHEDULED" ? "bg-amber-100 hover:bg-amber-200 text-amber-700" : "bg-gray-50 text-gray-300 cursor-not-allowed"}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><line x1="8" x2="14" y1="14" y2="20"/><line x1="14" x2="8" y1="14" y2="20"/></svg>
                          </button>
                          <button
                            onClick={() => setCancelTarget(a)}
                            disabled={a.status !== "SCHEDULED" && a.status !== "IN_PROGRESS"}
                            title={a.status === "IN_PROGRESS" ? "Terminate" : "Cancel"}
                            className={`p-1.5 rounded-lg ${(a.status === "SCHEDULED" || a.status === "IN_PROGRESS") ? "bg-red-100 hover:bg-red-200 text-red-700" : "bg-gray-50 text-gray-300 cursor-not-allowed"}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" x2="19.07" y1="4.93" y2="19.07"/></svg>
                          </button>
                          {(a.status === "MALPRACTICE" || a.status === "TERMINATED") && (
                            <button
                              onClick={async () => {
                                setLoadingViolations(true);
                                setViolationsData(null);
                                try {
                                  const res = await api.get(`/admin/tests/allocations/${a._id}/violations`);
                                  setViolationsData(res.data);
                                } catch {
                                  toast.error("Failed to load violations");
                                } finally {
                                  setLoadingViolations(false);
                                }
                              }}
                              title="View Violations"
                              className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setReallocateAlloc(a);
                              setReallocateDate("");
                              setReallocateTimeHour("");
                              setReallocateTimeMinute("00");
                              setReallocateTimeAmPm("AM");
                            }}
                            disabled={a.status !== "EXPIRED"}
                            title="Reallocate"
                            className={`p-1.5 rounded-lg ${a.status === "EXPIRED" ? "bg-indigo-100 hover:bg-indigo-200 text-indigo-700" : "bg-gray-50 text-gray-300 cursor-not-allowed"}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                Showing <span className="font-medium text-gray-700">{(currentPage - 1) * perPage + 1}</span> to{" "}
                <span className="font-medium text-gray-700">{Math.min(currentPage * perPage, total)}</span> of{" "}
                <span className="font-medium text-gray-700">{total}</span> allocations
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => totalPages <= 7 || p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1))
                  .map((p, idx, arr) => (
                    <span key={p} className="flex items-center">
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-400">...</span>}
                      <button onClick={() => goToPage(p)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          p === currentPage ? "bg-blue-600 text-white" : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}>
                        {p}
                      </button>
                    </span>
                  ))}
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          )}

          {/* View Panel — inline on right side */}
          {viewAlloc && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{viewAlloc.test_title}</h3>
                  <p className="text-sm text-gray-500 mt-1">Test ID: {viewAlloc.test_id}</p>
                </div>
                <button onClick={() => setViewAlloc(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 font-semibold mb-1">Student</div>
                  <div className="text-sm font-medium text-gray-800">{viewAlloc.student_name}</div>
                  <div className="text-xs text-gray-500">{viewAlloc.student_email}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 font-semibold mb-1">Status</div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[viewAlloc.status]}`}>
                    {viewAlloc.status}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 font-semibold mb-1">Scheduled At</div>
                  <div className="text-sm text-gray-800">{(() => { const d = new Date(viewAlloc.scheduled_at); return formatDateTime12(d); })()}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 font-semibold mb-1">Expires At</div>
                  <div className="text-sm text-gray-800">{(() => { const d = new Date(viewAlloc.expires_at); return formatDateTime12(d); })()}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 font-semibold mb-1">Allocated By</div>
                  <div className="text-sm text-gray-800">{viewAlloc.allocated_by}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 font-semibold mb-1">Total Questions</div>
                  <div className="text-sm text-gray-800">{viewAlloc.question_ids?.length || 0}</div>
                </div>
              </div>

              <h4 className="font-bold text-gray-800 mb-3">Sections</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                {viewAlloc.sections?.map((sec: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => router.push(`/admin/allocate-test/questions-viewer?section=${encodeURIComponent(sec.name)}&allocId=${viewAlloc._id}&secIndex=${i}`)}
                    className="w-full text-left border border-gray-200 rounded-lg p-3 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-blue-600 text-sm hover:underline">{sec.name}</span>
                        <span className="text-xs text-gray-500 ml-2">({sec.subject})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{sec.question_ids?.length} questions</span>
                        <span className="text-xs font-medium text-blue-600">{sec.duration_mins} min</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-800">All Questions</h4>
                  <button
                    onClick={() => showQuestions ? setShowQuestions(false) : fetchViewQuestions(viewAlloc)}
                    disabled={loadingQuestions}
                    className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium rounded-lg disabled:opacity-50"
                  >
                    {loadingQuestions ? "Loading..." : (showQuestions ? "Hide Questions" : "Show all questions")}
                  </button>
                </div>

                {showQuestions && (
                  <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {viewQuestions.length === 0 ? (
                      <p className="text-sm text-gray-500">No questions found</p>
                    ) : (
                      viewQuestions.map((q: any, i: number) => (
                        <div key={q._id || i} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="text-sm font-semibold text-gray-800">
                              Q{i + 1}. {q.question_text}
                            </div>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full whitespace-nowrap">
                              {q.subject}
                            </span>
                          </div>
                          {q.passage && (
                            <div className="text-xs text-gray-600 mb-2 italic">{q.passage}</div>
                          )}
                          {q.options && q.options.length > 0 && (
                            <div className="space-y-1 ml-4 mb-2">
                              {q.options.map((opt: any, idx: number) => (
                                <div key={idx} className="text-sm text-gray-700">
                                  {String.fromCharCode(65 + idx)}. {opt.text}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 mt-2">
                            <span className="font-semibold">Correct:</span> {q.correct_answers?.map((a: any) => a.value || a).join(", ")}
                          </div>
                          <div className="text-xs text-gray-500">
                            <span className="font-semibold">Type:</span> {q.question_type} | <span className="font-semibold">Level:</span> {q.level}
                          </div>
                          {q.explanation && (
                            <div className="text-xs text-gray-600 mt-2 bg-white p-2 rounded border border-gray-100">
                              <span className="font-semibold">Explanation:</span> {q.explanation}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <button onClick={() => { setViewAlloc(null); setShowQuestions(false); setViewQuestions([]); }}
                className="mt-6 w-full py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-100">
                Close
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reschedule Modal */}
      {rescheduleAlloc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Reschedule Test</h3>
              <p className="text-sm text-gray-500 mb-4">
                {rescheduleAlloc.student_name} — {rescheduleAlloc.test_title}
              </p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Date</label>
                  <input type="date" min={todayStr} value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Time</label>
                  <div className="flex gap-1">
                    <select value={rescheduleTimeHour} onChange={(e) => setRescheduleTimeHour(e.target.value)}
                      className="flex-1 px-2 py-2 border-2 border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-black">
                      <option value="">Hr</option>
                      {Array.from({length: 12}, (_, i) => i + 1).map(h => <option key={h} value={String(h)}>{h}</option>)}
                    </select>
                    <span className="self-center text-gray-400">:</span>
                    <input type="number" min={0} max={59} value={rescheduleTimeMinute} onChange={(e) => { const v = Math.max(0, Math.min(59, parseInt(e.target.value) || 0)); setRescheduleTimeMinute(String(v).padStart(2, "0")); }}
                      className="w-12 px-1 py-2 border-2 border-gray-300 rounded-lg text-sm text-center outline-none focus:ring-2 focus:ring-blue-500 text-black" />
                    <select value={rescheduleTimeAmPm} onChange={(e) => setRescheduleTimeAmPm(e.target.value)}
                      className="flex-1 px-2 py-2 border-2 border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-black">
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>
              {rescheduleDate && rescheduleTimeHour && (() => {
                const time24 = convertTo24Hour(rescheduleTimeHour, rescheduleTimeMinute, rescheduleTimeAmPm);
                const picked = new Date(`${rescheduleDate}T${time24}`);
                if (picked.getTime() <= Date.now()) {
                  return (
                    <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 font-medium">
                      Selected time is in the past. Please choose a future date/time.
                    </div>
                  );
                }
                return null;
              })()}
              <div className="flex gap-3">
                <button onClick={confirmReschedule}
                  disabled={(() => {
                    if (!rescheduleDate || !rescheduleTimeHour) return false;
                    const time24 = convertTo24Hour(rescheduleTimeHour, rescheduleTimeMinute, rescheduleTimeAmPm);
                    return new Date(`${rescheduleDate}T${time24}`).getTime() <= Date.now();
                  })()}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  Reschedule
                </button>
                <button onClick={() => setRescheduleAlloc(null)}
                  className="px-4 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-100">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel/Terminate Confirmation */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {cancelTarget.status === "IN_PROGRESS" ? "Terminate Test" : "Cancel Test"}
              </h3>
              <p className="text-sm text-gray-500 mb-5">
                {cancelTarget.status === "IN_PROGRESS"
                  ? "This test is currently in progress. Terminating it will immediately end the session, discard any progress, and release the assigned questions for future allocations."
                  : "Are you sure you want to cancel this test? This will also remove the student's question history for this test."}
              </p>
              <div className="flex gap-3">
                <button onClick={confirmCancel}
                  className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-bold hover:bg-red-700">
                  {cancelTarget.status === "IN_PROGRESS" ? "Terminate Test" : "Cancel Test"}
                </button>
                <button onClick={() => setCancelTarget(null)}
                  className="px-4 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-100">
                  Keep
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reallocate Modal */}
      {reallocateAlloc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Reallocate Expired Test</h3>
              <p className="text-sm text-gray-500 mb-1">
                {reallocateAlloc.student_name} — {reallocateAlloc.test_title}
              </p>
              <p className="text-xs text-gray-400 mb-4">
                A new test will be created with fresh questions. The old expired test will be marked as reallocated.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Date</label>
                  <input type="date" min={todayStr} value={reallocateDate} onChange={(e) => setReallocateDate(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Time</label>
                  <div className="flex gap-1">
                    <select value={reallocateTimeHour} onChange={(e) => setReallocateTimeHour(e.target.value)}
                      className="flex-1 px-2 py-2 border-2 border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-black">
                      <option value="">Hr</option>
                      {Array.from({length: 12}, (_, i) => i + 1).map(h => <option key={h} value={String(h)}>{h}</option>)}
                    </select>
                    <span className="self-center text-gray-400">:</span>
                    <input type="number" min={0} max={59} value={reallocateTimeMinute} onChange={(e) => { const v = Math.max(0, Math.min(59, parseInt(e.target.value) || 0)); setReallocateTimeMinute(String(v).padStart(2, "0")); }}
                      className="w-12 px-1 py-2 border-2 border-gray-300 rounded-lg text-sm text-center outline-none focus:ring-2 focus:ring-blue-500 text-black" />
                    <select value={reallocateTimeAmPm} onChange={(e) => setReallocateTimeAmPm(e.target.value)}
                      className="flex-1 px-2 py-2 border-2 border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-black">
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={confirmReallocate}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-bold hover:bg-indigo-700">
                  Reallocate Test
                </button>
                <button onClick={() => setReallocateAlloc(null)}
                  className="px-4 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-100">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Violations Modal */}
      {(violationsData || loadingViolations) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            {loadingViolations ? (
              <div className="p-8 text-center text-gray-400">Loading violations...</div>
            ) : violationsData ? (
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Violation Details</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{violationsData.test_title}</p>
                    <p className="text-xs text-gray-400">{violationsData.student_name} · {violationsData.student_email}</p>
                  </div>
                  <button onClick={() => setViolationsData(null)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">{violationsData.status}</span>
                  <span className="text-xs text-gray-500">{violationsData.violation_count} violation(s) recorded</span>
                  {violationsData.malpractice_at && (
                    <span className="text-xs text-gray-400">Terminated: {new Date(violationsData.malpractice_at).toLocaleString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</span>
                  )}
                </div>
                {violationsData.violations && violationsData.violations.length > 0 ? (
                  <div className="space-y-3">
                    {violationsData.violations.map((v: any, i: number) => {
                      const labels: Record<string, string> = {
                        TAB_SWITCH: "Tab Switch",
                        FULLSCREEN_EXIT: "Exited Fullscreen Mode",
                        COPY_PASTE: "Copy/Paste Detected",
                        WINDOW_BLUR: "Window Lost Focus",
                        RIGHT_CLICK: "Right-Click Detected",
                        DEVTOOLS_OPEN: "Developer Tools Opened",
                      };
                      return (
                        <div key={i} className="flex items-start gap-3 border border-gray-100 rounded-xl p-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${v.severity === "high" ? "bg-red-100 text-red-700" : v.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-800">{labels[v.violation_type] || v.violation_type}</p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${v.severity === "high" ? "bg-red-50 text-red-600" : v.severity === "medium" ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-500"}`}>{v.severity}</span>
                            </div>
                            {v.details && <p className="text-xs text-gray-500 mt-0.5">{v.details}</p>}
                            <p className="text-xs text-gray-400 mt-0.5">{new Date(v.timestamp).toLocaleString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">No violation details recorded.</p>
                )}
                <div className="flex justify-end mt-5">
                  <button onClick={() => setViolationsData(null)} className="px-4 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-100">Close</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
