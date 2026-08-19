"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import QuestionForm from "./QuestionForm";
import QuestionBulkUploadModal from "./QuestionBulkUploadModal";

const defaultSubjects = ["Quant", "Verbal", "AWA"];

const levelColors: Record<string, string> = {
  Easy: "bg-green-100 text-green-700",
  Medium: "bg-yellow-100 text-yellow-700",
  Hard: "bg-red-100 text-red-700",
};

export default function QuestionsPage() {
  const [allSubjects, setAllSubjects] = useState<string[]>(defaultSubjects);
  const [selectedSubject, setSelectedSubject] = useState<string>("Quant");
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [search, setSearch] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>({});
  const [showForm, setShowForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/admin/questions/export`, {
        params: { subject: selectedSubject },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers["content-disposition"] || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : `${selectedSubject}_Export.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${selectedSubject} exported successfully`);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const fetchSubjects = useCallback(async () => {
    try {
      const res = await api.get("/admin/subjects");
      const subs = (res.data.subjects || []).map((s: any) => s.name);
      setAllSubjects(subs.length > 0 ? subs : defaultSubjects);
    } catch {
      setAllSubjects(defaultSubjects);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/admin/questions/stats");
      setStats(res.data.stats);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchCategories = useCallback(async (subject: string) => {
    try {
      const res = await api.get(`/admin/questions/categories?subject=${subject}`);
      setCategories(res.data.categories || []);
    } catch {
      setCategories([]);
    }
  }, []);

  const fetchQuestions = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params: any = { subject: selectedSubject, page: String(p), limit: "20" };
      if (selectedCategory) params.category = selectedCategory;
      if (selectedLevel) params.level = selectedLevel;
      if (search) params.search = search;
      const res = await api.get("/admin/questions", { params });
      setQuestions(res.data.questions || []);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
      setPage(p);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to fetch questions");
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSubject, selectedCategory, selectedLevel, search]);

  useEffect(() => { fetchSubjects(); fetchStats(); }, [fetchSubjects, fetchStats]);
  useEffect(() => { fetchCategories(selectedSubject); setSelectedCategory(""); setSelectedLevel(""); setPage(1); }, [selectedSubject, fetchCategories]);
  useEffect(() => { fetchQuestions(1); }, [fetchQuestions]);

  const handleSubjectChange = (s: string) => {
    setSelectedSubject(s);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/admin/questions/${deleteTarget._id}?subject=${selectedSubject}`);
      toast.success("Question deleted");
      fetchQuestions(page);
      fetchStats();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete");
    } finally {
      setDeleteTarget(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddSubject = async () => {
    if (!newSubjectName.trim()) return;
    try {
      await api.post("/admin/subjects", { name: newSubjectName.trim() });
      toast.success(`Subject "${newSubjectName.trim()}" created`);
      setNewSubjectName("");
      setShowAddSubject(false);
      fetchSubjects();
      fetchStats();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create subject");
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await api.post(`/admin/categories?subject=${selectedSubject}`, { category: newCategoryName.trim() });
      toast.success(`Category "${newCategoryName.trim()}" created`);
      setNewCategoryName("");
      setShowAddCategory(false);
      fetchCategories(selectedSubject);
      fetchStats();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create category");
    }
  };

  const inputClass = "px-3 py-2 border-2 border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="flex min-h-screen">
      {/* Category Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 fixed h-full overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Question Bank</h2>
        </div>

        {/* Subject search */}
        <div className="px-3 pt-3">
          <input type="text" value={subjectSearch}
            onChange={(e) => setSubjectSearch(e.target.value)}
            placeholder="Search subjects..."
            className="w-full px-2.5 py-1.5 border-2 border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 mb-2" />
        </div>

        {/* Subject tabs */}
        <div className="p-3 pt-1 space-y-1">
          {allSubjects.filter((s) => s.toLowerCase().includes(subjectSearch.toLowerCase())).map((s) => {
            const sStats = stats[s];
            return (
              <button key={s} onClick={() => handleSubjectChange(s)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  selectedSubject === s ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}>
                <div className="flex justify-between items-center">
                  <span>{s}</span>
                  {sStats && <span className={`text-xs px-2 py-0.5 rounded-full ${selectedSubject === s ? "bg-blue-500" : "bg-gray-100"}`}>{sStats.total}</span>}
                </div>
                {sStats && selectedSubject === s && (
                  <div className="flex gap-2 mt-1.5 text-xs">
                    <span className="text-green-200">E: {sStats.easy}</span>
                    <span className="text-yellow-200">M: {sStats.medium}</span>
                    <span className="text-red-200">H: {sStats.hard}</span>
                  </div>
                )}
              </button>
            );
          })}
          {showAddSubject ? (
            <div className="flex gap-1.5 mt-2">
              <input type="text" value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
                placeholder="New subject name"
                className="flex-1 px-2 py-1.5 border-2 border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={handleAddSubject} className="bg-blue-600 text-white px-2 py-1.5 rounded-lg text-sm font-medium">Add</button>
              <button onClick={() => { setShowAddSubject(false); setNewSubjectName(""); }} className="text-gray-400 px-1">✕</button>
            </div>
          ) : (
            <button onClick={() => setShowAddSubject(true)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-blue-600 hover:bg-blue-50 font-medium transition">
              + Add Subject
            </button>
          )}
        </div>

        {/* Category list */}
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Categories</p>
            <button onClick={() => setShowAddCategory(!showAddCategory)}
              className="text-blue-600 hover:text-blue-800 text-xs font-medium">+ Add</button>
          </div>
          {showAddCategory && (
            <div className="flex gap-1.5 mb-2">
              <input type="text" value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                placeholder="New category name"
                className="flex-1 px-2 py-1.5 border-2 border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={handleAddCategory} className="bg-blue-600 text-white px-2 py-1.5 rounded-lg text-sm font-medium">Add</button>
            </div>
          )}
          {/* Category search */}
          <input type="text" value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            placeholder="Search categories..."
            className="w-full px-2.5 py-1.5 border-2 border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 mb-2" />
          <div className="space-y-0.5 max-h-96 overflow-y-auto">
            <button onClick={() => setSelectedCategory("")}
              className={`w-full text-left px-3 py-1.5 rounded text-sm transition ${
                !selectedCategory ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50"
              }`}>
              All Categories ({total})
            </button>
            {categories.filter((cat) => cat.toLowerCase().includes(categorySearch.toLowerCase())).map((cat) => (
              <button key={cat} onClick={() => { setSelectedCategory(cat); setPage(1); }}
                className={`w-full text-left px-3 py-1.5 rounded text-sm transition ${
                  selectedCategory === cat ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-50"
                }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-64 p-8">
        {showForm ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {editingQuestion ? "Edit Question" : "Create Question"} — {selectedSubject}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {editingQuestion ? "Editing existing question" : "Add a new question to the question bank"}
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={() => { fetchQuestions(page); fetchStats(); toast.success("Data refreshed"); }}
                  className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-1.5"
                  title="Refresh">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                  Refresh
                </button>
              </div>
            </div>
            <QuestionForm
              key={editingQuestion?._id || "new"}
              subject={selectedSubject}
              editing={editingQuestion}
              categories={categories}
              onCancel={() => { setShowForm(false); setEditingQuestion(null); }}
              onSaved={() => { fetchQuestions(page); fetchStats(); fetchCategories(selectedSubject); }}
            />
          </>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Question Bank — {selectedSubject}</h2>
                <p className="text-sm text-gray-500 mt-1">{total} questions{selectedCategory ? ` in ${selectedCategory}` : ""}</p>
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={() => { fetchQuestions(page); fetchStats(); toast.success("Data refreshed"); }}
                  className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-1.5"
                  title="Refresh">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
                  Refresh
                </button>
                <button onClick={() => setShowBulkUpload(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
                  Bulk Upload
                </button>
                <button onClick={handleExport}
                  disabled={exporting}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
                  {exporting ? "Exporting..." : "Export Excel"}
                </button>
                <button onClick={() => { setEditingQuestion(null); setShowForm(true); }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                  + Add Question
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-6 flex-wrap">
              <input type="text" value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchQuestions(1)}
                className={inputClass + " w-64"} placeholder="Search questions..." />
              <select value={selectedLevel} onChange={(e) => { setSelectedLevel(e.target.value); setPage(1); }}
                className={inputClass}>
                <option value="">All Levels</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
              {selectedCategory && (
                <button onClick={() => { setSelectedCategory(""); setPage(1); }}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                  Clear category: {selectedCategory} ✕
                </button>
              )}
            </div>

            {/* Questions list */}
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading questions...</div>
            ) : questions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No questions found</div>
            ) : (
              <div className="space-y-3">
              {questions.map((q) => {
                const id = q._id;
                const expanded = expandedIds.has(id);
                return (
                  <div key={id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 cursor-pointer" onClick={() => toggleExpand(id)}>
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-mono text-gray-400">{q.question_id}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${levelColors[q.level] || "bg-gray-100 text-gray-600"}`}>{q.level}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">{q.category}</span>
                            {q.question_type !== "MULTIPLE_CHOICE_SINGLE" && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">{q.question_type}</span>
                            )}
                            {q.images?.length > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium flex items-center gap-1">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                                {q.images.length}
                              </span>
                            )}
                          </div>
                          <p className={`text-sm text-gray-800 ${expanded ? "" : "line-clamp-2"}`}>{q.question_text}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); setEditingQuestion(q); setShowForm(true); }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(q); }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                        {q.passage && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Passage</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{q.passage}</p>
                          </div>
                        )}
                        {q.options?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Options</p>
                            <div className="space-y-1">
                              {q.options.map((opt: any, i: number) => {
                                const isCorrect = q.correct_answers?.some((ca: any) => ca.option_label === opt.label);
                                return (
                                  <div key={i} className={`flex gap-2 text-sm ${isCorrect ? "text-green-700 font-medium" : "text-gray-700"}`}>
                                    <span className="font-bold w-6">{opt.label}.</span>
                                    <span>{opt.text}</span>
                                    {isCorrect && <span className="text-green-600">✓</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {q.explanation && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Explanation</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{q.explanation}</p>
                          </div>
                        )}
                        {q.images?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Images</p>
                            <div className="flex flex-wrap gap-3">
                              {q.images.map((img: any, i: number) => (
                                <div key={i} className="border border-gray-200 rounded-lg p-2 bg-white">
                                  <p className="text-xs text-gray-500 mb-1 font-medium">{img.type === "answer" ? "Answer" : "Question"}</p>
                                  {img.image_name?.startsWith("data:") || img.image_name?.startsWith("http") ? (
                                    <img src={img.image_name} alt={img.caption || ""} className="max-w-40 max-h-40 rounded border border-gray-100" />
                                  ) : (
                                    <span className="text-xs text-gray-500">{img.image_name}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button onClick={() => fetchQuestions(page - 1)} disabled={page <= 1}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                Prev
              </button>
              <span className="text-sm text-gray-600 px-3">Page {page} of {totalPages}</span>
              <button onClick={() => fetchQuestions(page + 1)} disabled={page >= totalPages}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                Next
              </button>
            </div>
          )}
          </>
        )}
      </div>

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <QuestionBulkUploadModal
          subject={selectedSubject}
          onClose={() => setShowBulkUpload(false)}
          onDone={() => { fetchQuestions(1); fetchStats(); }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-sm">
            <h3 className="text-xl font-bold mb-2 text-gray-900">Delete Question</h3>
            <p className="text-sm text-gray-500 mb-5">Are you sure you want to delete this question? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={handleDelete}
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
