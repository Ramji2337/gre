"use client";

import { useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import SearchableCategoryDropdown from "./SearchableCategoryDropdown";

interface QuestionFormProps {
  subject: string;
  editing: any | null;
  categories: string[];
  onCancel: () => void;
  onSaved: () => void;
}

const subjectConfig: Record<
  string,
  {
    questionTypes: { value: string; label: string }[];
    showOptions: boolean;
    showImage: boolean;
    showPassage: boolean;
    defaultAnswerFormat: string;
  }
> = {
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
    showImage: true,
    showPassage: true,
    defaultAnswerFormat: "SINGLE_CHOICE",
  },
  AWA: {
    questionTypes: [{ value: "AWA", label: "AWA Essay" }],
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
  };
}

export default function QuestionForm({
  subject,
  editing,
  categories,
  onCancel,
  onSaved,
}: QuestionFormProps) {
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
        }
      : getEmptyForm(subject)
  );
  const [options, setOptions] = useState<any[]>(
    editing?.options?.length
      ? editing.options
      : [
          { label: "A", text: "" },
          { label: "B", text: "" },
          { label: "C", text: "" },
          { label: "D", text: "" },
        ]
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

  const [hasQuestionImage, setHasQuestionImage] = useState(
    editing?.images?.some((img: any) => img.type === "question") || false
  );
  const [questionImageNames, setQuestionImageNames] = useState<string[]>(
    editing?.images?.filter((img: any) => img.type === "question")?.map((img: any) => {
      const n = img.image_name || "";
      if (n.startsWith("http")) return decodeURIComponent(n.split("/").pop()?.split("?")[0] || n);
      if (n.startsWith("data:")) return n;
      return n;
    }) || [""]
  );

  const [hasAnswerImage, setHasAnswerImage] = useState(
    editing?.images?.some((img: any) => img.type === "answer") || false
  );
  const [answerImageNames, setAnswerImageNames] = useState<string[]>(
    editing?.images?.filter((img: any) => img.type === "answer")?.map((img: any) => {
      const n = img.image_name || "";
      if (n.startsWith("http")) return decodeURIComponent(n.split("/").pop()?.split("?")[0] || n);
      if (n.startsWith("data:")) return n;
      return n;
    }) || [""]
  );

  const [uploadingIdx, setUploadingIdx] = useState<{ type: "question" | "answer"; idx: number } | null>(null);

  const handleImageUpload = async (file: File, type: "question" | "answer", idx: number) => {
    setUploadingIdx({ type, idx });
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const filename = file.name.replace(/\.[^.]+$/, "");
        try {
          const res = await api.post("/admin/questions/upload-image", {
            image: base64,
            filename: file.name,
          });
          const objectName: string = res.data.object_name;
          const storedName = objectName.replace(/\.[^.]+$/, "");
          if (type === "question") {
            setQuestionImageNames((prev) => prev.map((n, j) => (j === idx ? storedName : n)));
          } else {
            setAnswerImageNames((prev) => prev.map((n, j) => (j === idx ? storedName : n)));
          }
          toast.success("Image uploaded to MinIO successfully");
        } catch (err: any) {
          toast.error(err.response?.data?.error || "Upload failed");
        }
        setUploadingIdx(null);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error("Failed to read file");
      setUploadingIdx(null);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  const handleSave = async () => {
    if (!form.question_text) {
      toast.error("Question text is required");
      return;
    }
    if (hasQuestionImage && !questionImageNames.some((n) => n.trim())) {
      toast.error("Question Images is toggled ON but no image names are filled. Either fill in image names or toggle it OFF.");
      return;
    }
    if (hasAnswerImage && !answerImageNames.some((n) => n.trim())) {
      toast.error("Answer Images is toggled ON but no image names are filled. Either fill in image names or toggle it OFF.");
      return;
    }
    setSaving(true);
    try {
      const images: any[] = [];

      if (hasQuestionImage) {
        questionImageNames.filter((n) => n.trim()).forEach((name) => {
          const storage = name.startsWith("data:") ? "inline" : "s3";
          images.push({ type: "question", image_name: name.trim(), storage, caption: "" });
        });
      }
      if (hasAnswerImage) {
        answerImageNames.filter((n) => n.trim()).forEach((name) => {
          const storage = name.startsWith("data:") ? "inline" : "s3";
          images.push({ type: "answer", image_name: name.trim(), storage, caption: "" });
        });
      }

      if (images.length === 0 && editing?.images?.length > 0 && !hasQuestionImage && !hasAnswerImage) {
        images.push(...editing.images);
      }

      const correctAnswersPayload = cfg.showOptions
        ? correctAnswers
            .filter((l) => options.some((o) => o.label === l && o.text.trim()))
            .map((label) => ({ value: label, format: "LABEL", option_label: label }))
        : editing?.correct_answers || [{ value: "A", format: "LABEL", option_label: "A" }];

      const payload = {
        ...form,
        subject,
        options: cfg.showOptions ? options.filter((o) => o.text.trim()) : editing?.options || [],
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
      onCancel();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">
          {editing ? "Edit Question" : "Create Question"} — {subject}
        </h3>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 p-1"
          title="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="space-y-5">
        {/* Row 1: Category, Level, Question Type */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Category</label>
            <SearchableCategoryDropdown
              value={form.category}
              options={categories}
              onChange={(val) => setForm({ ...form, category: val })}
              placeholder="Select or type new category"
            />
          </div>
          <div>
            <label className={labelClass}>Difficulty</label>
            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
              className={inputClass}
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Question Type</label>
            <select
              value={form.question_type}
              onChange={(e) => setForm({ ...form, question_type: e.target.value })}
              className={inputClass}
            >
              {cfg.questionTypes.map((qt) => (
                <option key={qt.value} value={qt.value}>
                  {qt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Question Text */}
        <div>
          <label className={labelClass}>Question Text *</label>
          <textarea
            value={form.question_text}
            rows={4}
            onChange={(e) => setForm({ ...form, question_text: e.target.value })}
            className={inputClass}
            placeholder="Enter the question text..."
          />
        </div>

        {/* Row 3: Passage (Verbal only) */}
        {cfg.showPassage && (
          <div>
            <label className={labelClass}>Passage (optional)</label>
            <textarea
              value={form.passage}
              rows={3}
              onChange={(e) => setForm({ ...form, passage: e.target.value })}
              className={inputClass}
              placeholder="Reading passage if applicable..."
            />
          </div>
        )}

        {/* Row 4: Options */}
        {cfg.showOptions && (
          <>
            <div>
              <label className={labelClass}>Options</label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <span className="w-8 text-center font-bold text-gray-600">{opt.label}</span>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) =>
                        setOptions(
                          options.map((o, j) => (j === i ? { ...o, text: e.target.value } : o))
                        )
                      }
                      className={inputClass}
                      placeholder={`Option ${opt.label}`}
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => setOptions(options.filter((_, j) => j !== i))}
                        className="text-red-500 hover:text-red-700 px-2"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {options.length < 6 && (
                  <button
                    onClick={() =>
                      setOptions([
                        ...options,
                        { label: String.fromCharCode(65 + options.length), text: "" },
                      ])
                    }
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    + Add Option
                  </button>
                )}
              </div>
            </div>

            {/* Row 5: Correct Answer(s) */}
            <div>
              <label className={labelClass}>
                Correct Answer{isMultiAnswer ? "s (select all that apply)" : ""}
              </label>
              {isMultiAnswer ? (
                <div className="space-y-1.5">
                  {options
                    .filter((o) => o.text.trim())
                    .map((opt) => (
                      <label
                        key={opt.label}
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded-lg"
                      >
                        <input
                          type="checkbox"
                          checked={correctAnswers.includes(opt.label)}
                          onChange={() => toggleCorrect(opt.label)}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <span className="font-bold text-gray-700 w-6">{opt.label}</span>
                        <span className="text-sm text-gray-600 truncate">{opt.text}</span>
                      </label>
                    ))}
                  {correctAnswers.length === 0 && (
                    <p className="text-xs text-red-500">Select at least one correct answer</p>
                  )}
                </div>
              ) : (
                <select
                  value={correctAnswers[0] || "A"}
                  onChange={(e) => toggleCorrect(e.target.value)}
                  className={inputClass}
                >
                  {options
                    .filter((o) => o.text.trim())
                    .map((opt) => (
                      <option key={opt.label} value={opt.label}>
                        {opt.label} — {opt.text.slice(0, 40)}
                      </option>
                    ))}
                </select>
              )}
            </div>
          </>
        )}

        {/* Row 6: Explanation */}
        <div>
          <label className={labelClass}>Explanation</label>
          <textarea
            value={form.explanation}
            rows={3}
            onChange={(e) => setForm({ ...form, explanation: e.target.value })}
            className={inputClass}
            placeholder="Explanation for the answer..."
          />
        </div>

        {/* Row 7: Question Images Toggle */}
        {cfg.showImage && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Question Images
              </label>
              <button
                onClick={() => {
                  setHasQuestionImage(!hasQuestionImage);
                  if (!hasQuestionImage) setQuestionImageNames([""]);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  hasQuestionImage ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    hasQuestionImage ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {hasQuestionImage && (
              <div className="space-y-3">
                {questionImageNames.map((name, i) => {
                  const isHttp = name.startsWith("http");
                  const isData = name.startsWith("data:");
                  const isUrl = isHttp || isData;
                  const displayName = isHttp ? decodeURIComponent(name.split("/").pop()?.split("?")[0] || name) : isData ? "(Inline SVG)" : name;
                  const spaceName = displayName.replace(/_/g, " ");
                  const previewUrl = isUrl ? name : (editing?.images?.find((img: any) => {
                    const n = img.image_name || "";
                    if (n.startsWith("http")) {
                      const extracted = decodeURIComponent(n.split("/").pop()?.split("?")[0] || "");
                      return extracted === displayName || extracted === spaceName;
                    }
                    return n === name;
                  })?.image_name) || "";
                  return (
                    <div key={i} className="flex gap-3 items-start border border-gray-200 rounded-lg p-2 bg-white">
                      {/* Image preview */}
                      {previewUrl ? (
                        <img src={previewUrl} alt={displayName} className="w-20 h-20 object-contain rounded border border-gray-200 shrink-0" />
                      ) : name ? (
                        <div className="w-20 h-20 flex items-center justify-center bg-gray-100 rounded border border-gray-200 shrink-0 text-xs text-gray-400 text-center p-1">No preview</div>
                      ) : (
                        <div className="w-20 h-20 flex items-center justify-center bg-gray-50 rounded border border-dashed border-gray-300 shrink-0 text-xs text-gray-400">Empty</div>
                      )}
                      {/* Input + buttons */}
                      <div className="flex-1 space-y-1">
                        {isData ? (
                          <input
                            type="text"
                            disabled
                            value="(inline SVG — replace with S3 image if needed)"
                            className={inputClass + " bg-gray-100 text-gray-500"}
                          />
                        ) : (
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) =>
                              setQuestionImageNames(
                                questionImageNames.map((n, j) => (j === i ? e.target.value : n))
                              )
                            }
                            className={inputClass}
                            placeholder={`Image ${i + 1} name (e.g. triangle_6_8)`}
                          />
                        )}
                        <div className="flex gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            id={`qimg-upload-${i}`}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleImageUpload(f, "question", i);
                            }}
                          />
                          <label
                            htmlFor={`qimg-upload-${i}`}
                            className="cursor-pointer bg-green-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-green-700"
                          >
                            {uploadingIdx?.type === "question" && uploadingIdx.idx === i ? "Uploading..." : "Replace"}
                          </label>
                          <button
                            onClick={() =>
                              setQuestionImageNames(questionImageNames.filter((_, j) => j !== i))
                            }
                            className="bg-red-50 text-red-600 px-2 py-1 rounded text-xs font-medium hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={() => setQuestionImageNames([...questionImageNames, ""])}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Add Another Image
                </button>
                <p className="text-xs text-gray-400 mt-1">
                  Enter image name OR click Replace to upload a new image to MinIO.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Row 8: Answer Images Toggle */}
        {cfg.showImage && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Answer Images
              </label>
              <button
                onClick={() => {
                  setHasAnswerImage(!hasAnswerImage);
                  if (!hasAnswerImage) setAnswerImageNames([""]);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  hasAnswerImage ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    hasAnswerImage ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {hasAnswerImage && (
              <div className="space-y-3">
                {answerImageNames.map((name, i) => {
                  const isHttp = name.startsWith("http");
                  const isData = name.startsWith("data:");
                  const isUrl = isHttp || isData;
                  const displayName = isHttp ? decodeURIComponent(name.split("/").pop()?.split("?")[0] || name) : isData ? "(Inline SVG)" : name;
                  const spaceName = displayName.replace(/_/g, " ");
                  const previewUrl = isUrl ? name : (editing?.images?.find((img: any) => {
                    const n = img.image_name || "";
                    if (n.startsWith("http")) {
                      const extracted = decodeURIComponent(n.split("/").pop()?.split("?")[0] || "");
                      return extracted === displayName || extracted === spaceName;
                    }
                    return n === name;
                  })?.image_name) || "";
                  return (
                    <div key={i} className="flex gap-3 items-start border border-gray-200 rounded-lg p-2 bg-white">
                      {/* Image preview */}
                      {previewUrl ? (
                        <img src={previewUrl} alt={displayName} className="w-20 h-20 object-contain rounded border border-gray-200 shrink-0" />
                      ) : name ? (
                        <div className="w-20 h-20 flex items-center justify-center bg-gray-100 rounded border border-gray-200 shrink-0 text-xs text-gray-400 text-center p-1">No preview</div>
                      ) : (
                        <div className="w-20 h-20 flex items-center justify-center bg-gray-50 rounded border border-dashed border-gray-300 shrink-0 text-xs text-gray-400">Empty</div>
                      )}
                      {/* Input + buttons */}
                      <div className="flex-1 space-y-1">
                        {isData ? (
                          <input
                            type="text"
                            disabled
                            value="(inline SVG — replace with S3 image if needed)"
                            className={inputClass + " bg-gray-100 text-gray-500"}
                          />
                        ) : (
                          <input
                            type="text"
                            value={displayName}
                            onChange={(e) =>
                              setAnswerImageNames(
                                answerImageNames.map((n, j) => (j === i ? e.target.value : n))
                              )
                            }
                            className={inputClass}
                            placeholder={`Answer image ${i + 1} name (e.g. solution_diagram)`}
                          />
                        )}
                        <div className="flex gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            id={`aimg-upload-${i}`}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleImageUpload(f, "answer", i);
                            }}
                          />
                          <label
                            htmlFor={`aimg-upload-${i}`}
                            className="cursor-pointer bg-green-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-green-700"
                          >
                            {uploadingIdx?.type === "answer" && uploadingIdx.idx === i ? "Uploading..." : "Replace"}
                          </label>
                          <button
                            onClick={() =>
                              setAnswerImageNames(answerImageNames.filter((_, j) => j !== i))
                            }
                            className="bg-red-50 text-red-600 px-2 py-1 rounded text-xs font-medium hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={() => setAnswerImageNames([...answerImageNames, ""])}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  + Add Another Image
                </button>
                <p className="text-xs text-gray-400 mt-1">
                  Answer explanation images. Enter name OR click Replace to upload.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Existing images (when editing, for subjects without image toggle) */}
        {editing?.images?.length > 0 && !cfg.showImage && (
          <div>
            <label className={labelClass}>Existing Images</label>
            <div className="flex flex-wrap gap-2">
              {editing.images.map((img: any, i: number) => (
                <div
                  key={i}
                  className="border border-gray-200 rounded-lg p-2 bg-gray-50"
                >
                  {img.image_name?.startsWith("data:") ||
                  img.image_name?.startsWith("http") ? (
                    <img
                      src={img.image_name}
                      alt={img.caption || ""}
                      className="max-w-32 max-h-32 rounded"
                    />
                  ) : (
                    <span className="text-xs text-gray-500">{img.image_name}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : editing ? "Update Question" : "Create Question"}
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 font-bold hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
