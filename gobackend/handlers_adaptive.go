package main

import (
	"context"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func getAdaptiveSettings() AdaptiveSettings {
	var settings AdaptiveSettings
	err := getCollection("adaptive_settings").FindOne(context.Background(), bson.M{}).Decode(&settings)
	if err != nil {
		settings = AdaptiveSettings{
			AdaptiveEnabled:   true,
			RoutingModel:      "GRE-style Section-Level Adaptive Testing (MST-inspired)",
			VerbalEasyMax:     4,
			VerbalMediumMax:   7,
			QuantEasyMax:      4,
			QuantMediumMax:    7,
			Section1Count:     12,
			Section2Count:     12,
			ModuleLowerLabel:  "Lower-level module",
			ModuleMediumLabel: "Medium-level module",
			ModuleHigherLabel: "Higher-level module",
			UpdatedAt:         time.Now(),
		}
		getCollection("adaptive_settings").InsertOne(context.Background(), settings)
	} else if settings.VerbalEasyMax == 5 || settings.Section2Count == 15 {
		// Migration: Update existing DB document to official 12-question thresholds (0-4 Easy, 5-7 Medium, >=8 Hard)
		settings.VerbalEasyMax = 4
		settings.VerbalMediumMax = 7
		settings.QuantEasyMax = 4
		settings.QuantMediumMax = 7
		settings.Section1Count = 12
		settings.Section2Count = 12
		settings.UpdatedAt = time.Now()
		getCollection("adaptive_settings").UpdateOne(
			context.Background(),
			bson.M{"_id": settings.ID},
			bson.M{"$set": bson.M{
				"verbal_easy_max":   4,
				"verbal_medium_max": 7,
				"quant_easy_max":    4,
				"quant_medium_max":  7,
				"section1_count":    12,
				"section2_count":    12,
				"updated_at":        settings.UpdatedAt,
			}},
		)
	}
	return settings
}

func determineDifficulty(subject string, score int, settings AdaptiveSettings) string {
	switch subject {
	case "Verbal":
		if score <= settings.VerbalEasyMax {
			return "Easy"
		} else if score <= settings.VerbalMediumMax {
			return "Medium"
		}
		return "Hard"
	case "Quant":
		if score <= settings.QuantEasyMax {
			return "Easy"
		} else if score <= settings.QuantMediumMax {
			return "Medium"
		}
		return "Hard"
	default:
		return "Medium"
	}
}

func handleSubmitSection(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid allocation ID"})
	}

	var req SubmitSectionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	userIDStr, ok := c.Locals("userID").(string)
	if !ok || userIDStr == "" {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	userID, err := primitive.ObjectIDFromHex(userIDStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	var alloc TestAllocation
	err = getCollection("test_allocations").FindOne(context.Background(), bson.M{"_id": id}).Decode(&alloc)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Allocation not found"})
	}

	if alloc.StudentID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Not your test allocation"})
	}

	if req.SectionIndex < 0 || req.SectionIndex >= len(alloc.Sections) {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid section index"})
	}

	section := alloc.Sections[req.SectionIndex]

	// IDEMPOTENCY: If this section was already submitted (has SubmittedAt), return existing result without re-allocating
	if section.SubmittedAt != nil {
		response := fiber.Map{
			"section_index":     req.SectionIndex,
			"section_name":      section.Name,
			"score":             section.Score,
			"total":             section.TotalQuestions,
			"already_submitted": true,
			"message":           "Section already submitted.",
		}
		if section.SelectedModule != "" && req.SectionIndex+1 < len(alloc.Sections) {
			response["adaptive"] = fiber.Map{
				"subject":             section.Subject,
				"difficulty":          section.SelectedDifficulty,
				"selected_module":     section.SelectedModule,
				"questions_allocated": len(alloc.Sections[req.SectionIndex+1].QuestionIDs),
			}
		}
		return c.JSON(response)
	}

	// Only Verbal Section 1 (index 1) and Quant Section 1 (index 3) trigger adaptive selection in FULL_LENGTH test
	isAdaptiveTrigger := alloc.TestType == "FULL_LENGTH" &&
		((section.Subject == "Verbal" && req.SectionIndex == 1) ||
			(section.Subject == "Quant" && req.SectionIndex == 3))

	// Calculate score and save responses
	correctCount := 0
	now := time.Now()
	responseDocs := []interface{}{}

	for _, resp := range req.Responses {
		isCorrect := checkAnswerCorrect(section.Subject, resp.QuestionID, resp.StudentAnswer)
		if isCorrect {
			correctCount++
		}
		responseDocs = append(responseDocs, StudentResponse{
			AllocationID:  id,
			StudentID:     alloc.StudentID,
			SectionIndex:  req.SectionIndex,
			QuestionID:    resp.QuestionID,
			StudentAnswer: resp.StudentAnswer,
			IsCorrect:     isCorrect,
			SubmittedAt:   now,
		})
	}

	if len(responseDocs) > 0 {
		getCollection("student_responses").InsertMany(context.Background(), responseDocs)
	}

	// Update section with scoring metadata
	alloc.Sections[req.SectionIndex].Score = correctCount
	alloc.Sections[req.SectionIndex].TotalQuestions = len(req.Responses)
	alloc.Sections[req.SectionIndex].SubmittedAt = &now

	response := fiber.Map{
		"section_index": req.SectionIndex,
		"section_name":  section.Name,
		"score":         correctCount,
		"total":         len(req.Responses),
	}

	if isAdaptiveTrigger {
		settings := getAdaptiveSettings()

		if !settings.AdaptiveEnabled {
			// Adaptive disabled — select medium-difficulty Section 2
			difficulty := "Medium"
			moduleLabel := settings.ModuleMediumLabel
			response["adaptive"] = fiber.Map{
				"subject":         section.Subject,
				"difficulty":      difficulty,
				"selected_module": moduleLabel,
				"note":            "Adaptive routing disabled. Defaulted to medium module.",
			}
			// Still need to allocate Section 2 with medium questions
			section2Index := findSection2Index(alloc.Sections, section.Subject, req.SectionIndex)
			if section2Index == -1 {
				return c.Status(500).JSON(fiber.Map{"error": "Could not find Section 2 for " + section.Subject})
			}
			excludeIDs := getAllQuestionIDs(alloc.Sections)
			selector := NewQuestionSelector(alloc.StudentID)
			section2QuestionIDs, err := selector.SelectAdaptiveModule(section.Subject, difficulty, settings.Section2Count, excludeIDs)
			if err != nil {
				return c.Status(500).JSON(fiber.Map{"error": "Failed to select Section 2 module: " + err.Error()})
			}
			alloc.Sections[section2Index].QuestionIDs = section2QuestionIDs
			alloc.Sections[section2Index].Difficulty = difficulty
			alloc.Sections[section2Index].IsSelected = true
			recordQuestionHistory(alloc.StudentID, alloc.TestID, section2QuestionIDs, section.Subject)
			alloc.QuestionIDs = append(alloc.QuestionIDs, section2QuestionIDs...)
		} else {
			difficulty := determineDifficulty(section.Subject, correctCount, settings)
			var moduleLabel string
			switch difficulty {
			case "Easy":
				moduleLabel = settings.ModuleLowerLabel
			case "Medium":
				moduleLabel = settings.ModuleMediumLabel
			case "Hard":
				moduleLabel = settings.ModuleHigherLabel
			}

			// Store routing metadata on Section 1
			alloc.Sections[req.SectionIndex].SelectedModule = moduleLabel
			alloc.Sections[req.SectionIndex].SelectedDifficulty = difficulty

			// Find the Section 2 index for this subject
			section2Index := findSection2Index(alloc.Sections, section.Subject, req.SectionIndex)
			if section2Index == -1 {
				return c.Status(500).JSON(fiber.Map{"error": "Could not find Section 2 for " + section.Subject})
			}

			// Collect all question IDs already used in this test attempt to prevent duplicates
			excludeIDs := getAllQuestionIDs(alloc.Sections)

			// Select adaptive module for Section 2 (excluding already-used questions)
			selector := NewQuestionSelector(alloc.StudentID)
			section2QuestionIDs, err := selector.SelectAdaptiveModule(section.Subject, difficulty, settings.Section2Count, excludeIDs)
			if err != nil {
				return c.Status(500).JSON(fiber.Map{"error": "Failed to select adaptive module: " + err.Error()})
			}

			// Update Section 2 in allocation — permanently locked
			alloc.Sections[section2Index].QuestionIDs = section2QuestionIDs
			alloc.Sections[section2Index].Difficulty = difficulty
			alloc.Sections[section2Index].IsSelected = true

			// Record question history for Section 2
			recordQuestionHistory(alloc.StudentID, alloc.TestID, section2QuestionIDs, section.Subject)

			// Add Section 2 question IDs to allocation's QuestionIDs
			alloc.QuestionIDs = append(alloc.QuestionIDs, section2QuestionIDs...)

			response["adaptive"] = fiber.Map{
				"subject":             section.Subject,
				"difficulty":          difficulty,
				"selected_module":     moduleLabel,
				"section2_index":      section2Index,
				"questions_allocated": len(section2QuestionIDs),
				"routing_model":       settings.RoutingModel,
			}
		}
	}

	// If next section exists, start its timestamp
	if req.SectionIndex+1 < len(alloc.Sections) {
		if alloc.Sections[req.SectionIndex+1].StartedAt == nil {
			alloc.Sections[req.SectionIndex+1].StartedAt = &now
		}
	}

	// Check if all sections are submitted
	allCompleted := true
	for _, s := range alloc.Sections {
		if s.SubmittedAt == nil {
			allCompleted = false
			break
		}
	}
	if allCompleted {
		alloc.Status = "COMPLETED"
	}

	// Atomically save updated allocation
	getCollection("test_allocations").UpdateOne(context.Background(),
		bson.M{"_id": id},
		bson.M{"$set": bson.M{
			"sections":     alloc.Sections,
			"question_ids": alloc.QuestionIDs,
			"status":       alloc.Status,
			"updated_at":   now,
		}},
	)

	return c.JSON(response)
}

func findSection2Index(sections []TestSection, subject string, afterIndex int) int {
	for i, s := range sections {
		if s.Subject == subject && !s.IsSelected && i > afterIndex {
			return i
		}
	}
	return -1
}

func getAllQuestionIDs(sections []TestSection) []string {
	ids := []string{}
	for _, s := range sections {
		ids = append(ids, s.QuestionIDs...)
	}
	return ids
}

func checkAnswerCorrect(subject string, questionID string, studentAnswer string) bool {
	colName := subjectToCollection(subject)
	if colName == "" {
		return false
	}

	var question Question
	err := getCollection(colName).FindOne(context.Background(), bson.M{"question_id": questionID}).Decode(&question)
	if err != nil {
		return false
	}

	studentAnswer = strings.TrimSpace(studentAnswer)
	if studentAnswer == "" {
		return false
	}

	if question.IsMultiAnswer || len(question.CorrectAnswers) > 1 {
		correctSet := make(map[string]bool)
		for _, ca := range question.CorrectAnswers {
			val := ca.OptionLabel
			if val == "" {
				val = ca.Value
			}
			if val != "" {
				correctSet[strings.TrimSpace(val)] = true
			}
		}

		studentParts := strings.Split(studentAnswer, ",")
		studentSet := make(map[string]bool)
		for _, p := range studentParts {
			pClean := strings.TrimSpace(p)
			if pClean != "" {
				studentSet[pClean] = true
			}
		}

		if len(correctSet) != len(studentSet) || len(correctSet) == 0 {
			return false
		}
		for k := range correctSet {
			if !studentSet[k] {
				return false
			}
		}
		return true
	}

	for _, ca := range question.CorrectAnswers {
		val := ca.OptionLabel
		if val == "" {
			val = ca.Value
		}
		cleanVal := strings.TrimSpace(val)
		if strings.EqualFold(cleanVal, studentAnswer) {
			return true
		}
		// Numerical float comparison for Numeric Entry
		if question.QuestionType == "NUMERIC_ENTRY" || question.AnswerFormat == "NUMERIC_ENTRY" {
			vFloat, err1 := strconv.ParseFloat(cleanVal, 64)
			aFloat, err2 := strconv.ParseFloat(studentAnswer, 64)
			if err1 == nil && err2 == nil && math.Abs(vFloat-aFloat) < 1e-6 {
				return true
			}
		}
	}
	return false
}

func handleGetAdaptiveSettings(c *fiber.Ctx) error {
	settings := getAdaptiveSettings()
	return c.JSON(settings)
}

func handleUpdateAdaptiveSettings(c *fiber.Ctx) error {
	var req AdaptiveSettings
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.VerbalEasyMax < 0 || req.VerbalMediumMax < req.VerbalEasyMax {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid verbal thresholds: easy_max must be >= 0 and medium_max must be >= easy_max"})
	}
	if req.QuantEasyMax < 0 || req.QuantMediumMax < req.QuantEasyMax {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid quant thresholds: easy_max must be >= 0 and medium_max must be >= easy_max"})
	}
	if req.Section1Count <= 0 || req.Section2Count <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Section counts must be positive"})
	}
	if req.RoutingModel == "" {
		req.RoutingModel = "GRE-style Section-Level Adaptive Testing (MST-inspired)"
	}
	if req.ModuleLowerLabel == "" {
		req.ModuleLowerLabel = "Lower-level module"
	}
	if req.ModuleMediumLabel == "" {
		req.ModuleMediumLabel = "Medium-level module"
	}
	if req.ModuleHigherLabel == "" {
		req.ModuleHigherLabel = "Higher-level module"
	}

	req.UpdatedAt = time.Now()

	// Upsert: if settings doc exists, update it; otherwise insert
	filter := bson.M{}
	update := bson.M{"$set": bson.M{
		"adaptive_enabled":    req.AdaptiveEnabled,
		"routing_model":       req.RoutingModel,
		"verbal_easy_max":     req.VerbalEasyMax,
		"verbal_medium_max":   req.VerbalMediumMax,
		"quant_easy_max":      req.QuantEasyMax,
		"quant_medium_max":    req.QuantMediumMax,
		"section1_count":      req.Section1Count,
		"section2_count":      req.Section2Count,
		"module_lower_label":  req.ModuleLowerLabel,
		"module_medium_label": req.ModuleMediumLabel,
		"module_higher_label": req.ModuleHigherLabel,
		"updated_at":          req.UpdatedAt,
	}}

	_, err := getCollection("adaptive_settings").UpdateOne(context.Background(), filter, update)
	if err != nil {
		_, err = getCollection("adaptive_settings").InsertOne(context.Background(), req)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to save settings"})
		}
	}

	return c.JSON(fiber.Map{"message": "Adaptive settings updated", "settings": req})
}
