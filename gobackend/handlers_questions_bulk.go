package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"gre-backend/services"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
)

type QuestionBulkResult struct {
	Row        int    `json:"row"`
	Question   string `json:"question"`
	Status     string `json:"status"`
	Reason     string `json:"reason,omitempty"`
	QuestionID string `json:"question_id,omitempty"`
}

type QuestionBulkSummary struct {
	Total   int                  `json:"total"`
	Created int                  `json:"created"`
	Skipped int                  `json:"skipped"`
	Failed  int                  `json:"failed"`
	Updated int                  `json:"updated"`
	Results []QuestionBulkResult `json:"results"`
}

func handleBulkUploadQuestions(c *fiber.Ctx) error {
	subject := c.FormValue("subject")
	if subject == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Subject is required (Quant, Verbal, AWA)"})
	}

	updateMode := c.FormValue("update_mode") == "true"

	colName := subjectToCollection(subject)
	if colName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid subject"})
	}

	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Excel file is required"})
	}

	f, err := file.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to open file"})
	}
	defer f.Close()

	rows, missingCols, err := services.ParseQuestionExcel(f)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error":        fmt.Sprintf("Excel parse error: %v", err),
			"missing_cols": missingCols,
		})
	}

	col := getCollection(colName)
	summary := QuestionBulkSummary{Results: []QuestionBulkResult{}}
	summary.Total = len(rows)

	for i, row := range rows {
		result := QuestionBulkResult{Row: i + 2, Question: truncate(row.QuestionText, 60)}

		if row.QuestionText == "" {
			result.Status = "failed"
			result.Reason = "Empty question text"
			summary.Failed++
			summary.Results = append(summary.Results, result)
			continue
		}

		var existingCount int64
		normalizedText := strings.TrimSpace(strings.ToLower(row.QuestionText))
		existingCount, _ = col.CountDocuments(context.Background(), bson.M{
			"question_text": bson.M{"$regex": fmt.Sprintf("^%s$", escapeRegex(normalizedText)), "$options": "i"},
		})

		if existingCount > 0 {
			if updateMode {
				// Build images for update
				updateImages := []QuestionImage{}
				storage := "s3"

				if row.QuestionImages != "" {
					for _, imgName := range strings.Split(row.QuestionImages, ",") {
						imgName = strings.TrimSpace(imgName)
						if imgName != "" {
							updateImages = append(updateImages, QuestionImage{
								Type:      "question",
								ImageName: imgName,
								Storage:   storage,
								Caption:   "",
							})
						}
					}
				}
				if row.AnswerImages != "" {
					for _, imgName := range strings.Split(row.AnswerImages, ",") {
						imgName = strings.TrimSpace(imgName)
						if imgName != "" {
							updateImages = append(updateImages, QuestionImage{
								Type:      "answer",
								ImageName: imgName,
								Storage:   storage,
								Caption:   "",
							})
						}
					}
				}

				updateFields := bson.M{"updated_at": time.Now()}
				if len(updateImages) > 0 {
					updateFields["images"] = updateImages
				}
				if row.Explanation != "" {
					updateFields["explanation"] = row.Explanation
				}
				if row.Category != "" {
					updateFields["category"] = row.Category
				}
				if row.Level != "" {
					updateFields["level"] = row.Level
				}

				_, err := col.UpdateOne(context.Background(),
					bson.M{"question_text": bson.M{"$regex": fmt.Sprintf("^%s$", escapeRegex(normalizedText)), "$options": "i"}},
					bson.M{"$set": updateFields},
				)
				if err != nil {
					result.Status = "failed"
					result.Reason = fmt.Sprintf("Update error: %v", err)
					summary.Failed++
				} else {
					result.Status = "updated"
					summary.Updated++
				}
				summary.Results = append(summary.Results, result)
				continue
			}
			result.Status = "skipped"
			result.Reason = "Duplicate question text already exists"
			summary.Skipped++
			summary.Results = append(summary.Results, result)
			continue
		}

		options := []QuestionOption{}
		optionMap := map[string]string{
			"A": row.OptionA, "B": row.OptionB, "C": row.OptionC,
			"D": row.OptionD, "E": row.OptionE, "F": row.OptionF,
		}
		for label, text := range optionMap {
			if text != "" {
				options = append(options, QuestionOption{Label: label, Text: text})
			}
		}

		if len(options) == 0 && subject != "AWA" {
			options = []QuestionOption{
				{Label: "A", Text: "Option A"},
				{Label: "B", Text: "Option B"},
				{Label: "C", Text: "Option C"},
				{Label: "D", Text: "Option D"},
			}
		}

		answerFormat := "SINGLE_CHOICE"
		if row.QuestionType == "AWA" {
			answerFormat = "ESSAY"
		} else if row.QuestionType == "NUMERIC_ENTRY" {
			answerFormat = "NUMERIC"
		} else if row.QuestionType == "MULTIPLE_CHOICE_MULTIPLE" {
			answerFormat = "MULTIPLE_CHOICE"
		}

		correctAnswers := []CorrectAnswer{}
		if row.CorrectAnswer != "" {
			answerLabels := strings.Split(row.CorrectAnswer, ",")
			for _, label := range answerLabels {
				label = strings.TrimSpace(strings.ToUpper(label))
				if label != "" {
					correctAnswers = append(correctAnswers, CorrectAnswer{
						Value:       label,
						Format:      "LABEL",
						OptionLabel: label,
					})
				}
			}
		}

		images := []QuestionImage{}
		storage := "s3"

		if row.QuestionImages != "" {
			for _, imgName := range strings.Split(row.QuestionImages, ",") {
				imgName = strings.TrimSpace(imgName)
				if imgName != "" {
					images = append(images, QuestionImage{
						Type:      "question",
						ImageName: imgName,
						Storage:   storage,
						Caption:   "",
					})
				}
			}
		}

		if row.AnswerImages != "" {
			for _, imgName := range strings.Split(row.AnswerImages, ",") {
				imgName = strings.TrimSpace(imgName)
				if imgName != "" {
					images = append(images, QuestionImage{
						Type:      "answer",
						ImageName: imgName,
						Storage:   storage,
						Caption:   "",
					})
				}
			}
		}

		hasAnswerImage := len(images) > 0 && func() bool {
			for _, img := range images {
				if img.Type == "answer" {
					return true
				}
			}
			return false
		}()

		now := time.Now()
		questionID := fmt.Sprintf("BULK_%s_%d_%d", subject, now.UnixNano(), i)

		question := Question{
			QuestionID:     questionID,
			Subject:        subject,
			Category:       row.Category,
			Level:          row.Level,
			QuestionType:   row.QuestionType,
			AnswerFormat:   answerFormat,
			IsMultiAnswer:  false,
			QuestionText:   row.QuestionText,
			Passage:        row.Passage,
			Options:        options,
			CorrectAnswers: correctAnswers,
			Explanation:    row.Explanation,
			Images:         images,
			HasAnswerImage: hasAnswerImage,
			ImageStorage:   "S3",
			IsActive:       true,
			CreatedAt:      now,
			UpdatedAt:      now,
		}

		_, err := col.InsertOne(context.Background(), question)
		if err != nil {
			result.Status = "failed"
			result.Reason = fmt.Sprintf("Insert error: %v", err)
			summary.Failed++
		} else {
			result.Status = "created"
			result.QuestionID = questionID
			summary.Created++
		}

		summary.Results = append(summary.Results, result)
	}

	return c.JSON(fiber.Map{"summary": summary})
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func escapeRegex(s string) string {
	special := []string{`\`, `(`, `)`, `+`, `*`, `?`, `[`, `]`, `{`, `}`, `^`, `$`, `|`, `.`}
	for _, ch := range special {
		s = strings.ReplaceAll(s, ch, `\`+ch)
	}
	return s
}
