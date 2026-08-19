# GRE Computer-Based Testing (CBT) System

A modern, full-stack GRE Computer-Based Exam Platform built with **Next.js (React/TypeScript)** and **Go (Fiber/MongoDB)**.

---

## 🗄️ MongoDB Question Schema Reference

Questions are stored in MongoDB under the `gre_db` database across three core collections:
* `verbal_questions` — Verbal Reasoning questions (Text Completion, Sentence Equivalence, Reading Comprehension).
* `quant_questions` — Quantitative Reasoning questions (Quantitative Comparison, Multiple Choice, Numeric Entry).
* `awa_questions` — Analytical Writing Measure essay prompts (Issue & Argument tasks).

---

### 1. General Document Schema

Every question document adheres to the following unified JSON schema structure:

```json
{
  "_id": "6a755f7e8e61d08fc9649411",
  "question_id": "VERBAL_1914",
  "source_file": "Medium 50.xlsx",
  "subject": "Verbal",
  "category": "Medium 50",
  "level": "Medium",
  "question_type": "MCQ",
  "answer_format": "TEXT_INPUT",
  "is_multi_answer": false,
  "question_text": "Bentham provided the conceptual model for modern prisons...",
  "passage": "Optional reading comprehension passage text...",
  "options": [
    { "label": "A", "text": "schematic" },
    { "label": "B", "text": "epitome" },
    { "label": "C", "text": "quintessence" },
    { "label": "D", "text": "constricted" },
    { "label": "E", "text": "panoramic" },
    { "label": "F", "text": "salubrious" }
  ],
  "correct_answers": [
    { "value": "A", "format": "LABEL", "option_label": "A" },
    { "value": "E", "format": "LABEL", "option_label": "E" }
  ],
  "explanation": "Recycle the phrase conceptual model for the first blank...",
  "images": [
    {
      "image_name": "DI Q15",
      "image_url": "DI Q15",
      "storage": "MinIO"
    }
  ],
  "has_answer_image": false,
  "image_storage": "MinIO",
  "is_active": true,
  "version": 3,
  "created_at": "2026-07-24T17:02:32.272Z",
  "updated_at": "2026-08-07T04:30:54.273Z"
}
```

---

### 2. Question Types & Field Mapping Rules

#### A. Quantitative Comparison (QC)
* **Target Collection**: `quant_questions`
* **Trigger Condition**: `question_text` contains `"Quantity A"` (case-insensitive) or `category === "QUANTITATIVE COMPARISON"`.
* **Options Array**: Standard 4 ETS Choices rendered by the frontend engine:
  - **A**: Quantity A is greater.
  - **B**: Quantity B is greater.
  - **C**: The two quantities are equal.
  - **D**: The relationship cannot be determined from the information given.

#### B. Verbal Text Completion (1-Blank, 2-Blank, 3-Blank)
* **Target Collection**: `verbal_questions`
* **Options Count**:
  - **1-Blank**: 3 options (`A, B, C`) → Select 1.
  - **2-Blank**: 6 options → Grouped dynamically into **Blank (i)** (`A, B, C`) & **Blank (ii)** (`D, E, F`). Select 1 per blank.
  - **3-Blank**: 9 options → Grouped dynamically into **Blank (i)** (`A, B, C`), **Blank (ii)** (`D, E, F`), & **Blank (iii)** (`G, H, I`). Select 1 per blank.

#### C. Sentence Equivalence (SE)
* **Target Collection**: `verbal_questions`
* **Attributes**: `question_type: "SENTENCE_EQUIVALENCE"` or `category` contains `"Sentence Equivalence"`.
* **Options**: 6 options (`A, B, C, D, E, F`).
* **Frontend Constraint**: Requires selecting **EXACTLY 2 choices** (max 2 enforced in UI with active toast notification).

#### D. Numeric Entry (Short Answer / Fraction)
* **Target Collection**: `quant_questions`
* **Attributes**: `answer_format: "NUMERIC_ENTRY"` | `"TEXT_INPUT"` | `question_type: "FRACTION"` | `question_text` ends with `(NE)`.
* **Options Array**: Empty or placeholder options `[Option A, Option B]`.
* **Frontend Rendering**: Renders a single text input box `<input type="text" placeholder="Enter numeric answer..." />`.

---

### 3. MinIO Image Resolution Mechanics

Question figures and diagram images are stored in MinIO bucket `gretestimages`:
* **MongoDB Reference**: `images[0].image_name` stores filename without extension (e.g. `DI Q15`, `Circle_Q4`).
* **MinIO Storage**: Stored with extension (e.g. `DI Q15.jpg`, `Circle_Q4.jpg`).
* **Backend Proxy Endpoint**: `GET /api/images/:filename`
  - Unescapes URL encoding (`%20` → space).
  - Stat checks object keys with candidate extensions (`.jpg`, `.png`, `.svg`).
  - Streams image bytes directly to frontend with proper `Content-Type`.

---

## 🚀 Running the Project

### Prerequisites
* Go 1.22+
* Node.js 18+ / pnpm
* MongoDB running on `mongodb://localhost:27017`
* MinIO Server running on `http://localhost:9000`

### 1. Start Go Backend
```bash
cd gobackend
go run *.go
# Server runs on http://localhost:3500
```

### 2. Start Next.js Frontend
```bash
cd front
npm run dev
# App runs on http://localhost:3001
```

---

## Bug Analysis Report

Scope: static review of the current `gre` workspace, with extra focus on student test taking, test allocation, and the start/submit flow.

### High Priority Findings

1. The student dashboard shows a generic `Start Test` button for the next scheduled allocation even when the test is not yet startable. The click always routes to the exam page, which then tries to start the test and surfaces an error if the schedule has not opened yet. This creates a broken start flow on the student side. See [front/app/student/dashboard/page.tsx](front/app/student/dashboard/page.tsx#L247) and [front/app/student/exam/[id]/page.tsx](front/app/student/exam/[id]/page.tsx#L269).

2. The exam page sends a `sendBeacon` flush request to `/api/student/tests/:id/flush-answers`, but no matching backend route is registered. That means the leave-page flush safety net does not actually persist anything server-side. See [front/app/student/exam/[id]/page.tsx](front/app/student/exam/[id]/page.tsx#L231) and [gobackend/main.go](gobackend/main.go#L81).

3. The exam page moves into the `exam` phase immediately after calling `start-section`, without waiting for the API call to succeed. If the backend rejects or delays the request, the UI still behaves as if the section has started. See [front/app/student/exam/[id]/page.tsx](front/app/student/exam/[id]/page.tsx#L457).

4. Test allocation creation accepts any RFC3339 timestamp and does not reject times in the past. That means an admin can create an allocation whose scheduled time is already expired, even though reschedule and reallocate paths do reject past times. See [gobackend/handlers_tests.go](gobackend/handlers_tests.go#L16).

5. The student start gate is too strict: `handleStartTest` computes `noStartDeadline` as half of the total test window, not the full end of the window. A student can be blocked from starting long before the allocation actually expires. See [gobackend/handlers_student.go](gobackend/handlers_student.go#L453).

6. `handleStartSection` lets a student mark a section as started without checking that the parent test is in progress. It also does not validate the scheduled window. That makes the section-start marker easy to manipulate outside the intended flow. See [gobackend/handlers_student.go](gobackend/handlers_student.go#L1527).

7. `handleSubmitSection` does not check that the caller owns the allocation. Any authenticated student who knows an allocation id can submit that section because the handler only loads by allocation id and never compares `StudentID` to the current user. See [gobackend/handlers_adaptive.go](gobackend/handlers_adaptive.go#L79).

8. `handleSubmitExam` allows final submission as soon as the allocation status is `IN_PROGRESS`; it does not verify that all sections were actually submitted first. A client can therefore end an exam early by calling the final submit endpoint directly. See [gobackend/handlers_student.go](gobackend/handlers_student.go#L613).

### Medium Priority Findings

1. The allocation admin page keeps separate `fTimeFrom` and `fTimeTo` state, but those values are not used when querying allocations. The time filter UI therefore looks supported but has no effect. See [front/app/admin/allocate-test/page.tsx](front/app/admin/allocate-test/page.tsx#L40).

2. The allocation page and student dashboard both rely on client-side routing for start actions, but the backend is the real source of truth. This is fine only if the UI copies the same startability rules exactly; right now the dashboard does not, so the two sides disagree about when a test can begin. See [front/app/student/dashboard/page.tsx](front/app/student/dashboard/page.tsx#L263) and [gobackend/handlers_student.go](gobackend/handlers_student.go#L426).

3. Several backend handlers still use `context.Background()` for MongoDB calls instead of the request context. That is not a crash bug by itself, but it means cancelled HTTP requests can continue consuming database resources. This pattern is visible throughout the student and allocation handlers, including [gobackend/handlers_student.go](gobackend/handlers_student.go#L438) and [gobackend/handlers_tests.go](gobackend/handlers_tests.go#L144).

### Notes

The backend and frontend are mostly aligned on the general GRE allocation model, but the student start flow has multiple mismatches: UI start labels do not fully match backend eligibility, section start is too permissive, and the safety flush path is disconnected from the server. Fixing those four items would remove the biggest reliability gaps in the test-taking experience.

---

## Remaining Findings After Claimed Fixes

The following issues are still present in the current codebase after re-checking the live paths:

1. `handleStartTest` still uses a half-window cutoff for scheduled tests. The code compares `now` against `alloc.ScheduledAt.Add(duration / 2)`, so a student can be blocked from starting well before the real expiry window ends. See [gobackend/handlers_student.go](gobackend/handlers_student.go#L453).

2. The student exam page still transitions to the exam phase immediately after calling `start-section`. The request is fire-and-forget, so the UI can show the exam even if the backend has not accepted the section start yet. See [front/app/student/exam/[id]/page.tsx](front/app/student/exam/[id]/page.tsx#L457).

3. The MinIO image fallback still injects the requested filename into an SVG response. If a missing image path contains unsafe characters, the fallback can become an SVG injection/XSS surface instead of a harmless placeholder. See [gobackend/handlers_minio.go](gobackend/handlers_minio.go#L99).

4. The image fetch path still performs multiple `StatObject` checks and then falls back to a full recursive bucket scan when no exact match is found. That makes missing-image requests expensive and can slow down question rendering when many figures are absent or misnamed. See [gobackend/handlers_minio.go](gobackend/handlers_minio.go#L99).

5. The question listing and question lookup handlers still use `context.Background()` for MongoDB calls. That is not a functional failure by itself, but it means cancelled requests keep consuming database resources and can delay the test-taking UI under load. See [gobackend/handlers_questions.go](gobackend/handlers_questions.go#L120).

6. The current test flow now has the major ownership and flush gaps reduced, but the remaining server-side start gate is still the main correctness blocker. If you want one next fix, that should be the `handleStartTest` deadline logic, because it directly controls whether students can actually begin the exam on time.
