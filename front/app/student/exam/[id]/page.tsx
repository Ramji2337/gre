"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";

interface QuestionOption {
  label: string;
  text: string;
}

interface Question {
  _id: string;
  question_id: string;
  subject: string;
  category: string;
  level: string;
  question_type: string;
  answer_format: string;
  is_multi_answer: boolean;
  question_text: string;
  passage: string;
  options: QuestionOption[];
  images: any[];
  saved_answer?: string;
}

interface ExamSection {
  name: string;
  subject: string;
  difficulty: string;
  duration_mins: number;
  question_ids: string[];
  is_selected: boolean;
  selected_module: string;
  selected_difficulty: string;
  submitted_at: string | null;
  started_at?: string | null;
  score: number;
  total_questions: number;
  questions: Question[];
}

interface ExamData {
  allocation_id: string;
  test_id: string;
  test_type: string;
  test_title: string;
  status: string;
  sections: ExamSection[];
}

type Phase = "loading" | "instructions" | "exam" | "section-transition" | "submitted" | "terminated";

const MAX_VIOLATIONS = 7;

/* ---------- Icon set (professional, stroke-based, no emoji) ---------- */
const Icon = {
  Eye: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  EyeOff: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ),
  HelpCircle: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Grid: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  Fullscreen: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  ),
  Ban: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M5.5 5.5l13 13" />
    </svg>
  ),
  Clock: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
    </svg>
  ),
  Flag: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V4m0 0h11l-2 4 2 4H5" />
    </svg>
  ),
  Calculator: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 11h1M12 11h1M16 11h1M8 15h1M12 15h1M16 15h1M8 19h1M12 19h1M16 19h1" />
    </svg>
  ),
  Shield: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" />
    </svg>
  ),
  AlertTriangle: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l9 16H3L12 3z" /><path d="M12 10v4M12 17.5h.01" />
    </svg>
  ),
  Bolt: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  ),
  CheckCircle: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5.5" />
    </svg>
  ),
  XCircle: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  ),
  Lock: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  ),
  ClipboardCheck: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M9 12l2 2 4-4" />
    </svg>
  ),
  Close: (p: { className?: string }) => (
    <svg className={p.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
};

export default function ExamPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const allocationId = params.id as string;

  const [phase, setPhase] = useState<Phase>("loading");
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [error, setError] = useState("");
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [sectionTimer, setSectionTimer] = useState(0);
  const INSTRUCTION_DURATION = 120;
  const instrKey = `instr_start_${allocationId}`;
  const [instructionTimer, setInstructionTimer] = useState(() => {
    if (typeof window === "undefined") return INSTRUCTION_DURATION;
    try {
      const stored = localStorage.getItem(instrKey);
      if (stored) {
        const elapsed = Math.floor((Date.now() - parseInt(stored)) / 1000);
        const remaining = INSTRUCTION_DURATION - elapsed;
        return remaining > 0 ? remaining : 0;
      }
    } catch {}
    return INSTRUCTION_DURATION;
  });
  const [hideTimer, setHideTimer] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [transitionMsg, setTransitionMsg] = useState("");
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  const [lastViolation, setLastViolation] = useState<{ type: string; label: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const instrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTerminatedRef = useRef(false);
  const lastViolationTimeRef = useRef<number>(0);

  const VIOLATION_LABELS: Record<string, string> = {
    FULLSCREEN_EXIT: "Full-Screen Exit Detected",
    TAB_SWITCH: "Tab Switch Detected",
    WINDOW_BLUR: "Window Focus Lost",
    COPY_PASTE: "Copy / Paste Blocked",
    DEV_TOOLS_OPEN: "Developer Tools Blocked",
  };

  const logViolation = useCallback(
    (type: string, details: string, severity: "low" | "medium" | "high" = "medium") => {
      if (isTerminatedRef.current) return;

      // Cooldown check: prevent duplicate logs within 1.5 seconds (e.g. blur + visibilitychange firing together)
      const now = Date.now();
      if (now - lastViolationTimeRef.current < 1500) return;
      lastViolationTimeRef.current = now;

      api
        .post(`/student/tests/${allocationId}/violation`, { violation_type: type, details, severity })
        .then((res) => {
          const count = res.data.violation_count ?? 0;
          setViolationCount(count);
          setLastViolation({ type, label: VIOLATION_LABELS[type] || type });
          if (res.data.terminated) {
            isTerminatedRef.current = true;
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            setPhase("terminated");
          }
        })
        .catch(() => {});
    },
    [allocationId]
  );

  // BeforeUnload warning during active exam
  useEffect(() => {
    if (phase !== "exam") return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Your exam is currently in progress. Leaving this page will NOT pause your timer!";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [phase]);

  // Start test and fetch questions with session timer restoration
  useEffect(() => {
    api
      .post(`/student/tests/${allocationId}/start`)
      .then(() => api.get(`/student/tests/${allocationId}/questions`))
      .then((res) => {
        const data = res.data as ExamData;
        if (!data.sections || data.sections.length === 0) {
          setError("No sections found in this test.");
          return;
        }
        setExamData(data);
        const firstUnsubmitted = data.sections.findIndex((s) => !s.submitted_at);
        const startIdx = firstUnsubmitted >= 0 ? firstUnsubmitted : 0;
        setCurrentSectionIdx(startIdx);

        const activeSec = data.sections[startIdx];
        const savedAnswers: Record<string, string> = {};
        data.sections.forEach((s) =>
          s.questions?.forEach((q) => {
            if (q.saved_answer) savedAnswers[q.question_id] = q.saved_answer;
          })
        );
        setAnswers(savedAnswers);

        // Timer restoration: If section was already started, restore timer and jump to exam phase directly!
        if (activeSec && activeSec.started_at) {
          const startedAtMs = new Date(activeSec.started_at).getTime();
          const elapsedSecs = Math.floor((Date.now() - startedAtMs) / 1000);
          const totalSecs = activeSec.duration_mins * 60;
          const remainingSecs = Math.max(0, totalSecs - elapsedSecs);
          setSectionTimer(remainingSecs);
          setPhase("exam");
        } else if (activeSec) {
          setSectionTimer(activeSec.duration_mins * 60);
          setPhase("instructions");
        }
      })
      .catch((err) => {
        const msg = err.response?.data?.error || "Failed to start test";
        setError(msg);
      });
  }, [allocationId]);

  // Instruction countdown (120s) — auto-starts exam when timer hits 0
  // Persists start time in localStorage so refresh doesn't reset the timer
  useEffect(() => {
    if (phase !== "instructions") return;
    try {
      if (!localStorage.getItem(instrKey)) {
        localStorage.setItem(instrKey, String(Date.now()));
      }
    } catch {}
    instrTimerRef.current = setInterval(() => {
      setInstructionTimer((t) => {
        if (t <= 1) {
          clearInterval(instrTimerRef.current!);
          try { localStorage.removeItem(instrKey); } catch {}
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (instrTimerRef.current) clearInterval(instrTimerRef.current);
    };
  }, [phase, instrKey]);

  // Auto-start exam when instruction timer reaches 0
  useEffect(() => {
    if (phase === "instructions" && instructionTimer === 0) {
      startExam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, instructionTimer]);

  // Section timer
  useEffect(() => {
    if (phase !== "exam") return;
    timerRef.current = setInterval(() => {
      setSectionTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleSectionSubmit(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentSectionIdx]);

  // Anti-cheat: fullscreen, tab-switch, blur, copy-paste, dev tools
  // Only active during exam phase (not instructions) to avoid spurious violations on load
  const gracePeriodRef = useRef(true);
  const wasInFullscreenRef = useRef(false);

  useEffect(() => {
    if (phase !== "exam") return;
    gracePeriodRef.current = true;
    const graceTimer = setTimeout(() => { gracePeriodRef.current = false; }, 6000);

    if (document.fullscreenElement) {
      wasInFullscreenRef.current = true;
      setFullscreenWarning(false);
    } else {
      // Prompt user to enter fullscreen without immediate violation penalty on load
      setFullscreenWarning(true);
    }

    const handleVisibilityChange = () => {
      if (gracePeriodRef.current) return;
      if (document.hidden) logViolation("TAB_SWITCH", "Student switched away from the exam tab");
    };

    const handleBlur = () => {
      if (gracePeriodRef.current) return;
      logViolation("WINDOW_BLUR", "Exam window lost focus");
    };

    const handleContextmenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      if (!gracePeriodRef.current) logViolation("COPY_PASTE", `Blocked ${e.type} event`);
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        wasInFullscreenRef.current = true;
        setFullscreenWarning(false);
      } else {
        setFullscreenWarning(true);
        if (!gracePeriodRef.current && wasInFullscreenRef.current) {
          logViolation("FULLSCREEN_EXIT", "Student exited fullscreen mode");
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isDevToolsCombo =
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) ||
        (e.metaKey && e.altKey && e.key.toUpperCase() === "I");
      if (isDevToolsCombo) {
        e.preventDefault();
        if (!gracePeriodRef.current) logViolation("DEV_TOOLS_OPEN", `Blocked shortcut: ${e.key}`, "high");
        return;
      }
      const isCopyPasteCombo =
        (e.ctrlKey || e.metaKey) && ["c", "v", "x"].includes(e.key.toLowerCase());
      if (isCopyPasteCombo) {
        e.preventDefault();
        if (!gracePeriodRef.current) logViolation("COPY_PASTE", `Blocked keyboard shortcut: Ctrl/Cmd+${e.key.toUpperCase()}`);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("contextmenu", handleContextmenu);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);
    document.addEventListener("cut", handleCopyPaste);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(graceTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("contextmenu", handleContextmenu);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
      document.removeEventListener("cut", handleCopyPaste);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [phase, logViolation]);

  const enterFullscreen = () => {
    document.documentElement.requestFullscreen().catch(() => {});
  };

  const startExam = () => {
    try { localStorage.removeItem(instrKey); } catch {}
    enterFullscreen();
    api.post(`/student/tests/${allocationId}/start-section`, { section_index: currentSectionIdx }).catch(() => {});
    setPhase("exam");
  };

  const reenterFullscreen = () => {
    enterFullscreen();
  };

  const currentSection = examData?.sections[currentSectionIdx];
  const currentQuestion = currentSection?.questions[currentQIdx];

  const saveAnswerToServer = useCallback(
    (questionId: string, answer: string, sectionIndex: number) => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(() => {
        api
          .post(`/student/tests/${allocationId}/answer`, {
            question_id: questionId,
            answer,
            section_index: sectionIndex,
          })
          .catch(() => {});
      }, 400);
    },
    [allocationId]
  );

  const handleAnswerSelect = (questionId: string, optionLabel: string, isMultiChoice: boolean) => {
    let nextAnswer = optionLabel;
    if (isMultiChoice) {
      const currentVal = answers[questionId] || "";
      const currentArr = currentVal ? currentVal.split(",").map((s) => s.trim()).filter(Boolean) : [];

      const isSentenceEquivalence =
        currentQuestion?.question_type === "SENTENCE_EQUIVALENCE" ||
        currentQuestion?.category === "SENTENCE EQUIVALENCE" ||
        (currentQuestion?.options?.length === 6 && currentQuestion?.subject === "Verbal");

      if (currentArr.includes(optionLabel)) {
        nextAnswer = currentArr.filter((l) => l !== optionLabel).join(",");
      } else {
        if (isSentenceEquivalence && currentArr.length >= 2) {
          toast.info("Sentence Equivalence requires selecting exactly 2 answers.");
          nextAnswer = [currentArr[1], optionLabel].sort().join(",");
        } else {
          nextAnswer = [...currentArr, optionLabel].sort().join(",");
        }
      }
    }
    setAnswers((prev) => ({ ...prev, [questionId]: nextAnswer }));
    saveAnswerToServer(questionId, nextAnswer, currentSectionIdx);
  };

  const toggleMark = (questionId: string) => {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const handleSectionSubmit = useCallback(
    (autoSubmit = false) => {
      if (!examData || !currentSection || isSubmitting) return;

      setIsSubmitting(true);
      const section = currentSection;
      const responses = section.questions.map((q) => ({
        question_id: q.question_id,
        student_answer: answers[q.question_id] || "",
      }));

      api
        .post(`/student/tests/allocations/${allocationId}/submit-section`, {
          section_index: currentSectionIdx,
          responses,
        })
        .then((res) => {
          const adaptive = res.data.adaptive;
          if (adaptive) {
            setTransitionMsg(
              `${section.subject} Section 1 scored ${res.data.score}/${res.data.total}. ` +
                `Section 2 will be at ${adaptive.difficulty} difficulty level. ` +
                `${adaptive.questions_allocated || 0} questions selected.`
            );
          } else {
            setTransitionMsg(`${section.name} submitted successfully.`);
          }

          // RE-FETCH ALLOCATION QUESTIONS to receive dynamically selected Section 2 questions!
          return api.get(`/student/tests/${allocationId}/questions`);
        })
        .then((res) => {
          if (!res) return;
          const freshData = res.data as ExamData;
          setExamData(freshData);

          const nextIdx = currentSectionIdx + 1;
          if (nextIdx < freshData.sections.length) {
            setPhase("section-transition");
            setTimeout(() => {
              setCurrentSectionIdx(nextIdx);
              setCurrentQIdx(0);
              const nextSec = freshData.sections[nextIdx];
              let nextTimer = nextSec.duration_mins * 60;
              if (nextSec.started_at) {
                const elapsed = Math.floor((Date.now() - new Date(nextSec.started_at).getTime()) / 1000);
                nextTimer = Math.max(0, nextSec.duration_mins * 60 - elapsed);
              } else {
                api.post(`/student/tests/${allocationId}/start-section`, { section_index: nextIdx }).catch(() => {});
              }
              setSectionTimer(nextTimer);
              setPhase("exam");
              setIsSubmitting(false);
            }, 3000);
          } else {
            setIsSubmitting(false);
            handleFinalSubmit();
          }
        })
        .catch((err) => {
          setIsSubmitting(false);
          toast.error(err?.response?.data?.error || "Failed to submit section");
        });
    },
    [examData, currentSection, currentSectionIdx, answers, allocationId, isSubmitting]
  );

  const handleFinalSubmit = useCallback(() => {
    api
      .post(`/student/tests/${allocationId}/submit`)
      .then(() => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        setPhase("submitted");
        setTimeout(() => {
          router.push(`/student/results/${allocationId}`);
        }, 1800);
      })
      .catch((err) => {
        toast.error(err.response?.data?.error || "Failed to submit exam");
      });
  }, [allocationId, router]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  /* ---------------- Render states ---------------- */

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        {error ? (
          <div className="text-center max-w-md">
            <Icon.AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="text-red-600 text-lg mb-4">{error}</p>
            <button
              onClick={() => router.push("/student/tests")}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Back to Available Tests
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">Loading exam...</p>
          </div>
        )}
      </div>
    );
  }

  if (phase === "terminated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <div className="text-center max-w-md">
          <Icon.Lock className="w-14 h-14 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Test Terminated</h2>
          <p className="text-gray-500 mb-2">
            Your test has been permanently terminated due to {MAX_VIOLATIONS} or more proctoring violations.
          </p>
          <p className="text-sm text-red-600 font-medium mb-6">Status: MALPRACTICE</p>
          <button
            onClick={() => router.push("/student/dashboard")}
            className="bg-gray-800 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-900"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (phase === "submitted") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center max-w-md">
          <Icon.CheckCircle className="w-14 h-14 text-green-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Test Submitted</h2>
          <p className="text-gray-500 mb-6">Redirecting to your performance report...</p>
          <div className="animate-spin w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
        </div>
      </div>
    );
  }

  if (phase === "instructions") {
    const mins = Math.floor(instructionTimer / 60);
    const secs = instructionTimer % 60;
    const rules = [
      { icon: Icon.Fullscreen, text: "This exam runs in Full-Screen Mode. Exiting fullscreen displays a blocking warning and is logged as a violation." },
      { icon: Icon.Ban, text: "No tab switching, window switching, copying, or pasting is allowed. All such actions are detected and logged." },
      { icon: Icon.Lock, text: "Browser Developer Tools are disabled. Attempting to open them is logged as a high-severity violation." },
      { icon: Icon.AlertTriangle, text: `Reaching ${MAX_VIOLATIONS} violations permanently terminates the test with a MALPRACTICE status.` },
      { icon: Icon.Clock, text: "Each section has a fixed time limit. The exam auto-advances when the timer reaches zero." },
      { icon: Icon.Flag, text: "You can mark questions for review and navigate freely within a section using the question grid." },
      { icon: Icon.Calculator, text: "An on-screen calculator is available for Quantitative sections." },
      { icon: Icon.Bolt, text: "Section 2 difficulty adjusts based on your Section 1 performance — aim for your best!" },
      { icon: Icon.ClipboardCheck, text: "Your answers are saved automatically as you work through each question." },
    ];
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-3xl w-full bg-white border border-gray-200 rounded-2xl p-8 shadow-xl">
          <div className="text-center mb-6">
            <Icon.Shield className="w-10 h-10 text-blue-600 mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-gray-900 mb-1">GRE Exam Instructions</h1>
            <p className="text-gray-500">{examData?.test_title}</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-center">
            <p className="text-sm text-blue-600 mb-1">Exam starts in</p>
            <p className="text-3xl font-bold text-gray-900 tabular-nums">
              {mins}:{secs.toString().padStart(2, "0")}
            </p>
          </div>

          <div className="space-y-4 text-gray-700 text-sm mb-8">
            {rules.map((r, i) => (
              <div key={i} className="flex items-start gap-3">
                <r.icon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p>{r.text}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-600 font-medium">
                The exam will automatically start when the timer reaches zero.
              </p>
            </div>
            <button
              onClick={startExam}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition ${
                instructionTimer > 0
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
              disabled={instructionTimer > 0}
            >
              {instructionTimer > 0
                ? `Auto-starting in ${mins}:${secs.toString().padStart(2, "0")}`
                : "Start Exam Now"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "section-transition") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-xl">
          <Icon.Bolt className="w-10 h-10 text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-3">Section Transition</h2>
          <p className="text-gray-600 text-sm mb-4">{transitionMsg}</p>
          <p className="text-gray-400 text-xs">Next section starting in a few seconds...</p>
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mt-4"></div>
        </div>
      </div>
    );
  }

  const sectionQuestions = currentSection?.questions || [];
  const answeredCount = sectionQuestions.filter((q) => answers[q.question_id]).length;
  const markedCount = sectionQuestions.filter((q) => marked.has(q.question_id)).length;

  return (
    <div className="min-h-screen bg-white flex flex-col select-none">
      {/* Top Header */}
      <header className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold tracking-tight text-slate-100">{examData?.test_title}</h1>
          {currentSection && (
            <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full font-medium">
              Section {currentSectionIdx + 1}/{examData?.sections?.length || 5}: {currentSection.name || currentSection.subject}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-slate-200">
            <button
              onClick={() => setHideTimer(!hideTimer)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition font-medium"
              title={hideTimer ? "Show Clock" : "Hide Clock"}
            >
              <Icon.Eye className="w-3.5 h-3.5" />
              {hideTimer ? "Show Time" : "Hide Time"}
            </button>
            <span className="text-slate-600">|</span>
            <div className={`flex items-center gap-1 text-sm font-bold tabular-nums ${sectionTimer < 300 ? "text-red-400 animate-pulse" : "text-white"}`}>
              <Icon.Clock className="w-3.5 h-3.5" />
              {hideTimer ? "Time Hidden" : formatTime(sectionTimer)}
            </div>
          </div>

          <button
            onClick={() => setShowReviewModal(true)}
            className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <Icon.Grid className="w-4 h-4" />
            Review Screen
          </button>

          {currentSection?.subject === "Quant" && (
            <button
              onClick={() => setShowCalculator(!showCalculator)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition"
            >
              <Icon.Calculator className="w-4 h-4" />
              Calculator
            </button>
          )}

          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-medium transition"
          >
            <Icon.HelpCircle className="w-4 h-4" />
            Help
          </button>

          <span
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${
              violationCount === 0
                ? "bg-slate-800 text-slate-400"
                : violationCount >= MAX_VIOLATIONS - 1
                ? "bg-red-900/60 text-red-200 border border-red-700"
                : "bg-yellow-900/60 text-yellow-200 border border-yellow-700"
            }`}
          >
            <Icon.Shield className="w-3.5 h-3.5" />
            Violations: {violationCount}/{MAX_VIOLATIONS}
          </span>

          <button
            onClick={() => setShowSubmitConfirm(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
          >
            End &amp; Submit Section
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Section Navigation */}
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden select-none">
          <div className="p-4 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Test Sections</h3>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono font-semibold">
                {examData?.sections?.length || 0} SECTIONS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Jump to any section anytime</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {examData?.sections?.map((sec, idx) => {
              const isActive = idx === currentSectionIdx;
              const isSubmitted = !!sec.submitted_at;
              const secQs = sec.questions || [];
              const answeredInSec = secQs.filter(
                (q) => !!(answers[q.question_id] || q.saved_answer)
              ).length;

              const isLocked = (() => {
                if (idx === 0) return false;
                if (idx === 2 && !examData?.sections[1]?.submitted_at) return true;
                if (idx === 4 && !examData?.sections[3]?.submitted_at) return true;
                if ((!secQs || secQs.length === 0) && !isSubmitted) return true;
                return false;
              })();

              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (isActive) return;

                    if (isLocked) {
                      const prereqSec = idx === 2 ? "Section 2 (Verbal Reasoning 1)" : idx === 4 ? "Section 4 (Quantitative Reasoning 1)" : "the previous section";
                      toast.warning(`Section ${idx + 1} is locked until you submit ${prereqSec}.`);
                      return;
                    }

                    if (currentQuestion) {
                      const currentVal = answers[currentQuestion.question_id];
                      if (currentVal) {
                        saveAnswerToServer(currentQuestion.question_id, currentVal, currentSectionIdx);
                      }
                    }
                    setCurrentSectionIdx(idx);
                    setCurrentQIdx(0);
                    toast.info(`Switched to Section ${idx + 1}: ${sec.name || sec.subject}`);
                  }}
                  className={`w-full text-left p-3 rounded-xl transition border text-xs font-medium ${
                    isActive
                      ? "bg-blue-600/20 border-blue-500 text-white shadow-sm"
                      : isLocked
                      ? "bg-slate-900/60 border-slate-800/80 text-slate-500 hover:border-slate-700"
                      : isSubmitted
                      ? "bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800/80"
                      : "bg-slate-800/80 border-slate-700/60 text-slate-200 hover:bg-slate-800 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold truncate text-slate-100">
                      Sec {idx + 1}: {sec.name || sec.subject}
                    </span>
                    {isActive ? (
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                    ) : isLocked ? (
                      <span className="text-[10px] text-amber-400 font-semibold bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.2 rounded">
                        Locked
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="capitalize">{sec.subject}</span>
                    <span className={isSubmitted ? "text-emerald-400 font-semibold" : isLocked ? "text-amber-500/80" : "text-slate-300 font-semibold"}>
                      {isSubmitted
                        ? "Submitted"
                        : isLocked
                        ? "Adaptive (Locked)"
                        : `${answeredInSec}/${secQs.length || sec.total_questions || 0} ans`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {!currentQuestion ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 select-none">
            <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-lg">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
                !
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                Section {currentSectionIdx + 1}: {currentSection?.name || currentSection?.subject || "Section"} is Locked
              </h3>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                This is an adaptive test section. Questions for Section {currentSectionIdx + 1} will be automatically generated after you complete and submit {currentSectionIdx === 2 ? "Section 2 (Verbal Reasoning 1)" : currentSectionIdx === 4 ? "Section 4 (Quantitative Reasoning 1)" : "the preceding section"}.
              </p>
              <button
                onClick={() => {
                  const targetIdx = currentSectionIdx === 2 ? 1 : currentSectionIdx === 4 ? 3 : 0;
                  setCurrentSectionIdx(targetIdx);
                  setCurrentQIdx(0);
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition shadow-sm"
              >
                Go to Section {currentSectionIdx === 2 ? "2 (Verbal Reasoning 1)" : currentSectionIdx === 4 ? "4 (Quantitative Reasoning 1)" : "1"} &rarr;
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-800">
                  Question {currentQIdx + 1} of {sectionQuestions.length}
                </span>
                {(() => {
                  const isAWA =
                    currentSection.subject === "AWA" ||
                    currentQuestion.subject === "AWA" ||
                    currentQuestion.question_type === "AWA" ||
                    currentQuestion.answer_format === "ESSAY";
                  const isNumericEntry =
                    currentQuestion.answer_format === "NUMERIC_ENTRY" ||
                    currentQuestion.question_type === "NUMERIC_ENTRY" ||
                    currentQuestion.question_type === "FRACTION";
                  const isMultiAnswer =
                    currentQuestion.is_multi_answer === true ||
                    currentQuestion.answer_format === "MULTI_CHOICE" ||
                    currentQuestion.question_type === "SENTENCE_EQUIVALENCE" ||
                    currentQuestion.question_type === "MULTIPLE_CHOICE_MULTI" ||
                    currentQuestion.question_type === "SELECT_MANY";

                  if (isAWA) {
                    return (
                      <span className="text-xs bg-indigo-100 text-indigo-800 border border-indigo-200 px-2.5 py-0.5 rounded-full font-semibold">
                        Essay Response (Analytical Writing)
                      </span>
                    );
                  }
                  if (isNumericEntry) {
                    return (
                      <span className="text-xs bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full font-semibold">
                        Numeric Entry Box
                      </span>
                    );
                  }
                  if (isMultiAnswer) {
                    return (
                      <span className="text-xs bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-0.5 rounded-full font-semibold">
                        Select All That Apply (Square Checkboxes)
                      </span>
                    );
                  }
                  return (
                    <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full font-medium">
                      Select One Answer (Oval Buttons)
                    </span>
                  );
                })()}
                {currentSection.subject === "Quant" && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">Quant</span>
                )}
                {currentSection.subject === "Verbal" && (
                  <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">Verbal</span>
                )}
              </div>
              <button
                onClick={() => toggleMark(currentQuestion.question_id)}
                className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg font-semibold transition shadow-sm ${
                  marked.has(currentQuestion.question_id)
                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                    : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
                }`}
              >
                <Icon.Flag className="w-3.5 h-3.5 text-amber-600" />
                {marked.has(currentQuestion.question_id) ? "Marked for Review" : "Mark Question"}
              </button>
            </div>

            {currentQuestion.passage && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 max-h-64 overflow-y-auto shadow-sm select-none" onCopy={(e) => e.preventDefault()}>
                <p className="text-xs text-slate-400 mb-2 font-bold tracking-wider uppercase">READING PASSAGE</p>
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{currentQuestion.passage}</p>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 select-none" onCopy={(e) => e.preventDefault()}>
              <p className="text-base text-slate-900 whitespace-pre-wrap leading-relaxed font-normal">
                {currentQuestion.question_text}
              </p>
              {(() => {
                const getImages = (q: any): string[] => {
                  const urls: string[] = [];
                  const resolveUrl = (imgItem: any) => {
                    if (!imgItem) return "";
                    let path = "";
                    if (typeof imgItem === "string") path = imgItem;
                    else if (typeof imgItem === "object") path = imgItem.image_name || imgItem.url || imgItem.src || imgItem.image || "";
                    if (!path) return "";
                    if (path.startsWith("http://") || path.startsWith("https://")) {
                      if (path.includes("kprcloud-storage.cloudlab.works/gretestimages/")) {
                        const filename = path.replace("https://kprcloud-storage.cloudlab.works/gretestimages/", "").replace("http://kprcloud-storage.cloudlab.works/gretestimages/", "");
                        return `http://localhost:3500/api/images/${encodeURIComponent(filename)}`;
                      }
                      return path;
                    }
                    return `http://localhost:3500/api/images/${encodeURIComponent(path)}`;
                  };

                  if (q.images && Array.isArray(q.images)) {
                    q.images.forEach((img: any) => {
                      const u = resolveUrl(img);
                      if (u && !urls.includes(u)) urls.push(u);
                    });
                  }
                  if (q.image_url) {
                    const u = resolveUrl(q.image_url);
                    if (u && !urls.includes(u)) urls.push(u);
                  }
                  if (q.image) {
                    const u = resolveUrl(q.image);
                    if (u && !urls.includes(u)) urls.push(u);
                  }
                  return urls;
                };

                const images = getImages(currentQuestion);
                if (images.length === 0) return null;

                return (
                  <div className="mt-4 space-y-3">
                    {images.map((url, i) => (
                      <div key={i} className="image-box-container p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center">
                        <img
                          src={url}
                          alt={`Question figure ${i + 1}`}
                          className="max-w-full max-h-96 object-contain rounded-lg border border-slate-300 shadow-sm"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const parent = target.closest(".image-box-container") as HTMLElement;
                            target.style.display = "none";
                            if (parent) parent.style.display = "none";
                          }}
                        />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="space-y-2.5 mb-8">
              {(() => {
                const isAWA =
                  currentSection?.subject === "AWA" ||
                  currentQuestion?.subject === "AWA" ||
                  currentQuestion?.question_type === "AWA" ||
                  currentQuestion?.answer_format === "ESSAY";

                // Quantitative Comparison (QC) check
                const isQC =
                  currentQuestion?.subject === "Quant" &&
                  (currentQuestion?.question_text?.toLowerCase().includes("quantity a") ||
                    currentQuestion?.category?.toLowerCase().includes("quantitative comparison") ||
                    currentQuestion?.question_type?.toLowerCase().includes("quantitative comparison"));

                const defaultQCOptions = [
                  { label: "A", text: "Quantity A is greater." },
                  { label: "B", text: "Quantity B is greater." },
                  { label: "C", text: "The two quantities are equal." },
                  { label: "D", text: "The relationship cannot be determined from the information given." },
                ];

                // Check for dummy placeholder options (Option A, Option B...)
                const hasDummyOptions =
                  currentQuestion?.options &&
                  currentQuestion.options.length > 0 &&
                  currentQuestion.options.every((opt: any) =>
                    /^option\s+[a-d]$/i.test((opt.text || "").trim())
                  );

                // Numeric Entry check: ONLY Quant, NEVER Verbal, NEVER QC
                const isNumericEntry =
                  !isQC &&
                  currentQuestion?.subject === "Quant" &&
                  (currentQuestion?.answer_format === "NUMERIC_ENTRY" ||
                    currentQuestion?.answer_format === "TEXT_INPUT" ||
                    currentQuestion?.question_type === "NUMERIC_ENTRY" ||
                    currentQuestion?.question_type === "FRACTION" ||
                    currentQuestion?.question_text?.includes("(NE)") ||
                    !currentQuestion?.options ||
                    currentQuestion.options.length === 0 ||
                    hasDummyOptions);

                const isSentenceEquivalence =
                  currentQuestion?.subject === "Verbal" &&
                  (currentQuestion?.question_type === "SENTENCE_EQUIVALENCE" ||
                    currentQuestion?.category?.toLowerCase().includes("sentence equivalence") ||
                    (currentQuestion?.options?.length === 6 &&
                      (currentQuestion?.is_multi_answer === true || currentQuestion?.answer_format === "MULTI_CHOICE")));

                const isMultiAnswer =
                  !isQC &&
                  (currentQuestion?.is_multi_answer === true ||
                    currentQuestion?.answer_format === "MULTI_CHOICE" ||
                    isSentenceEquivalence ||
                    currentQuestion?.question_type === "MULTIPLE_CHOICE_MULTI" ||
                    currentQuestion?.question_type === "SELECT_MANY");

                const formatOptionText = (label: string, text: string): string => {
                  if (!text) return `Option ${label}`;
                  const prefixRegex = new RegExp(`^(Option\\s+)?${label}[:\\.\\s-]+`, "i");
                  let cleaned = text.replace(prefixRegex, "").trim();
                  cleaned = cleaned.replace(/^[\.\•\-\:\,]\s*/, "").trim();
                  if (!cleaned || cleaned.toLowerCase() === `option ${label.toLowerCase()}`) {
                    return `Option ${label}`;
                  }
                  return cleaned;
                };

                if (isAWA) {
                  const awaVal = answers[currentQuestion.question_id] || "";
                  const wordCount = awaVal.trim() ? (awaVal.trim().match(/\S+/g) || []).length : 0;
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                        <span>Write your Analytical Writing essay response below:</span>
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                          Word Count: {wordCount} words
                        </span>
                      </div>
                      <textarea
                        rows={14}
                        value={awaVal}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAnswers((prev) => ({ ...prev, [currentQuestion.question_id]: val }));
                          saveAnswerToServer(currentQuestion.question_id, val, currentSectionIdx);
                        }}
                        onPaste={(e) => e.preventDefault()}
                        placeholder="Write your response in detail addressing the prompt..."
                        className="w-full p-4 rounded-xl border-2 border-slate-300 focus:border-blue-600 focus:outline-none text-base text-slate-900 bg-white leading-relaxed shadow-sm resize-y font-sans"
                      />
                    </div>
                  );
                }

                if (isNumericEntry) {
                  return (
                    <div className="space-y-2 bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Numeric Entry / Short Answer:
                      </label>
                      <input
                        type="text"
                        value={answers[currentQuestion.question_id] || ""}
                        onChange={(e) => handleAnswerSelect(currentQuestion.question_id, e.target.value, false)}
                        onPaste={(e) => e.preventDefault()}
                        placeholder="Enter numeric answer (e.g. 25 or 68.98)..."
                        className="w-full p-4 rounded-xl border-2 border-blue-300 focus:border-blue-600 focus:outline-none text-base font-semibold text-slate-900 bg-white select-text shadow-sm"
                      />
                    </div>
                  );
                }

                // Check for 2-Blank or 3-Blank Text Completion grouping
                const isTextCompletionBlanks =
                  currentQuestion.subject === "Verbal" &&
                  (currentQuestion.options?.length === 6 || currentQuestion.options?.length === 9) &&
                  !isSentenceEquivalence;

                if (isTextCompletionBlanks) {
                  const optionsPerBlank = 3;
                  const blankCount = currentQuestion.options.length / optionsPerBlank;
                  const blankNames = ["Blank (i)", "Blank (ii)", "Blank (iii)"];
                  const currentSelectedArr = (answers[currentQuestion.question_id] || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);

                  return (
                    <div className="space-y-4">
                      {Array.from({ length: blankCount }).map((_, bIdx) => {
                        const blankOpts = currentQuestion.options.slice(bIdx * optionsPerBlank, (bIdx + 1) * optionsPerBlank);
                        return (
                          <div key={bIdx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center justify-between">
                              <span>{blankNames[bIdx] || `Blank ${bIdx + 1}`}</span>
                              <span className="text-[11px] font-normal text-slate-500">Select 1 option</span>
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {blankOpts.map((opt: any) => {
                                const isSelected = currentSelectedArr.includes(opt.label);
                                return (
                                  <button
                                    key={opt.label}
                                    onClick={() => {
                                      const otherSelections = currentSelectedArr.filter(
                                        (l) => !blankOpts.some((bOpt: any) => bOpt.label === l)
                                      );
                                      const updated = [...otherSelections, opt.label].sort().join(",");
                                      setAnswers((prev) => ({ ...prev, [currentQuestion.question_id]: updated }));
                                      saveAnswerToServer(currentQuestion.question_id, updated, currentSectionIdx);
                                    }}
                                    className={`p-3.5 text-left border-2 rounded-xl transition flex items-start gap-2.5 ${
                                      isSelected
                                        ? "border-blue-600 bg-blue-600 text-white font-semibold shadow-sm"
                                        : "border-slate-200 bg-white hover:border-blue-300 text-slate-800"
                                    }`}
                                  >
                                    <span
                                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                                        isSelected ? "bg-white text-blue-700" : "bg-slate-100 text-slate-600 border border-slate-300"
                                      }`}
                                    >
                                      {opt.label}
                                    </span>
                                    <span className="text-xs font-medium pt-0.5 leading-snug">
                                      {formatOptionText(opt.label, opt.text)}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // Quantitative Comparison options or default options
                const displayOptions = isQC ? defaultQCOptions : (currentQuestion.options || []);

                return displayOptions.map((opt: any, i: number) => {
                  const currentSelectedArr = (answers[currentQuestion.question_id] || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const isSelected = isMultiAnswer
                    ? currentSelectedArr.includes(opt.label)
                    : answers[currentQuestion.question_id] === opt.label;

                  return (
                    <button
                      key={i}
                      onClick={() => handleAnswerSelect(currentQuestion.question_id, opt.label, isMultiAnswer)}
                      className={`w-full text-left p-4 transition flex items-start gap-3 border-2 ${
                        isMultiAnswer ? "rounded-xl" : "rounded-full"
                      } ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/80 text-blue-950 font-medium shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 text-slate-800"
                      }`}
                    >
                      <span
                        className={`w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 transition ${
                          isMultiAnswer ? "rounded-md" : "rounded-full"
                        } ${
                          isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 border border-slate-300"
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className="text-sm pt-0.5 leading-snug">
                        {formatOptionText(opt.label, opt.text)}
                      </span>
                    </button>
                  );
                });
              })()}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <button
                onClick={() => setCurrentQIdx(Math.max(0, currentQIdx - 1))}
                disabled={currentQIdx === 0}
                className="px-5 py-2.5 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                &larr; Previous Question
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => handleSectionSubmit(false)}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition shadow-sm"
                >
                  Submit Section &rarr;
                </button>
                {currentQIdx < sectionQuestions.length - 1 ? (
                  <button
                    onClick={() => setCurrentQIdx(currentQIdx + 1)}
                    className="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-black transition shadow-sm"
                  >
                    Next Question &rarr;
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Question Navigator Sidebar */}
        <aside className="w-72 bg-white border-l border-slate-200 flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-800">Question Navigator</h3>
            <div className="flex gap-4 mt-2 text-xs font-medium text-slate-500">
              <span className="text-emerald-700 font-semibold">{answeredCount} answered</span>
              <span className="text-amber-700 font-semibold">{markedCount} marked</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-5 gap-2">
              {sectionQuestions.map((q, i) => {
                const isAnswered = !!answers[q.question_id];
                const isMarked = marked.has(q.question_id);
                const isCurrent = i === currentQIdx;
                return (
                  <button
                    key={q.question_id}
                    onClick={() => setCurrentQIdx(i)}
                    className={`w-10 h-10 rounded-lg text-xs font-bold transition relative ${
                      isCurrent ? "ring-2 ring-blue-600 ring-offset-1" : ""
                    } ${
                      isAnswered
                        ? isMarked
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        : isMarked
                        ? "bg-amber-50 text-amber-800 border border-amber-200"
                        : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                    }`}
                  >
                    {i + 1}
                    {isMarked && <Icon.Flag className="w-3 h-3 absolute -top-1 -right-1 text-amber-600 bg-white rounded-full p-0.5 border border-amber-300" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 space-y-1">
            <p><strong className="text-slate-700">Section:</strong> {currentSection?.name}</p>
            <p><strong className="text-slate-700">Subject:</strong> {currentSection?.subject}</p>
            {currentSection?.difficulty && <p><strong className="text-slate-700">Difficulty:</strong> {currentSection?.difficulty}</p>}
            <p><strong className="text-slate-700">Time Limit:</strong> {currentSection?.duration_mins} mins</p>
          </div>
        </aside>
      </div>

      {/* Official ETS GRE Review Screen Modal Overlay */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[110] p-6">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">ETS GRE Section Review Screen</h3>
                <p className="text-xs text-slate-300">Below is the status of all questions in {currentSection?.name}</p>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="text-slate-400 hover:text-white">
                <Icon.Close className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-xs uppercase tracking-wider font-bold">
                      <th className="py-3 px-4">Q #</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Marked for Review</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sectionQuestions.map((q, idx) => {
                      const isAnswered = !!answers[q.question_id];
                      const isMarked = marked.has(q.question_id);
                      return (
                        <tr key={q.question_id} className={idx === currentQIdx ? "bg-blue-50/70" : "hover:bg-slate-50"}>
                          <td className="py-3 px-4 font-bold text-slate-900">Question {idx + 1}</td>
                          <td className="py-3 px-4">
                            {isAnswered ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                                <Icon.CheckCircle className="w-3.5 h-3.5" /> Answered
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                                Incomplete
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isMarked ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                                <Icon.Flag className="w-3.5 h-3.5 text-amber-600" /> Yes
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">No</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                setCurrentQIdx(idx);
                                setShowReviewModal(false);
                              }}
                              className="px-3 py-1 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg transition"
                            >
                              Go to Question
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-medium">
                Answered {answeredCount} of {sectionQuestions.length} | Marked {markedCount}
              </span>
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-5 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition"
              >
                Return to Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official ETS GRE Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[110] p-6">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Icon.HelpCircle className="w-5 h-5 text-blue-600" /> GRE Test Help &amp; Guidelines
              </h3>
              <button onClick={() => setShowHelpModal(false)} className="text-slate-400 hover:text-slate-600">
                <Icon.Close className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-700 leading-relaxed max-h-96 overflow-y-auto pr-2">
              <p><strong>Navigating Questions:</strong> Use <em>Next</em> and <em>Previous</em> to navigate through questions in the active section, or click any question in the <em>Question Navigator</em> or <em>Review Screen</em>.</p>
              <p><strong>Question Types:</strong></p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600">
                <li><strong>Single Choice:</strong> Displayed with oval buttons. Select one answer.</li>
                <li><strong>Multiple Choice:</strong> Displayed with square checkboxes. Select all that apply.</li>
                <li><strong>Numeric Entry:</strong> Enter integers or decimals into the text input box.</li>
              </ul>
              <p><strong>Timer Controls:</strong> Click <em>Hide Time / Show Time</em> to toggle the timer display. The test automatically submits when time expires.</p>
              <p><strong>Reviewing &amp; Marking:</strong> Click <em>Mark Question</em> to flag any question for later review. Click <em>Review Screen</em> at any point to view an overview of all section questions.</p>
            </div>
            <button
              onClick={() => setShowHelpModal(false)}
              className="mt-6 w-full py-2.5 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 transition"
            >
              Close Help
            </button>
          </div>
        </div>
      )}

      {/* Calculator Modal */}
      {showCalculator && (
        <div className="fixed bottom-20 right-6 z-50 bg-white rounded-xl shadow-2xl border border-gray-300 p-4 w-72">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <Icon.Calculator className="w-4 h-4" />
              Calculator
            </h4>
            <button onClick={() => setShowCalculator(false)} className="text-gray-400 hover:text-gray-600">
              <Icon.Close className="w-4 h-4" />
            </button>
          </div>
          <Calculator />
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">End &amp; Submit Test?</h3>
            <p className="text-sm text-gray-500 mb-4">
              You have answered {answeredCount} of {sectionQuestions.length} questions in this section.
              {currentSectionIdx + 1 < examData!.sections.length &&
                ` ${examData!.sections.length - currentSectionIdx - 1} section(s) remaining.`}{" "}
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSubmitConfirm(false);
                  handleFinalSubmit();
                }}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700"
              >
                Submit Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Exit Blocking Modal */}
      {fullscreenWarning && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <Icon.AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Full-Screen Mode Required</h3>
            <p className="text-sm text-gray-500 mb-2">
              You exited full-screen mode. This has been logged as a proctoring violation.
            </p>
            <p className="text-sm text-red-600 font-medium mb-6">
              Violations: {violationCount}/{MAX_VIOLATIONS}
            </p>
            <button
              onClick={reenterFullscreen}
              className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
            >
              Re-enter Full-Screen to Continue
            </button>
          </div>
        </div>
      )}

      {/* Transient Violation Toast Banner */}
      {lastViolation && violationCount > 0 && !fullscreenWarning && (
        <ViolationBanner
          label={lastViolation.label}
          count={violationCount}
          onDismiss={() => setLastViolation(null)}
        />
      )}
    </div>
  );
}

function ViolationBanner({
  label,
  count,
  onDismiss,
}: {
  label: string;
  count: number;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss, label, count]);

  return (
    <div className="fixed top-16 right-6 z-[90] bg-white border border-red-200 shadow-lg rounded-xl p-4 max-w-xs">
      <div className="flex items-start gap-3">
        <Icon.AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Violation {count} of {MAX_VIOLATIONS} recorded.
          </p>
        </div>
      </div>
    </div>
  );
}

function Calculator() {
  const [display, setDisplay] = useState("0");
  const [expression, setExpression] = useState("");

  const press = (val: string) => {
    if (display === "0" && val !== "." && !["+", "-", "*", "/"].includes(val)) {
      setDisplay(val);
    } else {
      setDisplay(display + val);
    }
    setExpression(expression + val);
  };

  const clear = () => {
    setDisplay("0");
    setExpression("");
  };

  const backspace = () => {
    setDisplay(display.length > 1 ? display.slice(0, -1) : "0");
    setExpression(expression.length > 1 ? expression.slice(0, -1) : "");
  };

  const equals = () => {
    try {
      // eslint-disable-next-line no-eval
      const result = eval(expression);
      setDisplay(String(result));
      setExpression(String(result));
    } catch {
      setDisplay("Error");
      setExpression("");
    }
  };

  const buttons = [
    ["7", "8", "9", "/"],
    ["4", "5", "6", "*"],
    ["1", "2", "3", "-"],
    ["0", ".", "=", "+"],
  ];

  return (
    <div>
      <div className="bg-gray-100 rounded-lg p-3 mb-3 text-right">
        <p className="text-xs text-gray-400 truncate">{expression || "0"}</p>
        <p className="text-xl font-bold text-gray-900 truncate">{display}</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button onClick={clear} className="col-span-2 bg-red-100 text-red-700 rounded-lg py-2 text-sm font-medium hover:bg-red-200">
          C
        </button>
        <button onClick={backspace} className="bg-gray-100 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-200">
          DEL
        </button>
        <button onClick={() => press("/")} className="bg-gray-100 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-200">
          ÷
        </button>
        {buttons.flat().map((btn, i) => (
          <button
            key={i}
            onClick={() => (btn === "=" ? equals() : press(btn))}
            className={`rounded-lg py-2 text-sm font-medium ${
              btn === "="
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : ["+", "-", "*", "/"].includes(btn)
                ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                : "bg-white text-gray-900 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {btn === "*" ? "×" : btn === "/" ? "÷" : btn}
          </button>
        ))}
      </div>
    </div>
  );
}
