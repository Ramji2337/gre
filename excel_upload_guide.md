# GRE Question Bank Excel Bulk Upload Guide

This guide explains how to format Excel files (`.xlsx`) to bulk upload questions into the GRE Platform via the Admin Panel or API endpoint (`POST /api/admin/questions/bulk-upload`).

---

## 📊 Standard Excel Columns Header Structure

The first row of your Excel sheet must contain the following header names (case-insensitive):

| Column Name | Required? | Description & Allowed Values |
|---|---|---|
| **`Category`** | Recommended | Category or topic name (e.g. `GRE Quant QC`, `Sentence Equivalence`, `AWA Issue`). |
| **`Level`** | Recommended | Difficulty level: `Easy`, `Medium`, or `Hard` (defaults to `Medium` if left blank). |
| **`Question Type`** | Recommended | `MCQ`, `QUANTITATIVE_COMPARISON`, `NUMERIC_ENTRY`, `SENTENCE_EQUIVALENCE`, `TEXT_COMPLETION`, `MULTIPLE_CHOICE_MULTI`, `AWA`. |
| **`Question Text`** | **REQUIRED** | The question statement or problem prompt. |
| **`Passage`** | Optional | Reading comprehension passage or context. **Leave blank if not applicable.** |
| **`Option A`** | Conditional | Text for Choice A. |
| **`Option B`** | Conditional | Text for Choice B. |
| **`Option C`** | Conditional | Text for Choice C. |
| **`Option D`** | Conditional | Text for Choice D. |
| **`Option E`** | Optional | Text for Choice E. |
| **`Option F`** | Optional | Text for Choice F (used for 6-option Sentence Equivalence & 2-Blank TC). |
| **`Correct Answer`** | **REQUIRED** | Correct option label(s) or numeric value (e.g. `C`, `A,D`, `A,D,G`, `60`). |
| **`Explanation`** | Optional | Solution explanation text for students. |
| **`Question Images`** | Optional | Image filename(s) for the question (e.g. `figure_1.png`). **Leave blank if none.** |
| **`Answer Images`** | Optional | Image filename(s) for options (e.g. `opt_a.png, opt_b.png`). **Leave blank if none.** |

---

## ❓ Blank Cells vs. Hyphens Rule

> [!IMPORTANT]
> **Should I leave unused columns blank or fill with hyphens (`-`)?**
> - **LEAVE BLANK!** You can leave any optional or unused cells (such as `Passage`, `Option E`, `Option F`, `Question Images`, `Answer Images`) **completely empty**.
> - The backend parser automatically ignores blank cells and clean-formats your questions.
> - Do **NOT** put hyphens (`-`) or dummy words in image or text fields, as the backend would treat `-` as a real image filename or option text.

---

## 🎯 Question-Type Formatting Reference & Examples

### 1. Single-Choice Question (MCQ)
- **Question Type**: `MCQ`
- **Options**: Fill `Option A` through `Option E`.
- **Correct Answer**: Single letter (e.g., `C`).

### 2. Multiple-Choice (Multi-Select)
- **Question Type**: `MULTIPLE_CHOICE_MULTI`
- **Options**: Fill `Option A` through `Option E`.
- **Correct Answer**: Comma-separated letters (e.g., `A,C` or `A,B,D`).

### 3. Sentence Equivalence (SE)
- **Question Type**: `SENTENCE_EQUIVALENCE`
- **Options**: Fill `Option A` through `Option F` (exactly 6 options).
- **Correct Answer**: Comma-separated pair of equivalent choices (e.g., `A,C`).

### 4. Text Completion (TC)
- **1-Blank TC**:
  - `Question Type`: `TEXT_COMPLETION`
  - Fill 3 options (A-C) or 5 options (A-E). `Correct Answer`: `B`.
- **2-Blank TC**:
  - `Question Type`: `TEXT_COMPLETION`
  - Fill 6 options (A-C for Blank 1, D-F for Blank 2). `Correct Answer`: `A,D`.
- **3-Blank TC**:
  - `Question Type`: `TEXT_COMPLETION`
  - Fill 9 options (A-C for Blank 1, D-F for Blank 2, G-I for Blank 3). `Correct Answer`: `A,D,G`.

### 5. Quantitative Comparison (QC)
- **Question Type**: `QUANTITATIVE_COMPARISON`
- **Options**: You can fill Options A-D or leave options blank (the system automatically supplies the 4 standard Quantitative Comparison choices).
- **Correct Answer**: `A`, `B`, `C`, or `D`.

### 6. Numeric Entry (Short Answer)
- **Question Type**: `NUMERIC_ENTRY`
- **Options**: Leave Option A-F cells **blank**.
- **Correct Answer**: The exact number or decimal (e.g., `60` or `15.5`).

### 7. Analytical Writing Essay (AWA)
- **Question Type**: `AWA`
- **Options**: Leave Option A-F cells **blank**.
- **Correct Answer**: `N/A` or leave blank.

---

## 🖼️ Uploading Questions with Images

1. **Question Image**:
   - Put the image file name in the `Question Images` column (e.g., `geometry_diagram.png`).
   - If there are multiple question images, separate them with commas (e.g., `fig1.png, fig2.png`).
2. **Option Images**:
   - Put the choice image file names in the `Answer Images` column (e.g., `opt_a.png, opt_b.png, opt_c.png, opt_d.png`).
3. **Image Uploading**:
   - Upload the actual image files via **Admin Panel -> Upload Image** or place them in S3/MinIO bucket.

---

## 📁 Sample Excel Files Available for Reference

Four pre-formatted sample Excel files are saved in the project directory for reference:
- [`excels/sample_awa_questions.xlsx`](file:///home/ramji/Desktop/GRE/gre/excels/sample_awa_questions.xlsx)
- [`excels/sample_quant_questions.xlsx`](file:///home/ramji/Desktop/GRE/gre/excels/sample_quant_questions.xlsx)
- [`excels/sample_verbal_questions.xlsx`](file:///home/ramji/Desktop/GRE/gre/excels/sample_verbal_questions.xlsx)
- [`excels/sample_image_questions.xlsx`](file:///home/ramji/Desktop/GRE/gre/excels/sample_image_questions.xlsx)
