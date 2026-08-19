"use client";

import { useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

interface QuestionBulkUploadModalProps {
  subject: string;
  onClose: () => void;
  onDone: () => void;
}

export default function QuestionBulkUploadModal({ subject, onClose, onDone }: QuestionBulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [updateMode, setUpdateMode] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select an Excel file");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("subject", subject);
      if (updateMode) formData.append("update_mode", "true");
      const res = await api.post("/admin/questions/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data.summary);
      toast.success(`Done: ${res.data.summary.created} ${updateMode ? "updated" : "created"}, ${res.data.summary.skipped} skipped, ${res.data.summary.failed} failed`);
      onDone();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const templates: Record<string, { headers: string[]; rows: string[][]; instructions: string[][] }> = {
      Quant: {
        headers: [
          "Category", "Level", "Question Type", "Question Text", "Passage",
          "Option A", "Option B", "Option C", "Option D", "Option E", "Option F",
          "Correct Answer", "Explanation", "Question Images", "Answer Images",
        ],
        rows: [
          ["Percent", "Medium", "MULTIPLE_CHOICE_SINGLE", "If a shirt price increases from $40 to $50, what is the percentage increase?", "", "10%", "20%", "25%", "30%", "", "", "C", "Increase = 10. Percentage = (10/40)*100% = 25%.", "", ""],
          ["Algebra & Functions", "Hard", "MULTIPLE_CHOICE_MULTIPLE", "Which of the following values of x satisfy x^2 - 5x + 6 = 0?", "", "1", "2", "3", "4", "5", "6", "B,C", "x^2-5x+6=(x-2)(x-3)=0, so x=2 or x=3.", "", ""],
          ["2D Geometry", "Easy", "MULTIPLE_CHOICE_SINGLE", "A right triangle has legs of length 6 and 8. What is the hypotenuse?", "", "8", "10", "12", "14", "", "", "B", "6^2+8^2=100, sqrt(100)=10.", "triangle_6_8", ""],
          ["Average", "Easy", "NUMERIC_ENTRY", "What is the average of 10, 20, and 30?", "", "", "", "", "", "", "", "20", "(10+20+30)/3=20", "", ""],
          ["Data Analysis", "Hard", "MULTIPLE_CHOICE_MULTIPLE", "Which statements are true about the charts?", "", "Sales increased in Q1", "Sales decreased in Q2", "Revenue peaked in Q3", "Costs remained flat", "", "", "A,C", "Sales increased in Q1 and revenue peaked in Q3.", "chart_sales,chart_revenue", "chart_solution"],
        ],
        instructions: [
          ["Quant Template — Instructions"],
          [""],
          ["Question Types", "MULTIPLE_CHOICE_SINGLE, MULTIPLE_CHOICE_MULTIPLE, NUMERIC_ENTRY, FILL_IN_THE_BLANKS"],
          ["Correct Answer", "Single: one letter (e.g. C). Multiple: comma-separated (e.g. B,C). Numeric: the value (e.g. 20)"],
          ["Question Images", "Comma-separated image names without extension (e.g. triangle_6_8 or img1,img2). .png auto-added."],
          ["Answer Images", "Comma-separated image names without extension. .png auto-added."],
        ],
      },
      Verbal: {
        headers: [
          "Category", "Level", "Question Type", "Question Text", "Passage",
          "Option A", "Option B", "Option C", "Option D", "Option E", "Option F",
          "Correct Answer", "Explanation", "Question Images", "Answer Images",
        ],
        rows: [
          ["Sentence Equivalence", "Medium", "SENTENCE_EQUIVALENCE", "Despite the ____ weather, the team completed the hike.", "", "inclement", "beautiful", "stormy", "mild", "", "", "A,C", "'Despite' indicates negative weather. Both 'inclement' and 'stormy' fit.", "", ""],
          ["Text Completion", "Hard", "TEXT_COMPLETION", "The professor's lecture was so ____ that most students left early.", "", "engaging", "tedious", "brief", "informative", "", "", "B", "'So...that students left early' implies something boring = tedious.", "", ""],
          ["Reading Comprehension", "Medium", "READING_COMPREHENSION", "What is the main idea of the passage?", "The passage discusses the impact of industrialization on rural communities...", "Economic growth", "Cultural decline", "Social transformation", "Environmental damage", "", "", "C", "The passage focuses on how industrialization transformed rural society.", "", ""],
          ["Reading Comprehension", "Hard", "MULTIPLE_CHOICE_MULTIPLE", "Which of the following are supported by the passage?", "Recent studies show that urban green spaces improve mental health...", "Green spaces reduce stress", "Urban areas have more pollution", "Trees improve air quality", "All cities need more parks", "", "", "A,C", "The passage supports stress reduction and air quality improvement.", "", ""],
        ],
        instructions: [
          ["Verbal Template — Instructions"],
          [""],
          ["Question Types", "MULTIPLE_CHOICE_SINGLE, SENTENCE_EQUIVALENCE, TEXT_COMPLETION, READING_COMPREHENSION"],
          ["Passage", "Required for READING_COMPREHENSION questions. Optional for others."],
          ["Correct Answer", "Single: one letter (e.g. B). Multiple: comma-separated (e.g. A,C). Sentence Equivalence: two letters (e.g. A,C)"],
          ["Question Images", "Comma-separated image names without extension. .png auto-added. Usually not needed for Verbal."],
          ["Answer Images", "Comma-separated image names without extension. .png auto-added."],
        ],
      },
      AWA: {
        headers: [
          "Category", "Level", "Question Type", "Question Text", "Passage",
          "Option A", "Option B", "Option C", "Option D", "Option E", "Option F",
          "Correct Answer", "Explanation", "Question Images", "Answer Images",
        ],
        rows: [
          ["Issue Essay", "Medium", "AWA", "\"Technology has made our lives more complex, not simpler.\" Discuss the extent to which you agree or disagree.", "", "", "", "", "", "", "", "", "Write a 500-word essay analyzing the issue. Support your position with relevant examples.", "", ""],
          ["Argument Essay", "Hard", "AWA", "The following appeared in a memo: \"Our competitor's sales increased after they switched to online-only retail. We should do the same.\" Discuss the flawed reasoning.", "", "", "", "", "", "", "", "", "Analyze the argument's assumptions, evidence, and conclusion. Identify logical flaws.", "", ""],
        ],
        instructions: [
          ["AWA Template — Instructions"],
          [""],
          ["Question Type", "AWA (essay questions only)"],
          ["Correct Answer", "Leave blank for AWA — essays are manually graded."],
          ["Explanation", "Put the essay grading rubric or model answer here."],
          ["Options", "Leave all option columns blank for AWA."],
          ["Images", "Usually not needed for AWA. Can include diagrams if relevant."],
        ],
      },
    };

    const tpl = templates[subject] || templates.Quant;
    const csv = [
      tpl.headers.join(","),
      ...tpl.rows.map((r) => r.map((c) => `"${c}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${subject.toLowerCase()}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColors: Record<string, string> = {
    created: "text-green-600 bg-green-50",
    updated: "text-blue-600 bg-blue-50",
    skipped: "text-yellow-600 bg-yellow-50",
    failed: "text-red-600 bg-red-50",
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-2 text-gray-900">Bulk Upload Questions — {subject}</h3>
        <p className="text-sm text-gray-500 mb-5">
          Upload an Excel/CSV file with questions for <b>{subject}</b>. {updateMode ? "Existing questions (matched by text) will be UPDATED with new image names and fields." : "Duplicate questions (matched by question text) will be skipped."}
          For images, put the image name (no extension needed, .png auto-added) in the "Question Images" or "Answer Images" column — upload the actual image to MinIO manually.
        </p>

        {/* Update mode toggle */}
        <div className="mb-4 flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          <input
            type="checkbox"
            id="update-mode"
            checked={updateMode}
            onChange={(e) => setUpdateMode(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="update-mode" className="text-sm text-gray-700 cursor-pointer">
            <b>Update Mode</b> — Update existing questions (matched by question text) with new image names, explanation, category, and level instead of skipping them.
          </label>
        </div>

        {/* Template download */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
          <span className="text-sm text-blue-700">Need a template? Download a sample CSV with the correct columns.</span>
          <button onClick={downloadTemplate}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700">
            Download Template
          </button>
        </div>

        {/* File input */}
        {!result && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <input type="file" accept=".xlsx,.xls,.csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden" id="question-bulk-file" />
              <label htmlFor="question-bulk-file" className="cursor-pointer">
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-gray-600 font-medium">
                  {file ? file.name : "Click to select Excel/CSV file"}
                </p>
                <p className="text-xs text-gray-400 mt-1">Supports .xlsx, .xls, .csv</p>
              </label>
            </div>

            <div className="flex gap-3">
              <button onClick={handleUpload} disabled={uploading || !file}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">
                {uploading ? "Uploading..." : "Upload & Process"}
              </button>
              <button onClick={onClose}
                className="px-4 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-100">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-800">{result.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{result.created}</p>
                <p className="text-xs text-green-600">{updateMode ? "Updated" : "Created"}</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
                <p className="text-xs text-yellow-600">Skipped</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                <p className="text-xs text-red-600">Failed</p>
              </div>
            </div>

            {result.results?.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Row</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Question</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((r: any, i: number) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-3 py-2 text-gray-500">{r.row}</td>
                        <td className="px-3 py-2 text-gray-800 max-w-xs truncate">{r.question}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[r.status] || "bg-gray-100 text-gray-600"}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{r.reason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setResult(null); setFile(null); }}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-bold hover:bg-gray-200">
                Upload Another
              </button>
              <button onClick={onClose}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
