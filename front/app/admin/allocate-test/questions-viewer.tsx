"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";

export default function QuestionsViewer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionName = searchParams.get("section") || "";
  
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<any>({});
  const [categories, setCategories] = useState<string[]>([]);
  
  const perPage = 10;

  useEffect(() => {
    if (!sectionName) {
      router.push("/admin/allocate-test");
      return;
    }
    fetchQuestions();
  }, [sectionName, filters, currentPage]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: currentPage,
        limit: perPage,
      };
      
      if (filters.category) params.category = filters.category;
      if (filters.level) params.level = filters.level;
      if (filters.subject) params.subject = filters.subject;

      const res = await api.get("/admin/questions", { params });
      setQuestions(res.data.questions || []);
      
      // Extract unique categories from questions
      const cats = [...new Set(res.data.questions?.map((q: any) => q.category) || [])];
      setCategories(cats as string[]);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to load questions");
    } finally {
      setLoading(false);
    }
  };

  const getSectionSubtitle = (section: string) => {
    const map: Record<string, string> = {
      "Analytical Writing": "AWA",
      "Verbal Reasoning 1": "Verbal",
      "Verbal Reasoning 2": "Verbal",
      "Quantitative Reasoning 1": "Quant",
      "Quantitative Reasoning 2": "Quant",
    };
    return map[section] || section;
  };

  if (loading) {
    return <div className="p-8 text-gray-400">Loading questions...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{sectionName}</h1>
          <p className="text-sm text-gray-500 mt-1">{getSectionSubtitle(sectionName)}</p>
        </div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-100"
        >
          Back
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
            <select
              value={filters.category || ""}
              onChange={(e) => {
                setFilters({ ...filters, category: e.target.value });
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Level</label>
            <select
              value={filters.level || ""}
              onChange={(e) => {
                setFilters({ ...filters, level: e.target.value });
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Levels</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Question Type</label>
            <select
              value={filters.question_type || ""}
              onChange={(e) => {
                setFilters({ ...filters, question_type: e.target.value });
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="MCQ">Multiple Choice</option>
              <option value="MSQ">Multiple Select</option>
              <option value="Numeric">Numeric Entry</option>
            </select>
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-6">
        {questions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No questions found</div>
        ) : (
          questions.map((q, idx) => (
            <div key={q._id || idx} className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-semibold">
                      Q{idx + 1}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                      {q.category}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full font-semibold ${
                      q.level === "Easy" ? "bg-green-100 text-green-700" :
                      q.level === "Medium" ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {q.level}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{q.question_text}</h3>
                </div>
              </div>

              {/* Passage */}
              {q.passage && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-700 italic">{q.passage}</p>
                </div>
              )}

              {/* Question Image */}
              {q.images && q.images.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Question Image:</p>
                  {q.images.map((img: any, i: number) => (
                    <img
                      key={i}
                      src={img.image_url || `https://s3.amazonaws.com/gretest1234/images/${img.image_name}`}
                      alt={`Question ${idx + 1}`}
                      className="max-w-md rounded-lg border border-gray-300"
                    />
                  ))}
                </div>
              )}

              {/* Options */}
              {q.options && q.options.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Options:</p>
                  <div className="space-y-2">
                    {q.options.map((opt: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                        <span className="font-semibold text-gray-700 min-w-fit">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        <span className="text-gray-700">{opt.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Correct Answer */}
              <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm font-semibold text-green-900">
                  Correct Answer: {q.correct_answers?.map((a: any) => a.value || a).join(", ")}
                </p>
              </div>

              {/* Explanation */}
              {q.explanation && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-semibold text-blue-900 mb-1">Explanation:</p>
                  <p className="text-sm text-blue-800">{q.explanation}</p>
                </div>
              )}

              {/* Answer Image */}
              {q.has_answer_image && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Answer Image:</p>
                  <img
                    src={`https://s3.amazonaws.com/gretest1234/images/${q.answer_image_ref}`}
                    alt={`Answer ${idx + 1}`}
                    className="max-w-md rounded-lg border border-gray-300"
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>3

      {/* Pagination */}
      <div className="mt-8 flex items-center justify-center gap-2">
        <button
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-sm text-gray-600">Page {currentPage}</span>
        <button
          onClick={() => setCurrentPage(currentPage + 1)}
          disabled={questions.length < perPage}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
