package main

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func handleStudentStats(c *fiber.Ctx) error {
	db := getDB()
	quant, _ := db.Collection("quant_questions").CountDocuments(context.Background(), bson.M{"is_active": true})
	verbal, _ := db.Collection("verbal_questions").CountDocuments(context.Background(), bson.M{"is_active": true})
	awa, _ := db.Collection("awa_questions").CountDocuments(context.Background(), bson.M{"is_active": true})
	return c.JSON(fiber.Map{
		"quant": quant, "verbal": verbal, "awa": awa,
		"total": quant + verbal + awa,
	})
}

func handleStudentAvailableTests(c *fiber.Ctx) error {
	userID, err := primitive.ObjectIDFromHex(c.Locals("userID").(string))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	cursor, err := getCollection("test_allocations").Find(context.Background(), bson.M{
		"student_id": userID,
		"status":     bson.M{"$in": []string{"SCHEDULED", "IN_PROGRESS"}},
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch tests"})
	}
	defer cursor.Close(context.Background())

	var allocations []TestAllocation
	if err := cursor.All(context.Background(), &allocations); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to decode tests"})
	}

	var tests []fiber.Map
	for _, alloc := range allocations {
		// Calculate duration based on test type
		var durationMins int
		switch alloc.TestType {
		case "FULL_LENGTH":
			durationMins = 120
		case "SECTIONAL":
			durationMins = 40
		case "TOPIC_WISE":
			durationMins = 20
		default:
			durationMins = 120
		}

		endTime := alloc.ScheduledAt.Add(time.Duration(durationMins) * time.Minute)
		if !alloc.ExpiresAt.IsZero() {
			endTime = alloc.ExpiresAt
		}

		now := time.Now()
		isExpired := now.After(endTime)

		// Auto-expire scheduled tests in database if test window has passed
		if isExpired && alloc.Status == "SCHEDULED" {
			alloc.Status = "EXPIRED"
			getCollection("test_allocations").UpdateOne(
				context.Background(),
				bson.M{"_id": alloc.ID},
				bson.M{"$set": bson.M{"status": "EXPIRED", "updated_at": now}},
			)
		}

		// Determine if test can be started (scheduled time arrived AND before end time)
		canStart := alloc.Status == "SCHEDULED" && now.After(alloc.ScheduledAt) && !isExpired

		// Determine button state
		buttonState := "disabled"
		buttonLabel := "Not Started Yet"
		if alloc.Status == "IN_PROGRESS" {
			buttonState = "continue"
			buttonLabel = "Continue"
		} else if alloc.Status == "EXPIRED" || isExpired {
			buttonState = "expired"
			buttonLabel = "Expired"
		} else if canStart {
			buttonState = "start"
			buttonLabel = "Start Test"
		}

		tests = append(tests, fiber.Map{
			"_id":           alloc.ID,
			"test_id":       alloc.TestID,
			"test_type":     alloc.TestType,
			"test_title":    alloc.TestTitle,
			"status":        alloc.Status,
			"scheduled_at":  alloc.ScheduledAt,
			"expires_at":    alloc.ExpiresAt,
			"end_time":      endTime,
			"duration_mins": durationMins,
			"can_start":     canStart,
			"button_state":  buttonState,
			"button_label":  buttonLabel,
			"created_at":    alloc.CreatedAt,
		})
	}

	// Sort: IN_PROGRESS first, then SCHEDULED by soonest scheduled_at
	sort.Slice(tests, func(i, j int) bool {
		si, _ := tests[i]["status"].(string)
		sj, _ := tests[j]["status"].(string)
		if si != sj {
			return si == "IN_PROGRESS"
		}
		ai, _ := tests[i]["scheduled_at"].(time.Time)
		aj, _ := tests[j]["scheduled_at"].(time.Time)
		return ai.Before(aj)
	})

	return c.JSON(fiber.Map{
		"tests":       tests,
		"total":       len(tests),
		"scheduled":   countStatus(tests, "SCHEDULED"),
		"in_progress": countStatus(tests, "IN_PROGRESS"),
	})
}

func countStatus(tests []fiber.Map, status string) int {
	count := 0
	for _, t := range tests {
		if s, ok := t["status"].(string); ok && s == status {
			count++
		}
	}
	return count
}

func handleStudentDashboard(c *fiber.Ctx) error {
	userID, err := primitive.ObjectIDFromHex(c.Locals("userID").(string))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	// Fetch all allocations for this student
	cursor, err := getCollection("test_allocations").Find(context.Background(), bson.M{"student_id": userID})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch allocations"})
	}
	defer cursor.Close(context.Background())

	var allocations []TestAllocation
	if err := cursor.All(context.Background(), &allocations); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to decode allocations"})
	}

	// Categorize allocations
	var upcoming []fiber.Map
	var completed []fiber.Map
	var inProgress []fiber.Map
	var expired []fiber.Map

	testsTaken := 0
	totalCorrect := 0
	totalQuestions := 0
	verbalCorrect := 0
	verbalTotal := 0
	quantCorrect := 0
	quantTotal := 0
	awaAnswered := 0
	awaTotal := 0

	for _, alloc := range allocations {
		entry := fiber.Map{
			"_id":          alloc.ID,
			"test_id":      alloc.TestID,
			"test_type":    alloc.TestType,
			"test_title":   alloc.TestTitle,
			"status":       alloc.Status,
			"scheduled_at": alloc.ScheduledAt,
			"expires_at":   alloc.ExpiresAt,
			"created_at":   alloc.CreatedAt,
		}

		// Calculate section scores + per-subject breakdown for this test
		sectionScores := []fiber.Map{}
		allocTotalCorrect := 0
		allocTotalQuestions := 0
		allocVerbalCorrect := 0
		allocVerbalTotal := 0
		allocQuantCorrect := 0
		allocQuantTotal := 0
		allocAwaCount := 0
		for _, sec := range alloc.Sections {
			if sec.Score > 0 || sec.TotalQuestions > 0 {
				sectionScores = append(sectionScores, fiber.Map{
					"name":                sec.Name,
					"subject":             sec.Subject,
					"score":               sec.Score,
					"total_questions":     sec.TotalQuestions,
					"selected_module":     sec.SelectedModule,
					"selected_difficulty": sec.SelectedDifficulty,
				})
				allocTotalCorrect += sec.Score
				allocTotalQuestions += sec.TotalQuestions

				if sec.Subject == "Verbal" {
					verbalCorrect += sec.Score
					verbalTotal += sec.TotalQuestions
					allocVerbalCorrect += sec.Score
					allocVerbalTotal += sec.TotalQuestions
				} else if sec.Subject == "Quant" {
					quantCorrect += sec.Score
					quantTotal += sec.TotalQuestions
					allocQuantCorrect += sec.Score
					allocQuantTotal += sec.TotalQuestions
				} else if sec.Subject == "AWA" {
					awaAnswered += sec.TotalQuestions
					awaTotal += sec.TotalQuestions
					allocAwaCount += sec.TotalQuestions
				}
			}
		}
		entry["section_scores"] = sectionScores
		entry["total_correct"] = allocTotalCorrect
		entry["total_questions"] = allocTotalQuestions

		// Per-test subject breakdown for filter
		allocVerbalAcc := 0.0
		if allocVerbalTotal > 0 {
			allocVerbalAcc = float64(allocVerbalCorrect) / float64(allocVerbalTotal) * 100
		}
		allocQuantAcc := 0.0
		if allocQuantTotal > 0 {
			allocQuantAcc = float64(allocQuantCorrect) / float64(allocQuantTotal) * 100
		}
		allocVerbalScore := 130
		if allocVerbalTotal > 0 {
			allocVerbalScore = 130 + int(allocVerbalAcc*40/100)
			if allocVerbalScore > 170 {
				allocVerbalScore = 170
			}
		}
		allocQuantScore := 130
		if allocQuantTotal > 0 {
			allocQuantScore = 130 + int(allocQuantAcc*40/100)
			if allocQuantScore > 170 {
				allocQuantScore = 170
			}
		}
		entry["subject_breakdown"] = fiber.Map{
			"verbal_score":   allocVerbalScore,
			"quant_score":    allocQuantScore,
			"overall_score":  allocVerbalScore + allocQuantScore,
			"verbal_correct": allocVerbalCorrect,
			"verbal_total":   allocVerbalTotal,
			"quant_correct":  allocQuantCorrect,
			"quant_total":    allocQuantTotal,
			"awa_count":      allocAwaCount,
			"accuracy": fmt.Sprintf("%.1f", func() float64 {
				if allocTotalQuestions > 0 {
					return float64(allocTotalCorrect) / float64(allocTotalQuestions) * 100
				}
				return 0
			}()),
		}

		switch alloc.Status {
		case "SCHEDULED":
			if alloc.ScheduledAt.After(time.Now()) {
				upcoming = append(upcoming, entry)
			} else {
				expired = append(expired, entry)
			}
		case "IN_PROGRESS":
			inProgress = append(inProgress, entry)
		case "COMPLETED":
			completed = append(completed, entry)
			testsTaken++
			totalCorrect += allocTotalCorrect
			totalQuestions += allocTotalQuestions
		case "EXPIRED":
			expired = append(expired, entry)
		}
	}

	// Sort upcoming by scheduled_at (soonest first)
	sort.Slice(upcoming, func(i, j int) bool {
		ai, _ := upcoming[i]["scheduled_at"].(time.Time)
		aj, _ := upcoming[j]["scheduled_at"].(time.Time)
		return ai.Before(aj)
	})

	// Sort completed by created_at (most recent first)
	sort.Slice(completed, func(i, j int) bool {
		ci, _ := completed[i]["created_at"].(time.Time)
		cj, _ := completed[j]["created_at"].(time.Time)
		return ci.After(cj)
	})

	// Calculate estimated GRE scores
	verbalAccuracy := 0.0
	if verbalTotal > 0 {
		verbalAccuracy = float64(verbalCorrect) / float64(verbalTotal) * 100
	}
	quantAccuracy := 0.0
	if quantTotal > 0 {
		quantAccuracy = float64(quantCorrect) / float64(quantTotal) * 100
	}
	verbalScore := 130
	if verbalTotal > 0 {
		verbalScore = 130 + int(verbalAccuracy*40/100)
	}
	if verbalScore < 130 {
		verbalScore = 130
	} else if verbalScore > 170 {
		verbalScore = 170
	}

	quantScore := 130
	if quantTotal > 0 {
		quantScore = 130 + int(quantAccuracy*40/100)
	}
	if quantScore < 130 {
		quantScore = 130
	} else if quantScore > 170 {
		quantScore = 170
	}

	overallScore := verbalScore + quantScore
	if overallScore < 260 {
		overallScore = 260
	} else if overallScore > 340 {
		overallScore = 340
	}

	overallAccuracy := 0.0
	if totalQuestions > 0 {
		overallAccuracy = float64(totalCorrect) / float64(totalQuestions) * 100
	}

	// Build recent attempts (last 5 completed)
	recentAttempts := []fiber.Map{}
	for i := 0; i < len(completed) && i < 5; i++ {
		recentAttempts = append(recentAttempts, completed[i])
	}

	// Calculate best score, avg score, and score trend
	bestScore := 0
	sumScores := 0
	scoreTrend := []fiber.Map{}
	for i := len(completed) - 1; i >= 0; i-- {
		c := completed[i]
		sb, _ := c["subject_breakdown"].(fiber.Map)
		overall, _ := sb["overall_score"].(int)
		if overall > bestScore {
			bestScore = overall
		}
		sumScores += overall
		title, _ := c["test_title"].(string)
		created, _ := c["created_at"].(time.Time)
		scoreTrend = append(scoreTrend, fiber.Map{
			"test_title":   title,
			"score":        overall,
			"verbal_score": sb["verbal_score"],
			"quant_score":  sb["quant_score"],
			"created_at":   created,
		})
	}
	avgScore := 0
	if testsTaken > 0 {
		avgScore = sumScores / testsTaken
	}

	// Next upcoming test (for the hero card)
	var nextTest fiber.Map
	if len(upcoming) > 0 {
		nextTest = upcoming[0]
	} else if len(inProgress) > 0 {
		nextTest = inProgress[0]
	}

	return c.JSON(fiber.Map{
		"next_test":         nextTest,
		"upcoming_tests":    upcoming,
		"in_progress_tests": inProgress,
		"recent_attempts":   recentAttempts,
		"expired_tests":     expired,
		"score_prediction": fiber.Map{
			"verbal_score":     verbalScore,
			"quant_score":      quantScore,
			"overall_score":    overallScore,
			"verbal_accuracy":  fmt.Sprintf("%.1f", verbalAccuracy),
			"quant_accuracy":   fmt.Sprintf("%.1f", quantAccuracy),
			"overall_accuracy": fmt.Sprintf("%.1f", overallAccuracy),
		},
		"subject_stats": fiber.Map{
			"verbal_answered": verbalTotal,
			"verbal_total":    verbalTotal,
			"quant_answered":  quantTotal,
			"quant_total":     quantTotal,
			"awa_answered":    awaAnswered,
			"awa_total":       awaTotal,
		},
		"practice_stats": fiber.Map{
			"tests_taken":      testsTaken,
			"total_correct":    totalCorrect,
			"total_questions":  totalQuestions,
			"overall_accuracy": fmt.Sprintf("%.1f", overallAccuracy),
			"best_score":       bestScore,
			"avg_score":        avgScore,
		},
		"score_trend":       scoreTrend,
		"completed_tests":   completed,
		"upcoming_count":    len(upcoming),
		"completed_count":   testsTaken,
		"expired_count":     len(expired),
		"in_progress_count": len(inProgress),
	})
}

func handleStartTest(c *fiber.Ctx) error {
	userID, err := primitive.ObjectIDFromHex(c.Locals("userID").(string))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid allocation ID"})
	}

	var alloc TestAllocation
	err = getCollection("test_allocations").FindOne(context.Background(), bson.M{"_id": id}).Decode(&alloc)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Allocation not found"})
	}

	if alloc.StudentID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Not your test"})
	}

	if alloc.Status == "COMPLETED" || alloc.Status == "TERMINATED" || alloc.Status == "MALPRACTICE" || alloc.Status == "EXPIRED" {
		return c.Status(403).JSON(fiber.Map{"error": "This test cannot be started or resumed. Status: " + alloc.Status})
	}

	now := time.Now()

	if alloc.Status == "SCHEDULED" {
		if now.Before(alloc.ScheduledAt) {
			return c.Status(400).JSON(fiber.Map{"error": "Test not yet available. Wait for scheduled time."})
		}
		duration := alloc.ExpiresAt.Sub(alloc.ScheduledAt)
		noStartDeadline := alloc.ScheduledAt.Add(duration / 2)
		if now.After(noStartDeadline) {
			getCollection("test_allocations").UpdateOne(context.Background(),
				bson.M{"_id": id},
				bson.M{"$set": bson.M{"status": "EXPIRED", "updated_at": now}})
			return c.Status(400).JSON(fiber.Map{"error": "Test has expired - start deadline passed"})
		}

		if len(alloc.Sections) > 0 && alloc.Sections[0].StartedAt == nil {
			alloc.Sections[0].StartedAt = &now
		}
		getCollection("test_allocations").UpdateOne(context.Background(),
			bson.M{"_id": id},
			bson.M{"$set": bson.M{"status": "IN_PROGRESS", "sections": alloc.Sections, "updated_at": now}})
		alloc.Status = "IN_PROGRESS"
	} else if alloc.Status != "IN_PROGRESS" {
		return c.Status(400).JSON(fiber.Map{"error": "Test cannot be started. Current status: " + alloc.Status})
	}

	return c.JSON(fiber.Map{
		"message":   "Test started",
		"status":    alloc.Status,
		"test_id":   alloc.TestID,
		"test_type": alloc.TestType,
		"sections":  alloc.Sections,
	})
}

func handleGetTestQuestions(c *fiber.Ctx) error {
	userID, err := primitive.ObjectIDFromHex(c.Locals("userID").(string))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid allocation ID"})
	}

	var alloc TestAllocation
	err = getCollection("test_allocations").FindOne(context.Background(), bson.M{"_id": id}).Decode(&alloc)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Allocation not found"})
	}

	if alloc.StudentID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Not your test"})
	}

	if alloc.Status == "TERMINATED" || alloc.Status == "MALPRACTICE" || alloc.Status == "EXPIRED" {
		return c.Status(403).JSON(fiber.Map{"error": "This test session is locked. Status: " + alloc.Status})
	}

	if alloc.Status != "IN_PROGRESS" && alloc.Status != "COMPLETED" {
		return c.Status(400).JSON(fiber.Map{"error": "Test must be started first"})
	}

	draftAnswers := make(map[string]string)
	draftCursor, err := getCollection("draft_answers").Find(context.Background(), bson.M{"allocation_id": id})
	if err == nil {
		var drafts []struct {
			QuestionID string `bson:"question_id"`
			Answer     string `bson:"answer"`
		}
		if draftCursor.All(context.Background(), &drafts) == nil {
			for _, d := range drafts {
				draftAnswers[d.QuestionID] = d.Answer
			}
		}
		draftCursor.Close(context.Background())
	}

	questionMap := make(map[string]Question)
	for _, section := range alloc.Sections {
		if len(section.QuestionIDs) == 0 {
			continue
		}
		colName := subjectToCollection(section.Subject)
		if colName == "" {
			continue
		}
		filter := bson.M{"question_id": bson.M{"$in": section.QuestionIDs}}
		cursor, err := getCollection(colName).Find(context.Background(), filter)
		if err != nil {
			continue
		}
		var questions []Question
		if err := cursor.All(context.Background(), &questions); err == nil {
			for _, q := range questions {
				q.CorrectAnswers = nil
				q.Explanation = ""
				questionMap[q.QuestionID] = q
			}
		}
		cursor.Close(context.Background())
	}

	type QuestionWithSavedAnswer struct {
		Question    `bson:",inline"`
		SavedAnswer string `json:"saved_answer"`
	}

	type SectionWithQuestions struct {
		Name               string                    `json:"name"`
		Subject            string                    `json:"subject"`
		Difficulty         string                    `json:"difficulty"`
		DurationMins       int                       `json:"duration_mins"`
		QuestionIDs        []string                  `json:"question_ids"`
		IsSelected         bool                      `json:"is_selected"`
		SelectedModule     string                    `json:"selected_module"`
		SelectedDifficulty string                    `json:"selected_difficulty"`
		SubmittedAt        *time.Time                `json:"submitted_at"`
		StartedAt          *time.Time                `json:"started_at"`
		Score              int                       `json:"score"`
		TotalQuestions     int                       `json:"total_questions"`
		Questions          []QuestionWithSavedAnswer `json:"questions"`
	}

	var sectionsResult []SectionWithQuestions
	for _, sec := range alloc.Sections {
		sq := SectionWithQuestions{
			Name:               sec.Name,
			Subject:            sec.Subject,
			Difficulty:         sec.Difficulty,
			DurationMins:       sec.DurationMins,
			QuestionIDs:        sec.QuestionIDs,
			IsSelected:         sec.IsSelected,
			SelectedModule:     sec.SelectedModule,
			SelectedDifficulty: sec.SelectedDifficulty,
			SubmittedAt:        sec.SubmittedAt,
			StartedAt:          sec.StartedAt,
			Score:              sec.Score,
			TotalQuestions:     sec.TotalQuestions,
		}
		for _, qid := range sec.QuestionIDs {
			if q, ok := questionMap[qid]; ok {
				sq.Questions = append(sq.Questions, QuestionWithSavedAnswer{Question: q, SavedAnswer: draftAnswers[qid]})
			}
		}
		if sq.Questions == nil {
			sq.Questions = []QuestionWithSavedAnswer{}
		}
		sectionsResult = append(sectionsResult, sq)
	}

	return c.JSON(fiber.Map{
		"allocation_id": alloc.ID,
		"test_id":       alloc.TestID,
		"test_type":     alloc.TestType,
		"test_title":    alloc.TestTitle,
		"status":        alloc.Status,
		"sections":      sectionsResult,
	})
}

func handleSubmitExam(c *fiber.Ctx) error {
	userID, err := primitive.ObjectIDFromHex(c.Locals("userID").(string))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid allocation ID"})
	}

	var alloc TestAllocation
	err = getCollection("test_allocations").FindOne(context.Background(), bson.M{"_id": id}).Decode(&alloc)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Allocation not found"})
	}

	if alloc.StudentID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Not your test"})
	}

	if alloc.Status == "COMPLETED" {
		return c.JSON(fiber.Map{"message": "Already submitted", "status": "COMPLETED"})
	}

	if alloc.Status != "IN_PROGRESS" {
		return c.Status(400).JSON(fiber.Map{"error": "Test must be in progress to submit"})
	}

	now := time.Now()
	totalScore := 0
	totalQuestions := 0

	for i := range alloc.Sections {
		if alloc.Sections[i].SubmittedAt == nil {
			alloc.Sections[i].SubmittedAt = &now
		}
		totalScore += alloc.Sections[i].Score
		totalQuestions += alloc.Sections[i].TotalQuestions
	}

	getCollection("test_allocations").UpdateOne(context.Background(),
		bson.M{"_id": id},
		bson.M{"$set": bson.M{
			"status":     "COMPLETED",
			"sections":   alloc.Sections,
			"updated_at": now,
		}})

	return c.JSON(fiber.Map{
		"message":         "Test submitted successfully",
		"status":          "COMPLETED",
		"total_score":     totalScore,
		"total_questions": totalQuestions,
	})
}

type ViolationLog struct {
	AllocationID  primitive.ObjectID `json:"allocation_id" bson:"allocation_id"`
	StudentID     primitive.ObjectID `json:"student_id" bson:"student_id"`
	ViolationType string             `json:"violation_type" bson:"violation_type"`
	Details       string             `json:"details" bson:"details"`
	Severity      string             `json:"severity" bson:"severity"`
	Timestamp     time.Time          `json:"timestamp" bson:"timestamp"`
}

const MaxViolationsAllowed = 7

func handleLogViolation(c *fiber.Ctx) error {
	userID, err := primitive.ObjectIDFromHex(c.Locals("userID").(string))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid allocation ID"})
	}

	var req struct {
		ViolationType string `json:"violation_type"`
		Details       string `json:"details"`
		Severity      string `json:"severity"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.ViolationType == "" {
		return c.Status(400).JSON(fiber.Map{"error": "violation_type is required"})
	}

	if req.Severity == "" {
		req.Severity = "medium"
	}

	var alloc TestAllocation
	err = getCollection("test_allocations").FindOne(context.Background(), bson.M{"_id": id}).Decode(&alloc)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Allocation not found"})
	}

	if alloc.StudentID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Not your test"})
	}

	if alloc.Status == "TERMINATED" || alloc.Status == "MALPRACTICE" || alloc.Status == "COMPLETED" {
		return c.JSON(fiber.Map{"message": "Session already ended", "status": alloc.Status, "terminated": true, "violation_count": alloc.ViolationCount})
	}

	now := time.Now()

	violation := ViolationLog{
		AllocationID:  id,
		StudentID:     userID,
		ViolationType: req.ViolationType,
		Details:       req.Details,
		Severity:      req.Severity,
		Timestamp:     now,
	}
	getCollection("proctoring_violations").InsertOne(context.Background(), violation)
	getCollection("malpractice_logs").InsertOne(context.Background(), violation)

	updateRes := getCollection("test_allocations").FindOneAndUpdate(
		context.Background(),
		bson.M{"_id": id},
		bson.M{"$inc": bson.M{"violation_count": 1}, "$set": bson.M{"updated_at": now}},
	)

	var updated TestAllocation
	updateRes.Decode(&updated)
	newCount := updated.ViolationCount + 1

	terminated := false
	if newCount >= MaxViolationsAllowed {
		terminated = true
		getCollection("test_allocations").UpdateOne(context.Background(),
			bson.M{"_id": id},
			bson.M{"$set": bson.M{"status": "MALPRACTICE", "malpractice_at": now, "updated_at": now}})
	}

	return c.JSON(fiber.Map{
		"message":         "Violation logged",
		"type":            req.ViolationType,
		"violation_count": newCount,
		"max_allowed":     MaxViolationsAllowed,
		"terminated":      terminated,
	})
}

func handleStudentHistory(c *fiber.Ctx) error {
	userID, err := primitive.ObjectIDFromHex(c.Locals("userID").(string))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	cursor, err := getCollection("test_allocations").Find(context.Background(), bson.M{
		"student_id": userID,
		"status":     bson.M{"$in": []string{"COMPLETED", "MALPRACTICE", "TERMINATED"}},
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch history"})
	}
	defer cursor.Close(context.Background())

	var allocations []TestAllocation
	if err := cursor.All(context.Background(), &allocations); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to decode allocations"})
	}

	history := []fiber.Map{}
	for _, alloc := range allocations {
		allocTotalCorrect := 0
		allocTotalQuestions := 0
		for _, sec := range alloc.Sections {
			allocTotalCorrect += sec.Score
			allocTotalQuestions += sec.TotalQuestions
		}

		// Count actual responses
		respCount, _ := getCollection("student_responses").CountDocuments(context.Background(), bson.M{"allocation_id": alloc.ID})

		entry := fiber.Map{
			"_id":             alloc.ID,
			"test_id":         alloc.TestID,
			"test_type":       alloc.TestType,
			"test_title":      alloc.TestTitle,
			"status":          alloc.Status,
			"scheduled_at":    alloc.ScheduledAt,
			"created_at":      alloc.CreatedAt,
			"updated_at":      alloc.UpdatedAt,
			"total_correct":   allocTotalCorrect,
			"total_questions": allocTotalQuestions,
			"responses_count": respCount,
			"violation_count": alloc.ViolationCount,
		}
		history = append(history, entry)
	}

	// Sort by updated_at descending (most recent first)
	sort.Slice(history, func(i, j int) bool {
		ci, _ := history[i]["updated_at"].(time.Time)
		cj, _ := history[j]["updated_at"].(time.Time)
		return ci.After(cj)
	})

	return c.JSON(fiber.Map{
		"history": history,
		"total":   len(history),
	})
}

func handleGetTestResult(c *fiber.Ctx) error {
	userID, err := primitive.ObjectIDFromHex(c.Locals("userID").(string))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid allocation ID"})
	}

	var alloc TestAllocation
	err = getCollection("test_allocations").FindOne(context.Background(), bson.M{"_id": id}).Decode(&alloc)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Allocation not found"})
	}

	if alloc.StudentID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Not your test"})
	}

	if alloc.Status != "COMPLETED" && alloc.Status != "MALPRACTICE" && alloc.Status != "TERMINATED" {
		return c.Status(400).JSON(fiber.Map{"error": "Test is not completed yet. Status: " + alloc.Status})
	}

	var responses []StudentResponse
	respCursor, err := getCollection("student_responses").Find(context.Background(), bson.M{"allocation_id": id})
	if err == nil {
		respCursor.All(context.Background(), &responses)
		respCursor.Close(context.Background())
	}
	responseMap := make(map[string]StudentResponse)
	for _, r := range responses {
		responseMap[r.QuestionID] = r
	}

	questionMap := make(map[string]Question)
	for _, section := range alloc.Sections {
		if len(section.QuestionIDs) == 0 {
			continue
		}
		colName := subjectToCollection(section.Subject)
		if colName == "" {
			continue
		}
		filter := bson.M{"question_id": bson.M{"$in": section.QuestionIDs}}
		cursor, err := getCollection(colName).Find(context.Background(), filter)
		if err != nil {
			continue
		}
		var questions []Question
		if cursor.All(context.Background(), &questions) == nil {
			for _, q := range questions {
				questionMap[q.QuestionID] = q
			}
		}
		cursor.Close(context.Background())
	}

	type QuestionReview struct {
		QuestionID    string           `json:"question_id"`
		Subject       string           `json:"subject"`
		Category      string           `json:"category"`
		Level         string           `json:"level"`
		QuestionText  string           `json:"question_text"`
		Passage       string           `json:"passage"`
		Options       []QuestionOption `json:"options"`
		StudentAnswer string           `json:"student_answer"`
		CorrectAnswer string           `json:"correct_answer"`
		IsCorrect     bool             `json:"is_correct"`
		IsAnswered    bool             `json:"is_answered"`
		Explanation   string           `json:"explanation"`
		SectionName   string           `json:"section_name"`
	}

	type SectionResult struct {
		Name           string `json:"name"`
		Subject        string `json:"subject"`
		Difficulty     string `json:"difficulty"`
		Score          int    `json:"score"`
		TotalQuestions int    `json:"total_questions"`
		Attempted      int    `json:"attempted"`
		Unanswered     int    `json:"unanswered"`
	}

	type CategoryStat struct {
		Category   string `json:"category"`
		Subject    string `json:"subject"`
		Total      int    `json:"total"`
		Correct    int    `json:"correct"`
		Incorrect  int    `json:"incorrect"`
		Unanswered int    `json:"unanswered"`
	}

	categoryStats := make(map[string]*CategoryStat)
	var questionReviews []QuestionReview
	var sectionResults []SectionResult

	verbalCorrect, verbalTotal := 0, 0
	quantCorrect, quantTotal := 0, 0
	totalCorrect, totalIncorrect, totalUnanswered, totalAttempted := 0, 0, 0, 0

	for _, sec := range alloc.Sections {
		if len(sec.QuestionIDs) == 0 {
			continue
		}
		secResult := SectionResult{
			Name:           sec.Name,
			Subject:        sec.Subject,
			Difficulty:     sec.SelectedDifficulty,
			Score:          sec.Score,
			TotalQuestions: sec.TotalQuestions,
		}

		for _, qid := range sec.QuestionIDs {
			q, qok := questionMap[qid]
			resp, rok := responseMap[qid]

			studentAnswer := ""
			isCorrect := false
			isAnswered := false
			if rok {
				studentAnswer = resp.StudentAnswer
				isCorrect = resp.IsCorrect
				isAnswered = studentAnswer != ""
			}

			correctAnswerStr := ""
			if qok && len(q.CorrectAnswers) > 0 {
				correctAnswerStr = q.CorrectAnswers[0].Value
				if q.CorrectAnswers[0].OptionLabel != "" {
					correctAnswerStr = q.CorrectAnswers[0].OptionLabel
				}
			}

			category := "General"
			if qok && q.Category != "" {
				category = q.Category
			}
			catKey := sec.Subject + "::" + category
			if categoryStats[catKey] == nil {
				categoryStats[catKey] = &CategoryStat{Category: category, Subject: sec.Subject}
			}
			categoryStats[catKey].Total++

			if isAnswered {
				secResult.Attempted++
				totalAttempted++
				if isCorrect {
					categoryStats[catKey].Correct++
					totalCorrect++
				} else {
					categoryStats[catKey].Incorrect++
					totalIncorrect++
				}
			} else {
				secResult.Unanswered++
				categoryStats[catKey].Unanswered++
				totalUnanswered++
			}

			if sec.Subject == "Verbal" {
				verbalTotal++
				if isCorrect {
					verbalCorrect++
				}
			} else if sec.Subject == "Quant" {
				quantTotal++
				if isCorrect {
					quantCorrect++
				}
			}

			if qok {
				questionReviews = append(questionReviews, QuestionReview{
					QuestionID:    qid,
					Subject:       sec.Subject,
					Category:      category,
					Level:         q.Level,
					QuestionText:  q.QuestionText,
					Passage:       q.Passage,
					Options:       q.Options,
					StudentAnswer: studentAnswer,
					CorrectAnswer: correctAnswerStr,
					IsCorrect:     isCorrect,
					IsAnswered:    isAnswered,
					Explanation:   q.Explanation,
					SectionName:   sec.Name,
				})
			}
		}
		sectionResults = append(sectionResults, secResult)
	}

	verbalAccuracy := 0.0
	if verbalTotal > 0 {
		verbalAccuracy = float64(verbalCorrect) / float64(verbalTotal) * 100
	}
	quantAccuracy := 0.0
	if quantTotal > 0 {
		quantAccuracy = float64(quantCorrect) / float64(quantTotal) * 100
	}
	verbalScore := 130
	if verbalTotal > 0 {
		verbalScore = 130 + int(verbalAccuracy*40/100)
		if verbalScore > 170 {
			verbalScore = 170
		}
	}
	quantScore := 130
	if quantTotal > 0 {
		quantScore = 130 + int(quantAccuracy*40/100)
		if quantScore > 170 {
			quantScore = 170
		}
	}
	overallScore := verbalScore + quantScore
	totalQuestions := totalCorrect + totalIncorrect + totalUnanswered
	overallAccuracy := 0.0
	if totalAttempted > 0 {
		overallAccuracy = float64(totalCorrect) / float64(totalAttempted) * 100
	}

	categoryList := []CategoryStat{}
	for _, v := range categoryStats {
		categoryList = append(categoryList, *v)
	}

	// Fetch violation logs for this allocation
	var violations []ViolationLog
	violCursor, vErr := getCollection("proctoring_violations").Find(context.Background(), bson.M{"allocation_id": id})
	if vErr == nil {
		violCursor.All(context.Background(), &violations)
		violCursor.Close(context.Background())
	}

	return c.JSON(fiber.Map{
		"allocation_id":   alloc.ID,
		"test_id":         alloc.TestID,
		"test_type":       alloc.TestType,
		"test_title":      alloc.TestTitle,
		"student_name":    alloc.StudentName,
		"student_email":   alloc.StudentEmail,
		"scheduled_at":    alloc.ScheduledAt,
		"completed_at":    alloc.UpdatedAt,
		"status":          alloc.Status,
		"violation_count": alloc.ViolationCount,
		"malpractice_at":  alloc.MalpracticeAt,
		"violations":      violations,
		"scores": fiber.Map{
			"verbal_score":     verbalScore,
			"quant_score":      quantScore,
			"overall_score":    overallScore,
			"verbal_accuracy":  fmt.Sprintf("%.1f", verbalAccuracy),
			"quant_accuracy":   fmt.Sprintf("%.1f", quantAccuracy),
			"overall_accuracy": fmt.Sprintf("%.1f", overallAccuracy),
			"verbal_correct":   verbalCorrect,
			"verbal_total":     verbalTotal,
			"quant_correct":    quantCorrect,
			"quant_total":      quantTotal,
		},
		"summary": fiber.Map{
			"total_questions":  totalQuestions,
			"total_attempted":  totalAttempted,
			"total_correct":    totalCorrect,
			"total_incorrect":  totalIncorrect,
			"total_unanswered": totalUnanswered,
		},
		"section_results":  sectionResults,
		"category_results": categoryList,
		"question_reviews": questionReviews,
	})
}

func handleSaveAnswer(c *fiber.Ctx) error {
	userID, err := primitive.ObjectIDFromHex(c.Locals("userID").(string))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid allocation ID"})
	}

	var req struct {
		QuestionID   string `json:"question_id"`
		Answer       string `json:"answer"`
		SectionIndex int    `json:"section_index"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.QuestionID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "question_id is required"})
	}

	var alloc TestAllocation
	err = getCollection("test_allocations").FindOne(context.Background(), bson.M{"_id": id}).Decode(&alloc)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Allocation not found"})
	}
	if alloc.StudentID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Not your test"})
	}
	if alloc.Status != "IN_PROGRESS" {
		return c.Status(400).JSON(fiber.Map{"error": "Test is not in progress"})
	}

	_, err = getCollection("draft_answers").UpdateOne(
		context.Background(),
		bson.M{"allocation_id": id, "question_id": req.QuestionID},
		bson.M{"$set": bson.M{
			"allocation_id": id,
			"student_id":    userID,
			"question_id":   req.QuestionID,
			"answer":        req.Answer,
			"section_index": req.SectionIndex,
			"updated_at":    time.Now(),
		}},
		options.Update().SetUpsert(true),
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save answer"})
	}

	return c.JSON(fiber.Map{"message": "Answer saved", "question_id": req.QuestionID})
}

func handleStudentAnalyticsPage(c *fiber.Ctx) error {
	userID, err := primitive.ObjectIDFromHex(c.Locals("userID").(string))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	// Build query with optional date range filter
	query := bson.M{
		"student_id": userID,
		"status":     "COMPLETED",
	}
	fromDate := c.Query("from")
	toDate := c.Query("to")
	if fromDate != "" || toDate != "" {
		dateFilter := bson.M{}
		if fromDate != "" {
			if t, err := time.Parse("2006-01-02", fromDate); err == nil {
				dateFilter["$gte"] = t
			}
		}
		if toDate != "" {
			if t, err := time.Parse("2006-01-02", toDate); err == nil {
				dateFilter["$lte"] = t.Add(24 * time.Hour)
			}
		}
		if len(dateFilter) > 0 {
			query["created_at"] = dateFilter
		}
	}

	cursor, err := getCollection("test_allocations").Find(context.Background(), query)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch allocations"})
	}
	defer cursor.Close(context.Background())

	var allocations []TestAllocation
	if err := cursor.All(context.Background(), &allocations); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to decode allocations"})
	}

	// Sort by created_at ascending (oldest first for progression)
	sort.Slice(allocations, func(i, j int) bool {
		return allocations[i].CreatedAt.Before(allocations[j].CreatedAt)
	})

	type ScorePoint struct {
		TestTitle    string    `json:"test_title"`
		TestID       string    `json:"test_id"`
		AllocationID string    `json:"allocation_id"`
		Date         time.Time `json:"date"`
		VerbalScore  int       `json:"verbal_score"`
		QuantScore   int       `json:"quant_score"`
		OverallScore int       `json:"overall_score"`
		VerbalAcc    float64   `json:"verbal_accuracy"`
		QuantAcc     float64   `json:"quant_accuracy"`
		OverallAcc   float64   `json:"overall_accuracy"`
	}

	type TopicStat struct {
		Category   string  `json:"category"`
		Subject    string  `json:"subject"`
		Total      int     `json:"total"`
		Correct    int     `json:"correct"`
		Incorrect  int     `json:"incorrect"`
		Unanswered int     `json:"unanswered"`
		Accuracy   float64 `json:"accuracy"`
	}

	type DifficultyStat struct {
		Difficulty string  `json:"difficulty"`
		Total      int     `json:"total"`
		Correct    int     `json:"correct"`
		Accuracy   float64 `json:"accuracy"`
	}

	scoreProgression := []ScorePoint{}
	topicMap := make(map[string]*TopicStat)
	difficultyMap := make(map[string]*DifficultyStat)
	adaptiveHistory := []fiber.Map{}

	totalVerbalCorrect, totalVerbalTotal := 0, 0
	totalQuantCorrect, totalQuantTotal := 0, 0
	totalQuestions, totalCorrect, totalAttempted := 0, 0, 0

	for _, alloc := range allocations {
		// Gather responses for this allocation
		var responses []StudentResponse
		respCursor, rErr := getCollection("student_responses").Find(context.Background(), bson.M{"allocation_id": alloc.ID})
		if rErr == nil {
			respCursor.All(context.Background(), &responses)
			respCursor.Close(context.Background())
		}
		responseMap := make(map[string]StudentResponse)
		for _, r := range responses {
			responseMap[r.QuestionID] = r
		}

		// Gather questions for this allocation
		questionMap := make(map[string]Question)
		for _, sec := range alloc.Sections {
			if len(sec.QuestionIDs) == 0 {
				continue
			}
			colName := subjectToCollection(sec.Subject)
			if colName == "" {
				continue
			}
			qCursor, qErr := getCollection(colName).Find(context.Background(), bson.M{"question_id": bson.M{"$in": sec.QuestionIDs}})
			if qErr == nil {
				var qs []Question
				qCursor.All(context.Background(), &qs)
				qCursor.Close(context.Background())
				for _, q := range qs {
					questionMap[q.QuestionID] = q
				}
			}
		}

		// Per-test scores
		vCorrect, vTotal := 0, 0
		qCorrect, qTotal := 0, 0
		tCorrect, tAttempted, tQuestions := 0, 0, 0

		for _, sec := range alloc.Sections {
			if len(sec.QuestionIDs) == 0 {
				continue
			}

			// Track adaptive routing
			if sec.SelectedDifficulty != "" {
				adaptiveHistory = append(adaptiveHistory, fiber.Map{
					"test_title":    alloc.TestTitle,
					"section":       sec.Name,
					"subject":       sec.Subject,
					"difficulty":    sec.SelectedDifficulty,
					"module":        sec.SelectedModule,
					"section_score": sec.Score,
					"section_total": sec.TotalQuestions,
				})
			}

			for _, qid := range sec.QuestionIDs {
				q, qok := questionMap[qid]
				resp, rok := responseMap[qid]

				tQuestions++
				isAnswered := false
				isCorrect := false
				if rok {
					isAnswered = resp.StudentAnswer != ""
					isCorrect = resp.IsCorrect
				}

				// Topic aggregation
				category := "General"
				if qok && q.Category != "" {
					category = q.Category
				}
				catKey := sec.Subject + "::" + category
				if topicMap[catKey] == nil {
					topicMap[catKey] = &TopicStat{Category: category, Subject: sec.Subject}
				}
				topicMap[catKey].Total++

				// Difficulty aggregation
				level := "Unknown"
				if qok && q.Level != "" {
					level = q.Level
				}
				if difficultyMap[level] == nil {
					difficultyMap[level] = &DifficultyStat{Difficulty: level}
				}
				difficultyMap[level].Total++

				if isAnswered {
					tAttempted++
					topicMap[catKey].Incorrect++ // temp, will fix below
					if isCorrect {
						tCorrect++
						topicMap[catKey].Correct++
						difficultyMap[level].Correct++
						topicMap[catKey].Incorrect-- // undo the temp increment
					}
				} else {
					topicMap[catKey].Unanswered++
				}

				if sec.Subject == "Verbal" {
					vTotal++
					if isCorrect {
						vCorrect++
					}
				} else if sec.Subject == "Quant" {
					qTotal++
					if isCorrect {
						qCorrect++
					}
				}
			}
		}

		vAcc := 0.0
		if vTotal > 0 {
			vAcc = float64(vCorrect) / float64(vTotal) * 100
		}
		qAcc := 0.0
		if qTotal > 0 {
			qAcc = float64(qCorrect) / float64(qTotal) * 100
		}
		oAcc := 0.0
		if tAttempted > 0 {
			oAcc = float64(tCorrect) / float64(tAttempted) * 100
		}
		vScore := 130
		if vTotal > 0 {
			vScore = 130 + int(vAcc*40/100)
			if vScore > 170 {
				vScore = 170
			}
		}
		qScore := 130
		if qTotal > 0 {
			qScore = 130 + int(qAcc*40/100)
			if qScore > 170 {
				qScore = 170
			}
		}

		scoreProgression = append(scoreProgression, ScorePoint{
			TestTitle:    alloc.TestTitle,
			TestID:       alloc.TestID,
			AllocationID: alloc.ID.Hex(),
			Date:         alloc.CreatedAt,
			VerbalScore:  vScore,
			QuantScore:   qScore,
			OverallScore: vScore + qScore,
			VerbalAcc:    vAcc,
			QuantAcc:     qAcc,
			OverallAcc:   oAcc,
		})

		totalVerbalCorrect += vCorrect
		totalVerbalTotal += vTotal
		totalQuantCorrect += qCorrect
		totalQuantTotal += qTotal
		totalQuestions += tQuestions
		totalCorrect += tCorrect
		totalAttempted += tAttempted
	}

	// Finalize topic stats
	topicList := []TopicStat{}
	for _, v := range topicMap {
		attempted := v.Correct + v.Incorrect
		if attempted > 0 {
			v.Accuracy = float64(v.Correct) / float64(attempted) * 100
		}
		topicList = append(topicList, *v)
	}
	sort.Slice(topicList, func(i, j int) bool {
		return topicList[i].Accuracy > topicList[j].Accuracy
	})

	// Finalize difficulty stats
	difficultyList := []DifficultyStat{}
	for _, v := range difficultyMap {
		if v.Total > 0 {
			v.Accuracy = float64(v.Correct) / float64(v.Total) * 100
		}
		difficultyList = append(difficultyList, *v)
	}

	// Aggregate scores
	overallVerbalAcc := 0.0
	if totalVerbalTotal > 0 {
		overallVerbalAcc = float64(totalVerbalCorrect) / float64(totalVerbalTotal) * 100
	}
	overallQuantAcc := 0.0
	if totalQuantTotal > 0 {
		overallQuantAcc = float64(totalQuantCorrect) / float64(totalQuantTotal) * 100
	}
	overallAcc := 0.0
	if totalAttempted > 0 {
		overallAcc = float64(totalCorrect) / float64(totalAttempted) * 100
	}
	overallVerbalScore := 130
	if totalVerbalTotal > 0 {
		overallVerbalScore = 130 + int(overallVerbalAcc*40/100)
		if overallVerbalScore > 170 {
			overallVerbalScore = 170
		}
	}
	overallQuantScore := 130
	if totalQuantTotal > 0 {
		overallQuantScore = 130 + int(overallQuantAcc*40/100)
		if overallQuantScore > 170 {
			overallQuantScore = 170
		}
	}

	// Improvement: first vs latest
	improvement := fiber.Map{}
	if len(scoreProgression) >= 2 {
		first := scoreProgression[0]
		latest := scoreProgression[len(scoreProgression)-1]
		testsImproved := 0
		for i := 1; i < len(scoreProgression); i++ {
			if scoreProgression[i].OverallScore > scoreProgression[i-1].OverallScore {
				testsImproved++
			}
		}
		improvement = fiber.Map{
			"first_score":    first.OverallScore,
			"latest_score":   latest.OverallScore,
			"score_delta":    latest.OverallScore - first.OverallScore,
			"verbal_delta":   latest.VerbalScore - first.VerbalScore,
			"quant_delta":    latest.QuantScore - first.QuantScore,
			"accuracy_delta": latest.OverallAcc - first.OverallAcc,
			"tests_improved": testsImproved,
		}
	}

	// Top strengths and weaknesses
	strengths := []TopicStat{}
	weaknesses := []TopicStat{}
	for _, t := range topicList {
		if t.Correct+t.Incorrect >= 2 {
			if t.Accuracy >= 70 {
				strengths = append(strengths, t)
			} else if t.Accuracy < 50 {
				weaknesses = append(weaknesses, t)
			}
		}
	}
	if len(strengths) > 5 {
		strengths = strengths[:5]
	}
	if len(weaknesses) > 5 {
		weaknesses = weaknesses[:5]
	}

	return c.JSON(fiber.Map{
		"score_progression": scoreProgression,
		"topic_stats":       topicList,
		"difficulty_stats":  difficultyList,
		"adaptive_history":  adaptiveHistory,
		"improvement":       improvement,
		"strengths":         strengths,
		"weaknesses":        weaknesses,
		"aggregate": fiber.Map{
			"tests_completed":  len(allocations),
			"total_questions":  totalQuestions,
			"total_attempted":  totalAttempted,
			"total_correct":    totalCorrect,
			"overall_accuracy": overallAcc,
			"verbal_score":     overallVerbalScore,
			"quant_score":      overallQuantScore,
			"overall_score":    overallVerbalScore + overallQuantScore,
			"verbal_accuracy":  overallVerbalAcc,
			"quant_accuracy":   overallQuantAcc,
			"verbal_correct":   totalVerbalCorrect,
			"verbal_total":     totalVerbalTotal,
			"quant_correct":    totalQuantCorrect,
			"quant_total":      totalQuantTotal,
		},
	})
}

type StartSectionReq struct {
	SectionIndex int `json:"section_index"`
}

func handleStartSection(c *fiber.Ctx) error {
	userID, err := primitive.ObjectIDFromHex(c.Locals("userID").(string))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid allocation ID"})
	}

	var req StartSectionReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var alloc TestAllocation
	err = getCollection("test_allocations").FindOne(context.Background(), bson.M{"_id": id, "student_id": userID}).Decode(&alloc)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Allocation not found"})
	}

	if req.SectionIndex < 0 || req.SectionIndex >= len(alloc.Sections) {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid section index"})
	}

	if alloc.Sections[req.SectionIndex].StartedAt == nil {
		now := time.Now()
		alloc.Sections[req.SectionIndex].StartedAt = &now
		getCollection("test_allocations").UpdateOne(context.Background(),
			bson.M{"_id": id},
			bson.M{"$set": bson.M{"sections": alloc.Sections, "updated_at": now}})
		return c.JSON(fiber.Map{"message": "Section marked started", "started_at": now})
	}

	return c.JSON(fiber.Map{"message": "Section already started", "started_at": alloc.Sections[req.SectionIndex].StartedAt})
}
