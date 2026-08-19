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
