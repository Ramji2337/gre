"use client";

import { useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";

interface QuestionFormModalProps {
  subject: string;
  editing: any | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}

const subjectConfig: Record<string, {
  questionTypes: { value: string; label: string }[];
  showOptions: boolean;
  showImage: boolean;
  showPassage: boolean;
  defaultAnswerFormat: string;
}> = {
  Quant: {
    questionTypes: [
      { value: "MULTIPLE_CHOICE_SINGLE", label: "Multiple Choice (Single Answer)" },
      { value: "MULTIPLE_CHOICE_MULTIPLE", label: "Multiple Choice (Multiple Answers)" },
      { value: "NUMERIC_ENTRY", label: "Numeric Entry" },
      { value: "FILL_IN_THE_BLANKS", label: "Fill in the Blanks" },
    ],
    showOptions: true,
    showImage: true,
    showPassage: false,
    defaultAnswerFormat: "SINGLE_CHOICE",
  },
  Verbal: {
    questionTypes: [
      { value: "MULTIPLE_CHOICE_SINGLE", label: "Multiple Choice (Single Answer)" },
      { value: "SENTENCE_EQUIVALENCE", label: "Sentence Equivalence" },
      { value: "TEXT_COMPLETION", label: "Text Completion" },
      { value: "READING_COMPREHENSION", label: "Reading Comprehension" },
    ],
    showOptions: true,
    showImage: false,
    showPassage: true,
    defaultAnswerFormat: "SINGLE_CHOICE",
  },
  AWA: {
    questionTypes: [
      { value: "AWA", label: "AWA Essay" },
    ],
    showOptions: false,
    showImage: false,
    showPassage: false,
    defaultAnswerFormat: "ESSAY",
  },
};

function getEmptyForm(subject: string) {
  const cfg = subjectConfig[subject] || subjectConfig.Quant;
  return {
    category: "",
    level: "Medium",
    question_type: cfg.questionTypes[0].value,
    answer_format: cfg.defaultAnswerFormat,
    question_text: "",
    passage: "",
    explanation: "",
    image_storage: "S3",
    image_name: "",
  };
}

export default function QuestionFormModal({ subject, editing, categories, onClose, onSaved }: QuestionFormModalProps) {
  const cfg = subjectConfig[subject] || subjectConfig.Quant;
  const [form, setForm] = useState<any>(
    editing
      ? {
          category: editing.category || "",
          level: editing.level || "Medium",
          question_type: editing.question_type || cfg.questionTypes[0].value,
          answer_format: editing.answer_format || cfg.defaultAnswerFormat,
          question_text: editing.question_text || "",
          passage: editing.passage || "",
          explanation: editing.explanation || "",
          image_storage: editing.image_storage || "S3",
          image_name: editing.images?.[0]?.image_name || "",
        }
      : getEmptyForm(subject)
  );
  const [options, setOptions] = useState<any[]>(
    editing?.options?.length
      ? editing.options
      : [{ label: "A", text: "" }, { label: "B", text: "" }, { label: "C", text: "" }, { label: "D", text: "" }]
  );
  const [correctAnswers, setCorrectAnswers] = useState<string[]>(
    editing?.correct_answers?.map((ca: any) => ca.option_label).filter(Boolean) || ["A"]
  );

  const isMultiAnswer = form.question_type === "MULTIPLE_CHOICE_MULTIPLE";

  const toggleCorrect = (label: string) => {
    if (isMultiAnswer) {
      setCorrectAnswers((prev) =>
        prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
      );
    } else {
      setCorrectAnswers([label]);
    }
  };
  const [saving, setSaving] = useState(false);

  const inputClass = "w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  const handleSave = async () => {
    if (!form.question_text) {
      toast.error("Question text is required");
      return;
    }
    setSaving(true);
    try {
      const images = form.image_name
        ? [{ type: "question", image_name: form.image_name, storage: "s3", caption: "" }]
        : (editing?.images || []);
      const correctAnswersPayload = cfg.showOptions
        ? correctAnswers.filter((l) => options.some((o) => o.label === l && o.text.trim())).map((label) => ({ value: label, format: "LABEL", option_label: label }))
        : (editing?.correct_answers || [{ value: "A", format: "LABEL", option_label: "A" }]);
      const payload = {
        ...form,
        subject,
        options: cfg.showOptions ? options.filter((o) => o.text.trim()) : (editing?.options || []),
        correct_answers: correctAnswersPayload,
        images,
      };

      if (editing) {
        await api.put(`/admin/questions/${editing._id}?subject=${subject}`, payload);
        toast.success("Question updated successfully");
      } else {
        await api.post("/admin/questions", payload);
        toast.success("Question created successfully");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-5 text-gray-900">
          {editing ? "Edit Question" : "Create Question"} — {subject}
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Category</label>
              <input type="text" value={form.category} list={`cat-list-${subject}`}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={inputClass} placeholder="Select or type new category" />
              <datalist id={`cat-list-${subject}`}>
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelClass}>Level</label>
              <select value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className={inputClass}>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Question Type</label>
              <select value={form.question_type}
                onChange={(e) => setForm({ ...form, question_type: e.target.value })}
                className={inputClass}>
                {cfg.questionTypes.map((qt) => (
                  <option key={qt.value} value={qt.value}>{qt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Question Text *</label>
            <textarea value={form.question_text} rows={4}
              onChange={(e) => setForm({ ...form, question_text: e.target.value })}
              className={inputClass} placeholder="Enter the question text..." />
          </div>

          {cfg.showPassage && (
            <div>
              <label className={labelClass}>Passage (optional)</label>
              <textarea value={form.passage} rows={3}
                onChange={(e) => setForm({ ...form, passage: e.target.value })}
                className={inputClass} placeholder="Reading passage if applicable..." />
            </div>
          )}

          {cfg.showOptions && (
            <>
              <div>
                <label className={labelClass}>Options</label>
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <span className="w-8 text-center font-bold text-gray-600">{opt.label}</span>
                      <input type="text" value={opt.text}
                        onChange={(e) => setOptions(options.map((o, j) => j === i ? { ...o, text: e.target.value } : o))}
                        className={inputClass} placeholder={`Option ${opt.label}`} />
                      {options.length > 2 && (
                        <button onClick={() => setOptions(options.filter((_, j) => j !== i))}
                          className="text-red-500 hover:text-red-700 px-2">✕</button>
                      )}
                    </div>
                  ))}
                  {options.length < 6 && (
                    <button onClick={() => setOptions([...options, { label: String.fromCharCode(65 + options.length), text: "" }])}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add Option</button>
                  )}
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Correct Answer{isMultiAnswer ? "s (select all that apply)" : ""}
                </label>
                {isMultiAnswer ? (
                  <div className="space-y-1.5">
                    {options.filter((o) => o.text.trim()).map((opt) => (
                      <label key={opt.label} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded-lg">
                        <input type="checkbox" checked={correctAnswers.includes(opt.label)}
                          onChange={() => toggleCorrect(opt.label)}
                          className="w-4 h-4 accent-blue-600" />
                        <span className="font-bold text-gray-700 w-6">{opt.label}</span>
                        <span className="text-sm text-gray-600 truncate">{opt.text}</span>
                      </label>
                    ))}
                    {correctAnswers.length === 0 && (
                      <p className="text-xs text-red-500">Select at least one correct answer</p>
                    )}
                  </div>
                ) : (
                  <select value={correctAnswers[0] || "A"}
                    onChange={(e) => toggleCorrect(e.target.value)}
                    className={inputClass}>
                    {options.filter((o) => o.text.trim()).map((opt) => (
                      <option key={opt.label} value={opt.label}>{opt.label} — {opt.text.slice(0, 40)}</option>
                    ))}
                  </select>
                )}
              </div>
            </>
          )}

          <div>
            <label className={labelClass}>Explanation</label>
            <textarea value={form.explanation} rows={3}
              onChange={(e) => setForm({ ...form, explanation: e.target.value })}
              className={inputClass} placeholder="Explanation for the answer..." />
          </div>

          {cfg.showImage && (
            <div>
              <label className={labelClass}>Image Name (MinIO)</label>
              <input type="text" value={form.image_name}
                onChange={(e) => setForm({ ...form, image_name: e.target.value })}
                className={inputClass}
                placeholder="e.g. triangle_6_8.png — upload image to MinIO manually" />
              <p className="text-xs text-gray-400 mt-1">
                Put the image filename here. Upload the actual image to MinIO bucket "gretestimages" manually.
                URL pattern: https://kprcloud-storage.cloudlab.works/gretestimages/&lt;filename&gt;
              </p>
            </div>
          )}

          {editing?.images?.length > 0 && !cfg.showImage && (
            <div>
              <label className={labelClass}>Existing Images</label>
              <div className="flex flex-wrap gap-2">
                {editing.images.map((img: any, i: number) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-2 bg-gray-50">
                    {img.image_name?.startsWith("data:") || img.image_name?.startsWith("http") ? (
                      <img src={img.image_name} alt={img.caption || ""} className="max-w-32 max-h-32 rounded" />
                    ) : (
                      <span className="text-xs text-gray-500">{img.image_name}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Saving..." : editing ? "Update Question" : "Create Question"}
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-100">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
