"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { countries } from "@/lib/countries";
import BulkImportModal from "./BulkImportModal";

const emptyForm = { name: "", username: "", email: "", password: "", phone: "", city: "", country: "" };

export default function StudentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Loading...</div>}>
      <StudentsContent />
    </Suspense>
  );
}

function StudentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  // Pagination
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [countryFilter, setCountryFilter] = useState(searchParams.get("country") || "");
  const [cityFilter, setCityFilter] = useState(searchParams.get("city") || "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const fetchStudents = useCallback((page: number) => {
    const params: any = { page: String(page) };
    if (search) params.search = search;
    if (countryFilter) params.country = countryFilter;
    if (cityFilter) params.city = cityFilter;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    api.get("/admin/students", { params })
      .then((res) => {
        setStudents(res.data.students);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      })
      .finally(() => setLoading(false));
  }, [search, countryFilter, cityFilter, dateFrom, dateTo]);

  useEffect(() => { fetchStudents(currentPage); }, [currentPage, fetchStudents]);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (countryFilter) params.set("country", countryFilter);
    if (cityFilter) params.set("city", cityFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("page", String(page));
    router.push(`/admin/students?${params.toString()}`);
  };

  const applyFilters = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (countryFilter) params.set("country", countryFilter);
    if (cityFilter) params.set("city", cityFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("page", "1");
    router.push(`/admin/students?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearch(""); setCountryFilter(""); setCityFilter("");
    setDateFrom(""); setDateTo("");
    router.push("/admin/students?page=1");
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      name: s.name || "", username: s.username || "", email: s.email || "",
      password: "", phone: s.phone || "", city: s.city || "", country: s.country || "",
    });
    setError("");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.username || !form.email) {
      setError("Name, username and email are required");
      return;
    }
    try {
      if (editing) {
        const payload: any = { ...form };
        if (!form.password) delete payload.password;
        await api.put(`/admin/students/${editing._id}`, payload);
      } else {
        if (!form.password) { setError("Password required"); return; }
        await api.post("/admin/students", form);
      }
      setShowModal(false);
      toast.success(editing ? "Student updated successfully" : "Student created successfully");
      fetchStudents(currentPage);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed");
      toast.error(err.response?.data?.error || "Failed to save student");
    }
  };

  const [showPassword, setShowPassword] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/admin/students/${deleteTarget}`);
      toast.success("Student deleted successfully");
      fetchStudents(currentPage);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete student");
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

  const inputClass = "w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-gray-900 bg-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Students</h2>
        <div className="flex gap-2 items-center">
          <button onClick={() => { setLoading(true); fetchStudents(currentPage); toast.success("Data refreshed"); }}
            className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-1.5"
            title="Refresh">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
            Refresh
          </button>
          <button onClick={() => { setShowBulkModal(true); }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
            Bulk Import
          </button>
          <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            + Add Student
          </button>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex gap-3 items-center">
          <input
            type="text" placeholder="Search by name, email, username, phone, city, country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={applyFilters} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            Search
          </button>
          <button onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            {showFilters ? "Hide Filters" : "Filters"}
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Country</label>
              <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Countries</option>
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">City</label>
              <input type="text" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
                placeholder="Filter by city"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Date To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500" />
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

      {/* Students Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Username</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">City</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Country</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Completed</th>
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Upcoming</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-8 text-gray-400">No students found</td></tr>
            ) : (
              students.map((s) => (
                <tr key={s._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800">{s.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.username || "-"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.phone || "-"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.city || "-"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{s.country || "-"}</td>
                  <td className="px-6 py-4 text-sm text-center">
                    <span className="inline-flex items-center px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                      {s.completed_tests || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <span className="inline-flex items-center px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                      {s.upcoming_tests || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">{(() => { const d = new Date(s.createdAt); const h = d.getHours(); const ampm = h >= 12 ? "PM" : "AM"; const hour12 = h % 12 === 0 ? 12 : h % 12; return `${d.toLocaleDateString("en-GB")}, ${hour12}:${String(d.getMinutes()).padStart(2, "0")} ${ampm}`; })()}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          toast.info(`Allocate Test for ${s.name || s.username || "student"}`);
                        }}
                        title="Allocate Test"
                        className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M12 14v4"/><path d="M10 16h4"/></svg>
                      </button>
                      <button
                        onClick={() => router.push(`/admin/students/${s._id}/analytics`)}
                        title="View Analytics"
                        className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                      </button>
                      <button
                        onClick={() => {
                          toast.info(`View History for ${s.name || s.username || "student"}`);
                        }}
                        title="View History"
                        className="p-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>
                      </button>
                      <button onClick={() => openEdit(s)} title="Edit"
                        className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                      </button>
                      <button onClick={() => handleDelete(s._id)} title="Delete"
                        className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
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
            Showing <span className="font-medium text-gray-700">{(currentPage - 1) * 20 + 1}</span> to{" "}
            <span className="font-medium text-gray-700">{Math.min(currentPage * 20, total)}</span> of{" "}
            <span className="font-medium text-gray-700">{total}</span> students
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => {
                if (totalPages <= 7) return true;
                if (p === 1 || p === totalPages) return true;
                if (p >= currentPage - 1 && p <= currentPage + 1) return true;
                return false;
              })
              .map((p, idx, arr) => (
                <span key={p} className="flex items-center">
                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                    <span className="px-1 text-gray-400">...</span>
                  )}
                  <button
                    onClick={() => goToPage(p)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${
                      p === currentPage
                        ? "bg-blue-600 text-white"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                </span>
              ))}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <BulkImportModal
          onClose={() => setShowBulkModal(false)}
          onDone={() => fetchStudents(currentPage)}
        />
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-5 text-gray-900">{editing ? "Edit Student" : "Add Student"}</h3>
            {error && <div className="bg-red-100 text-red-700 text-sm rounded-lg p-3 mb-4 font-medium border border-red-200">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Full Name *</label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass} placeholder="Enter student name" required />
              </div>
              <div>
                <label className={labelClass}>Username *</label>
                <input type="text" value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className={inputClass} placeholder="Enter username" required />
              </div>
              <div>
                <label className={labelClass}>Email *</label>
                <input type="email" value={form.email} required
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputClass} placeholder="Enter student email" />
              </div>
              <div>
                <label className={labelClass}>{editing ? "Password (leave blank to keep current)" : "Password *"}</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className={inputClass} placeholder={editing ? "••••••••" : "Enter password"}
                    required={!editing} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>
                    </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass}>Phone Number</label>
                <input type="tel" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputClass} placeholder="+1 234 567 890" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>City</label>
                  <input type="text" value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className={inputClass} placeholder="City" />
                </div>
                <div>
                  <label className={labelClass}>Country</label>
                  <select value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className={inputClass}>
                    <option value="">Select Country</option>
                    {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700">
                  {editing ? "Update" : "Create"}
                </button>
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-100">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-sm">
            <h3 className="text-xl font-bold mb-2 text-gray-900">Delete Student</h3>
            <p className="text-sm text-gray-500 mb-5">Are you sure you want to delete this student? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={confirmDelete}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-bold hover:bg-red-700">
                Delete
              </button>
              <button onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-100">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
