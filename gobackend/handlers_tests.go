package main

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func handleAllocateTest(c *fiber.Ctx) error {
	var req AllocateTestRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if len(req.StudentIDs) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "At least one student is required"})
	}
	if req.TestType == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Test type is required"})
	}
	if req.ScheduledAt == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Scheduled time is required"})
	}

	scheduledAt, err := time.Parse(time.RFC3339, req.ScheduledAt)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid scheduled_at format, use RFC3339 (e.g. 2026-08-17T15:00:00Z)"})
	}

	adminID, _ := primitive.ObjectIDFromHex(c.Locals("userID").(string))
	adminEmail := c.Locals("email").(string)

	var durationMins int
	switch req.TestType {
	case "FULL_LENGTH":
		durationMins = 120
	case "SECTIONAL":
		durationMins = 40
	case "TOPIC_WISE":
		durationMins = 20
	default:
		return c.Status(400).JSON(fiber.Map{"error": "Invalid test_type. Use FULL_LENGTH, SECTIONAL, or TOPIC_WISE"})
	}

	if scheduledAt.Before(time.Now().Add(-5 * time.Minute)) {
		return c.Status(400).JSON(fiber.Map{"error": "Scheduled time cannot be in the past"})
	}

	graceMins := 30
	expiresAt := scheduledAt.Add(time.Duration(durationMins+graceMins) * time.Minute)

	results := []fiber.Map{}
	for _, studentIDStr := range req.StudentIDs {
		studentID, err := primitive.ObjectIDFromHex(studentIDStr)
		if err != nil {
			results = append(results, fiber.Map{
				"student_id": studentIDStr,
				"status":     "failed",
				"error":      "Invalid student ID",
			})
			continue
		}

		var student User
		err = getCollection("users").FindOne(context.Background(), bson.M{"_id": studentID, "role": "student"}).Decode(&student)
		if err != nil {
			results = append(results, fiber.Map{
				"student_id": studentIDStr,
				"status":     "failed",
				"error":      "Student not found",
			})
			continue
		}

		overlapCount, _ := getCollection("test_allocations").CountDocuments(context.Background(), bson.M{
			"student_id": studentID,
			"status":     bson.M{"$in": []string{"SCHEDULED", "IN_PROGRESS"}},
			"scheduled_at": bson.M{
				"$lt": expiresAt,
				"$gt": scheduledAt.Add(-time.Duration(durationMins+graceMins) * time.Minute),
			},
		})
		if overlapCount > 0 {
			results = append(results, fiber.Map{
				"student_id":   studentIDStr,
				"student_name": student.Name,
				"status":       "failed",
				"error":        "Slot conflict: student already has a test in this time window",
			})
			continue
		}

		selector := NewQuestionSelector(studentID)
		var sections []TestSection
		var questionIDs []string
		var testTitle string

		switch req.TestType {
		case "FULL_LENGTH":
			sections, questionIDs, err = selector.SelectFullLengthExam()
			testTitle = "Full-Length GRE Exam"
			if err != nil {
				results = append(results, fiber.Map{
					"student_id":   studentIDStr,
					"student_name": student.Name,
					"status":       "failed",
					"error":        fmt.Sprintf("Question selection failed: %v", err),
				})
				continue
			}
		default:
			results = append(results, fiber.Map{
				"student_id": studentIDStr,
				"status":     "failed",
				"error":      "Test type not yet implemented",
			})
			continue
		}

		testID := fmt.Sprintf("TEST_%s_%d", req.TestType, time.Now().UnixNano())
		now := time.Now()

		allocation := TestAllocation{
			TestID:        testID,
			StudentID:     studentID,
			StudentName:   student.Name,
			StudentEmail:  student.Email,
			TestType:      req.TestType,
			TestTitle:     testTitle,
			Status:        "SCHEDULED",
			AllocatedBy:   adminEmail,
			AllocatedByID: adminID,
			ScheduledAt:   scheduledAt,
			ExpiresAt:     expiresAt,
			QuestionIDs:   questionIDs,
			Sections:      sections,
			CreatedAt:     now,
			UpdatedAt:     now,
		}

		res, err := getCollection("test_allocations").InsertOne(context.Background(), allocation)
		if err != nil {
			results = append(results, fiber.Map{
				"student_id":   studentIDStr,
				"student_name": student.Name,
				"status":       "failed",
				"error":        fmt.Sprintf("Failed to create allocation: %v", err),
			})
			continue
		}
		allocation.ID = res.InsertedID.(primitive.ObjectID)

		for _, sec := range sections {
			recordQuestionHistory(studentID, testID, sec.QuestionIDs, sec.Subject)
		}

		results = append(results, fiber.Map{
			"student_id":     studentIDStr,
			"student_name":   student.Name,
			"student_email":  student.Email,
			"status":         "created",
			"test_id":        testID,
			"allocation_id":  allocation.ID.Hex(),
			"test_title":     testTitle,
			"scheduled_at":   scheduledAt,
			"expires_at":     expiresAt,
			"sections":       sections,
			"question_count": len(questionIDs),
		})
	}

	created := 0
	failed := 0
	for _, r := range results {
		if r["status"] == "created" {
			created++
		} else {
			failed++
		}
	}

	return c.Status(201).JSON(fiber.Map{
		"summary": fiber.Map{"total": len(results), "created": created, "failed": failed},
		"results": results,
	})
}

func handleListAllocations(c *fiber.Ctx) error {
	filter := bson.M{}
	countFilter := bson.M{}

	search := c.Query("search")
	if search != "" {
		escaped := regexp.QuoteMeta(search)
		orClause := bson.A{
			bson.M{"student_name": bson.M{"$regex": escaped, "$options": "i"}},
			bson.M{"student_email": bson.M{"$regex": escaped, "$options": "i"}},
		}
		filter["$or"] = orClause
		countFilter["$or"] = orClause
	}

	status := c.Query("status")
	if status != "" {
		filter["status"] = status
	}

	testType := c.Query("test_type")
	if testType != "" {
		filter["test_type"] = testType
		countFilter["test_type"] = testType
	}

	allocatedBy := c.Query("allocated_by")
	if allocatedBy != "" {
		re := bson.M{"$regex": regexp.QuoteMeta(allocatedBy), "$options": "i"}
		filter["allocated_by"] = re
		countFilter["allocated_by"] = re
	}

	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")
	if dateFrom != "" || dateTo != "" {
		dateFilter := bson.M{}
		if dateFrom != "" {
			from, _ := time.Parse("2006-01-02", dateFrom)
			dateFilter["$gte"] = from
		}
		if dateTo != "" {
			to, _ := time.Parse("2006-01-02", dateTo)
			dateFilter["$lte"] = to.Add(24 * time.Hour)
		}
		filter["scheduled_at"] = dateFilter
		countFilter["scheduled_at"] = dateFilter
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	if page < 1 {
		page = 1
	}
	limit := 50
	skip := (page - 1) * limit

	total, _ := getCollection("test_allocations").CountDocuments(context.Background(), filter)
	totalPages := int(total) / limit
	if int(total)%limit != 0 {
		totalPages++
	}

	findOpts := options.Find().
		SetSkip(int64(skip)).
		SetLimit(int64(limit)).
		SetSort(bson.D{{Key: "created_at", Value: -1}})

	cur, err := getCollection("test_allocations").Find(context.Background(), filter, findOpts)
	if err != nil {
		return c.JSON(fiber.Map{"allocations": []interface{}{}, "total": 0, "page": page, "totalPages": 0})
	}
	defer cur.Close(context.Background())

	var allocations []TestAllocation
	cur.All(context.Background(), &allocations)
	if allocations == nil {
		allocations = []TestAllocation{}
	}

	now := time.Now()
	for i := range allocations {
		if allocations[i].Status == "SCHEDULED" {
			deadline := allocations[i].EndTime
			if deadline.IsZero() {
				deadline = allocations[i].ScheduledAt.Add(120 * time.Minute)
			}
			if now.After(deadline) {
				allocations[i].Status = "EXPIRED"
				getCollection("test_allocations").UpdateOne(context.Background(),
					bson.M{"_id": allocations[i].ID},
					bson.M{"$set": bson.M{"status": "EXPIRED", "expired_at": now, "updated_at": now}})
			}
		}
	}

	// Status summary counts (across all matching allocations, ignoring pagination and status filter)
	statusCounts := bson.M{
		"total":       0,
		"SCHEDULED":   0,
		"IN_PROGRESS": 0,
		"COMPLETED":   0,
		"EXPIRED":     0,
		"CANCELLED":   0,
		"TERMINATED":  0,
		"REALLOCATED": 0,
	}

	countOpts := options.Find().SetProjection(bson.M{"status": 1, "scheduled_at": 1, "end_time": 1, "expires_at": 1})
	countCur, err := getCollection("test_allocations").Find(context.Background(), countFilter, countOpts)
	if err == nil {
		defer countCur.Close(context.Background())
		var summaryAllocs []TestAllocation
		countCur.All(context.Background(), &summaryAllocs)
		for _, a := range summaryAllocs {
			effStatus := a.Status
			if effStatus == "SCHEDULED" {
				deadline := a.EndTime
				if deadline.IsZero() {
					deadline = a.ScheduledAt.Add(120 * time.Minute)
				}
				if now.After(deadline) {
					effStatus = "EXPIRED"
				}
			}
			statusCounts["total"] = statusCounts["total"].(int) + 1
			if _, ok := statusCounts[effStatus]; ok {
				statusCounts[effStatus] = statusCounts[effStatus].(int) + 1
			}
		}
	}

	return c.JSON(fiber.Map{
		"allocations":  allocations,
		"total":        total,
		"page":         page,
		"totalPages":   totalPages,
		"limit":        limit,
		"statusCounts": statusCounts,
	})
}

func handleGetAllocation(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid ID"})
	}

	var alloc TestAllocation
	err = getCollection("test_allocations").FindOne(context.Background(), bson.M{"_id": id}).Decode(&alloc)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Allocation not found"})
	}

	if alloc.Status == "SCHEDULED" {
		now := time.Now()
		deadline := alloc.EndTime
		if deadline.IsZero() {
			deadline = alloc.ScheduledAt.Add(120 * time.Minute)
		}
		if now.After(deadline) {
			alloc.Status = "EXPIRED"
			getCollection("test_allocations").UpdateOne(context.Background(),
				bson.M{"_id": alloc.ID},
				bson.M{"$set": bson.M{"status": "EXPIRED", "expired_at": now, "updated_at": now}})
		}
	}

	return c.JSON(fiber.Map{"allocation": alloc})
}

func handleCancelAllocation(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid ID"})
	}

	var alloc TestAllocation
	err = getCollection("test_allocations").FindOne(context.Background(), bson.M{"_id": id}).Decode(&alloc)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Allocation not found"})
	}

	// Compute effective status (SCHEDULED may actually be EXPIRED by now)
	effectiveStatus := alloc.Status
	now := time.Now()
	if effectiveStatus == "SCHEDULED" {
		deadline := alloc.EndTime
		if deadline.IsZero() {
			deadline = alloc.ScheduledAt.Add(120 * time.Minute)
		}
		if now.After(deadline) {
			effectiveStatus = "EXPIRED"
		}
	}

	var newStatus string
	switch effectiveStatus {
	case "SCHEDULED":
		newStatus = "CANCELLED"
	case "IN_PROGRESS":
		newStatus = "TERMINATED"
	default:
		return c.Status(400).JSON(fiber.Map{"error": "Can only cancel SCHEDULED or terminate IN_PROGRESS tests"})
	}

	_, err = getCollection("test_allocations").UpdateOne(
		context.Background(),
		bson.M{"_id": id},
		bson.M{"$set": bson.M{"status": newStatus, "updated_at": now}},
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update allocation"})
	}

	// Release the assigned questions back into the unattempted pool
	_, err = getCollection("student_question_history").DeleteMany(
		context.Background(),
		bson.M{"test_id": alloc.TestID},
	)
	if err != nil {
		return c.JSON(fiber.Map{"message": "Allocation " + newStatus + " (history cleanup partial)", "test_id": alloc.TestID, "status": newStatus})
	}

	return c.JSON(fiber.Map{"message": "Allocation " + newStatus, "test_id": alloc.TestID, "status": newStatus})
}

func handleRescheduleAllocation(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid ID"})
	}

	var body struct {
		ScheduledAt string `json:"scheduled_at"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if body.ScheduledAt == "" {
		return c.Status(400).JSON(fiber.Map{"error": "scheduled_at is required"})
	}

	newScheduledAt, err := time.Parse(time.RFC3339, body.ScheduledAt)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid format, use RFC3339"})
	}

	if newScheduledAt.Before(time.Now()) {
		return c.Status(400).JSON(fiber.Map{"error": "Cannot reschedule to a time in the past"})
	}

	var alloc TestAllocation
	err = getCollection("test_allocations").FindOne(context.Background(), bson.M{"_id": id}).Decode(&alloc)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Allocation not found"})
	}

	if alloc.Status != "SCHEDULED" {
		return c.Status(400).JSON(fiber.Map{"error": "Can only reschedule SCHEDULED tests"})
	}

	var durationMins int
	switch alloc.TestType {
	case "FULL_LENGTH":
		durationMins = 120
	case "SECTIONAL":
		durationMins = 40
	case "TOPIC_WISE":
		durationMins = 20
	default:
		durationMins = 60
	}
	newExpiresAt := newScheduledAt.Add(time.Duration(durationMins+30) * time.Minute)

	_, err = getCollection("test_allocations").UpdateOne(
		context.Background(),
		bson.M{"_id": id},
		bson.M{"$set": bson.M{
			"scheduled_at": newScheduledAt,
			"expires_at":   newExpiresAt,
			"updated_at":   time.Now(),
		}},
	)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to reschedule"})
	}

	return c.JSON(fiber.Map{
		"message":      "Allocation rescheduled",
		"scheduled_at": newScheduledAt,
		"expires_at":   newExpiresAt,
	})
}

func handleReallocateTest(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid ID"})
	}

	var req struct {
		ScheduledAt string `json:"scheduled_at"`
	}
	if err := c.BodyParser(&req); err != nil || req.ScheduledAt == "" {
		return c.Status(400).JSON(fiber.Map{"error": "scheduled_at is required"})
	}

	newScheduledAt, err := time.Parse(time.RFC3339, req.ScheduledAt)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid scheduled_at format, use RFC3339"})
	}

	var alloc TestAllocation
	err = getCollection("test_allocations").FindOne(context.Background(), bson.M{"_id": id}).Decode(&alloc)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Allocation not found"})
	}

	if alloc.Status != "EXPIRED" {
		return c.Status(400).JSON(fiber.Map{"error": "Can only reallocate EXPIRED tests"})
	}

	adminID, _ := primitive.ObjectIDFromHex(c.Locals("userID").(string))
	adminEmail := c.Locals("email").(string)

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
	graceMins := 30
	newExpiresAt := newScheduledAt.Add(time.Duration(durationMins+graceMins) * time.Minute)

	// Clean up old question history for the expired allocation
	getCollection("student_question_history").DeleteMany(context.Background(), bson.M{
		"student_id": alloc.StudentID,
		"test_id":    alloc.TestID,
	})

	// Mark old allocation as REALLOCATED
	getCollection("test_allocations").UpdateOne(context.Background(),
		bson.M{"_id": id},
		bson.M{"$set": bson.M{
			"status":     "REALLOCATED",
			"updated_at": time.Now(),
		}},
	)

	// Select new questions
	selector := NewQuestionSelector(alloc.StudentID)
	var sections []TestSection
	var questionIDs []string
	var testTitle string

	switch alloc.TestType {
	case "FULL_LENGTH":
		sections, questionIDs, err = selector.SelectFullLengthExam()
		testTitle = "Full-Length GRE Exam"
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("Question selection failed: %v", err)})
		}
	default:
		return c.Status(400).JSON(fiber.Map{"error": "Test type not yet implemented for reallocation"})
	}

	testID := fmt.Sprintf("TEST_%s_%d", alloc.TestType, time.Now().UnixNano())
	now := time.Now()

	newAlloc := TestAllocation{
		TestID:        testID,
		StudentID:     alloc.StudentID,
		StudentName:   alloc.StudentName,
		StudentEmail:  alloc.StudentEmail,
		TestType:      alloc.TestType,
		TestTitle:     testTitle,
		Status:        "SCHEDULED",
		AllocatedBy:   adminEmail,
		AllocatedByID: adminID,
		ScheduledAt:   newScheduledAt,
		ExpiresAt:     newExpiresAt,
		QuestionIDs:   questionIDs,
		Sections:      sections,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	res, err := getCollection("test_allocations").InsertOne(context.Background(), newAlloc)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create new allocation"})
	}
	newAlloc.ID = res.InsertedID.(primitive.ObjectID)

	for _, sec := range sections {
		recordQuestionHistory(alloc.StudentID, testID, sec.QuestionIDs, sec.Subject)
	}

	return c.Status(201).JSON(fiber.Map{
		"message":        "Test reallocated successfully",
		"allocation_id":  newAlloc.ID.Hex(),
		"test_id":        testID,
		"student_name":   alloc.StudentName,
		"student_email":  alloc.StudentEmail,
		"scheduled_at":   newScheduledAt,
		"expires_at":     newExpiresAt,
		"question_count": len(questionIDs),
	})
}

func handleGetAllocationQuestions(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid ID"})
	}

	var alloc TestAllocation
	err = getCollection("test_allocations").FindOne(context.Background(), bson.M{"_id": id}).Decode(&alloc)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Allocation not found"})
	}

	if len(alloc.QuestionIDs) == 0 {
		return c.JSON(fiber.Map{"questions": []Question{}, "sections": alloc.Sections, "student_responses": fiber.Map{}})
	}

	questionMap := make(map[string]Question)

	// Query each subject-specific collection
	for _, section := range alloc.Sections {
		colName := subjectToCollection(section.Subject)
		if colName == "" {
			continue
		}

		filter := bson.M{
			"question_id": bson.M{"$in": section.QuestionIDs},
		}

		cursor, err := getCollection(colName).Find(context.Background(), filter)
		if err != nil {
			continue
		}

		var questions []Question
		if err := cursor.All(context.Background(), &questions); err == nil {
			for _, q := range questions {
				questionMap[q.QuestionID] = q
			}
		}
		cursor.Close(context.Background())
	}

	// Preserve allocation section order
	ordered := make([]Question, 0, len(alloc.QuestionIDs))
	for _, qid := range alloc.QuestionIDs {
		if q, ok := questionMap[qid]; ok {
			ordered = append(ordered, q)
		}
	}

	// Fetch student responses for this allocation (works for any status)
	var responses []StudentResponse
	respCursor, rErr := getCollection("student_responses").Find(context.Background(), bson.M{"allocation_id": alloc.ID})
	if rErr == nil {
		respCursor.All(context.Background(), &responses)
		respCursor.Close(context.Background())
	}
	responseMap := make(map[string]fiber.Map)
	for _, r := range responses {
		responseMap[r.QuestionID] = fiber.Map{
			"question_id":    r.QuestionID,
			"student_answer": r.StudentAnswer,
			"is_correct":     r.IsCorrect,
			"submitted_at":   r.SubmittedAt,
		}
	}

	return c.JSON(fiber.Map{
		"questions":         ordered,
		"sections":          alloc.Sections,
		"student_responses": responseMap,
		"allocation_status": alloc.Status,
		"student_name":      alloc.StudentName,
	})
}

func handleGetStudentAnswersSummary(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid ID"})
	}

	var alloc TestAllocation
	err = getCollection("test_allocations").FindOne(context.Background(), bson.M{"_id": id}).Decode(&alloc)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Allocation not found"})
	}

	// Fetch all student responses for this allocation
	var responses []StudentResponse
	respCursor, rErr := getCollection("student_responses").Find(context.Background(), bson.M{"allocation_id": alloc.ID})
	if rErr == nil {
		respCursor.All(context.Background(), &responses)
		respCursor.Close(context.Background())
	}

	totalQuestions := 0
	answered := 0
	correct := 0
	wrong := 0
	notAttended := 0

	respMap := make(map[string]StudentResponse)
	for _, r := range responses {
		respMap[r.QuestionID] = r
	}

	// Count per section
	sectionStats := []fiber.Map{}
	for _, sec := range alloc.Sections {
		secTotal := len(sec.QuestionIDs)
		secAnswered := 0
		secCorrect := 0
		secWrong := 0
		secNotAttended := 0

		for _, qid := range sec.QuestionIDs {
			if r, ok := respMap[qid]; ok && r.StudentAnswer != "" {
				secAnswered++
				answered++
				if r.IsCorrect {
					secCorrect++
					correct++
				} else {
					secWrong++
					wrong++
				}
			} else {
				secNotAttended++
				notAttended++
			}
		}
		totalQuestions += secTotal

		correctPct := 0.0
		if secAnswered > 0 {
			correctPct = float64(secCorrect) / float64(secAnswered) * 100
		}
		wrongPct := 0.0
		if secAnswered > 0 {
			wrongPct = float64(secWrong) / float64(secAnswered) * 100
		}

		sectionStats = append(sectionStats, fiber.Map{
			"section_name": sec.Name,
			"subject":      sec.Subject,
			"total":        secTotal,
			"answered":     secAnswered,
			"correct":      secCorrect,
			"wrong":        secWrong,
			"not_attended": secNotAttended,
			"correct_pct":  correctPct,
			"wrong_pct":    wrongPct,
		})
	}

	correctPct := 0.0
	if answered > 0 {
		correctPct = float64(correct) / float64(answered) * 100
	}
	wrongPct := 0.0
	if answered > 0 {
		wrongPct = float64(wrong) / float64(answered) * 100
	}

	return c.JSON(fiber.Map{
		"allocation_id":   alloc.ID,
		"test_title":      alloc.TestTitle,
		"student_name":    alloc.StudentName,
		"status":          alloc.Status,
		"total_questions": totalQuestions,
		"answered":        answered,
		"correct":         correct,
		"wrong":           wrong,
		"not_attended":    notAttended,
		"correct_pct":     correctPct,
		"wrong_pct":       wrongPct,
		"section_stats":   sectionStats,
	})
}

func handleGetAllocationViolations(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid ID"})
	}

	var alloc TestAllocation
	err = getCollection("test_allocations").FindOne(context.Background(), bson.M{"_id": id}).Decode(&alloc)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Allocation not found"})
	}

	var violations []ViolationLog
	violCursor, vErr := getCollection("proctoring_violations").Find(context.Background(), bson.M{"allocation_id": id})
	if vErr == nil {
		violCursor.All(context.Background(), &violations)
		violCursor.Close(context.Background())
	}

	return c.JSON(fiber.Map{
		"allocation_id":   alloc.ID,
		"test_title":      alloc.TestTitle,
		"student_name":    alloc.StudentName,
		"student_email":   alloc.StudentEmail,
		"status":          alloc.Status,
		"violation_count": alloc.ViolationCount,
		"malpractice_at":  alloc.MalpracticeAt,
		"violations":      violations,
	})
}
