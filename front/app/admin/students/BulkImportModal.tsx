"use client";

import { useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

interface BulkImportModalProps {
  onClose: () => void;
  onDone: () => void;
}

export default function BulkImportModal({ onClose, onDone }: BulkImportModalProps) {
  const [bulkResult, setBulkResult] = useState<any>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [editFailedRows, setEditFailedRows] = useState<any[]>([]);
  const [retryLoading, setRetryLoading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkLoading(true);
    setBulkError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.post("/admin/students/bulk-import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setBulkResult(res.data);
      toast.success(`Imported: ${res.data.created} created, ${res.data.skipped} skipped, ${res.data.failed} failed`);
      const failedRows = res.data.results.filter((r: any) => r.status === "failed");
      if (failedRows.length > 0) {
        setEditFailedRows(failedRows.map((r: any) => ({
          name: r.name, email: r.email, username: "", phone: "", city: "", country: "", password: "", reason: r.reason,
        })));
      }
    } catch (err: any) {
      setBulkError(err.response?.data?.error || "Upload failed");
      toast.error(err.response?.data?.error || "Upload failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleRetry = async () => {
    setRetryLoading(true);
    try {
      const res = await api.post("/admin/students/bulk-import-retry", editFailedRows);
      toast.success(`Retry: ${res.data.created} created, ${res.data.failed} failed`);
      const stillFailed = res.data.results.filter((r: any) => r.status === "failed");
      setEditFailedRows(stillFailed.map((r: any) => ({
        name: r.name, email: r.email, username: "", phone: "", city: "", country: "", password: "", reason: r.reason,
      })));
      setBulkResult((prev: any) => ({
        ...prev,
        created: prev.created + res.data.created,
        failed: res.data.failed,
      }));
      if (stillFailed.length === 0) setEditFailedRows([]);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Retry failed");
    } finally {
      setRetryLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-2 text-gray-900">Bulk Import Students</h3>
        <p className="text-sm text-gray-500 mb-4">Upload an Excel file (.xlsx) with student data. Only Name and Email are required.</p>

        {bulkError && <div className="bg-red-100 text-red-700 text-sm rounded-lg p-3 mb-4 font-medium border border-red-200">{bulkError}</div>}

        {bulkResult ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{bulkResult.created}</p>
                <p className="text-xs text-gray-600 mt-1">Created</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">{bulkResult.skipped}</p>
                <p className="text-xs text-gray-600 mt-1">Skipped</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{bulkResult.failed}</p>
                <p className="text-xs text-gray-600 mt-1">Failed</p>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              Total rows processed: <span className="font-bold">{bulkResult.total}</span>
            </div>
            {bulkResult.results && bulkResult.results.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Name</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Email</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Status</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bulkResult.results.map((r: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-gray-800">{r.name}</td>
                        <td className="px-3 py-2 text-gray-600">{r.email}</td>
                        <td className="px-3 py-2">
                          <span className={r.status === "created" ? "text-green-600 font-medium" : r.status === "skipped" ? "text-yellow-600 font-medium" : "text-red-600 font-medium"}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-400">{r.reason || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {editFailedRows.length > 0 && (
              <div className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50">
                <p className="text-sm font-semibold text-orange-700 mb-3">Fix failed rows and retry:</p>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {editFailedRows.map((row, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2 bg-white p-3 rounded-lg border border-orange-100">
                      <input type="text" placeholder="Name" value={row.name}
                        onChange={(e) => setEditFailedRows(editFailedRows.map((r, j) => j === i ? { ...r, name: e.target.value } : r))}
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 outline-none focus:ring-1 focus:ring-blue-500" />
                      <input type="email" placeholder="Email" value={row.email}
                        onChange={(e) => setEditFailedRows(editFailedRows.map((r, j) => j === i ? { ...r, email: e.target.value } : r))}
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 outline-none focus:ring-1 focus:ring-blue-500" />
                      <input type="text" placeholder="Username" value={row.username}
                        onChange={(e) => setEditFailedRows(editFailedRows.map((r, j) => j === i ? { ...r, username: e.target.value } : r))}
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 outline-none focus:ring-1 focus:ring-blue-500" />
                      <input type="text" placeholder="Phone" value={row.phone}
                        onChange={(e) => setEditFailedRows(editFailedRows.map((r, j) => j === i ? { ...r, phone: e.target.value } : r))}
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 outline-none focus:ring-1 focus:ring-blue-500" />
                      <input type="text" placeholder="City" value={row.city}
                        onChange={(e) => setEditFailedRows(editFailedRows.map((r, j) => j === i ? { ...r, city: e.target.value } : r))}
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 outline-none focus:ring-1 focus:ring-blue-500" />
                      <input type="text" placeholder="Country" value={row.country}
                        onChange={(e) => setEditFailedRows(editFailedRows.map((r, j) => j === i ? { ...r, country: e.target.value } : r))}
                        className="px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 outline-none focus:ring-1 focus:ring-blue-500" />
                      <input type="text" placeholder="Password (optional)" value={row.password}
                        onChange={(e) => setEditFailedRows(editFailedRows.map((r, j) => j === i ? { ...r, password: e.target.value } : r))}
                        className="col-span-2 px-2 py-1.5 border border-gray-300 rounded text-sm text-gray-900 outline-none focus:ring-1 focus:ring-blue-500" />
                      <p className="col-span-2 text-xs text-red-500">{row.reason}</p>
                    </div>
                  ))}
                </div>
                <button onClick={handleRetry} disabled={retryLoading}
                  className="mt-3 w-full bg-orange-600 text-white py-2 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50">
                  {retryLoading ? "Retrying..." : `Retry ${editFailedRows.length} Failed Rows`}
                </button>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { onClose(); onDone(); }}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700">
                Done
              </button>
              <button onClick={() => { setBulkResult(null); setEditFailedRows([]); }}
                className="px-4 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-100">
                Import Another
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <p className="text-gray-500 mb-2">Select an Excel file to upload</p>
              <p className="text-xs text-gray-400 mb-4">Supported: .xlsx, .xls | Required columns: Name, Email</p>
              <input type="file" accept=".xlsx,.xls" id="bulk-file" className="hidden" onChange={handleFileUpload} />
              <label htmlFor="bulk-file"
                className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 cursor-pointer">
                {bulkLoading ? "Uploading..." : "Choose File"}
              </label>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500">
              <p className="font-semibold text-gray-700 mb-1">Expected columns:</p>
              <p>Name* | Email* | Username | Phone Number | City | Country | Password | Confirm Password</p>
              <p className="mt-1">* = Required. Missing optional columns will use defaults.</p>
            </div>
            <button onClick={onClose}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-100">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
