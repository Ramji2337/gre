package main

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/minio/minio-go/v7"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func subjectToCollection(subject string) string {
	switch subject {
	case "Quant":
		return "quant_questions"
	case "Verbal":
		return "verbal_questions"
	case "AWA":
		return "awa_questions"
	default:
		// Check dynamic subjects from DB
		var doc bson.M
		err := getCollection("subjects").FindOne(context.Background(), bson.M{"name": subject}).Decode(&doc)
		if err != nil {
			return ""
		}
		if colName, ok := doc["collection"].(string); ok {
			return colName
		}
		return ""
	}
}

func getAllSubjects() []string {
	static := []string{"Quant", "Verbal", "AWA"}
	cur, err := getCollection("subjects").Find(context.Background(), bson.M{})
	if err != nil {
		return static
	}
	defer cur.Close(context.Background())
	for cur.Next(context.Background()) {
		var doc bson.M
		cur.Decode(&doc)
		if name, ok := doc["name"].(string); ok {
			static = append(static, name)
		}
	}
	return static
}

func collectionToSubject(colName string) string {
	switch colName {
	case "quant_questions":
		return "Quant"
	case "verbal_questions":
		return "Verbal"
	case "awa_questions":
		return "AWA"
	default:
		return ""
	}
}

func minioImageURL(imageName string) string {
	if imageName == "" {
		return ""
	}
	if minioClient == nil {
		if err := initMinioClient(); err != nil {
			if !hasExtension(imageName) {
				imageName = imageName + ".png"
			}
			return fmt.Sprintf("%s/%s/%s", MinioBaseURL, MinioBucket, imageName)
		}
	}
	objName := imageName
	if !hasExtension(imageName) {
		spaceName := strings.ReplaceAll(imageName, "_", " ")
		candidates := []string{
			imageName + ".jpg",
			imageName + ".png",
			spaceName + ".jpg",
			spaceName + ".png",
		}
		found := false
		for _, c := range candidates {
			_, err := minioClient.StatObject(context.Background(), MinioBucket, c, minio.StatObjectOptions{})
			if err == nil {
				objName = c
				found = true
				break
			}
		}
		if !found {
			objName = imageName + ".jpg"
		}
	}
	url, err := minioClient.PresignedGetObject(context.Background(), MinioBucket, objName, 24*time.Hour, nil)
	if err != nil {
		return fmt.Sprintf("%s/%s/%s", MinioBaseURL, MinioBucket, objName)
	}
	return url.String()
}

func hasExtension(name string) bool {
	for i := len(name) - 1; i >= 0; i-- {
		if name[i] == '.' {
			return true
		}
		if name[i] == '/' || name[i] == '\\' {
			return false
		}
	}
	return false
}

func handleListQuestions(c *fiber.Ctx) error {
	subject := c.Query("subject")
	if subject == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Subject is required (Quant, Verbal, AWA)"})
	}

	colName := subjectToCollection(subject)
	if colName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid subject"})
	}

	filter := bson.M{}
	if category := c.Query("category"); category != "" {
		filter["category"] = category
	}
	if level := c.Query("level"); level != "" {
		filter["level"] = level
	}
	if search := c.Query("search"); search != "" {
		escaped := regexp.QuoteMeta(search)
		filter["$or"] = bson.A{
			bson.M{"question_text": bson.M{"$regex": escaped, "$options": "i"}},
			bson.M{"question_id": bson.M{"$regex": escaped, "$options": "i"}},
			bson.M{"category": bson.M{"$regex": escaped, "$options": "i"}},
		}
	}
	isActive := c.Query("is_active")
	if isActive == "true" {
		filter["is_active"] = true
	} else if isActive == "false" {
		filter["is_active"] = false
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	skip := (page - 1) * limit

	col := getCollection(colName)
	total, _ := col.CountDocuments(context.Background(), filter)
	totalPages := int(total) / limit
	if int(total)%limit != 0 {
		totalPages++
	}

	findOpts := options.Find().SetSkip(int64(skip)).SetLimit(int64(limit)).SetSort(bson.D{{Key: "created_at", Value: -1}})
	cur, err := col.Find(context.Background(), filter, findOpts)
	if err != nil {
		return c.JSON(fiber.Map{"questions": []interface{}{}, "total": 0, "page": page, "totalPages": 0})
	}
	defer cur.Close(context.Background())

	var questions []Question
	if err := cur.All(c.Context(), &questions); err != nil {
		return c.JSON(fiber.Map{"questions": []interface{}{}, "total": total, "page": page, "totalPages": totalPages})
	}
	if questions == nil {
		questions = []Question{}
	}

	for i := range questions {
		for j := range questions[i].Images {
			storage := strings.ToLower(questions[i].Images[j].Storage)
			if storage == "s3" || storage == "minio" {
				questions[i].Images[j].ImageName = minioImageURL(questions[i].Images[j].ImageName)
			}
		}
	}

	return c.JSON(fiber.Map{
		"questions":  questions,
		"total":      total,
		"page":       page,
		"totalPages": totalPages,
		"limit":      limit,
	})
}

func handleGetQuestion(c *fiber.Ctx) error {
	subject := c.Query("subject")
	id := c.Params("id")
	if subject == "" || id == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Subject and id are required"})
	}

	colName := subjectToCollection(subject)
	if colName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid subject"})
	}

	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid question ID"})
	}

	var question Question
	err = getCollection(colName).FindOne(c.Context(), bson.M{"_id": objID}).Decode(&question)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Question not found"})
	}

	for j := range question.Images {
		storage := strings.ToLower(question.Images[j].Storage)
		if storage == "s3" || storage == "minio" {
			question.Images[j].ImageName = minioImageURL(question.Images[j].ImageName)
		}
	}

	return c.JSON(fiber.Map{"question": question})
}

func handleCreateQuestion(c *fiber.Ctx) error {
	var req QuestionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Subject == "" || req.QuestionText == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Subject and question text are required"})
	}

	colName := subjectToCollection(req.Subject)
	if colName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid subject"})
	}

	if req.Level == "" {
		req.Level = "Medium"
	}
	if req.QuestionType == "" {
		req.QuestionType = "MULTIPLE_CHOICE_SINGLE"
	}
	if req.AnswerFormat == "" {
		req.AnswerFormat = "SINGLE_CHOICE"
	}
	if req.ImageStorage == "" {
		req.ImageStorage = "MINIO"
	}

	isMultiAnswer := req.IsMultiAnswer || req.QuestionType == "MULTIPLE_CHOICE_MULTI" || req.QuestionType == "SELECT_MANY" || req.QuestionType == "SENTENCE_EQUIVALENCE" || req.AnswerFormat == "MULTI_CHOICE"
	hasAnswerImage := req.HasAnswerImage || len(req.Images) > 0

	now := time.Now()
	questionID := fmt.Sprintf("MAN_%s_%d", req.Subject, now.UnixNano())

	question := Question{
		QuestionID:     questionID,
		Subject:        req.Subject,
		Category:       req.Category,
		Level:          req.Level,
		QuestionType:   req.QuestionType,
		AnswerFormat:   req.AnswerFormat,
		IsMultiAnswer:  isMultiAnswer,
		QuestionText:   req.QuestionText,
		Passage:        req.Passage,
		Options:        req.Options,
		CorrectAnswers: req.CorrectAnswers,
		Explanation:    req.Explanation,
		Images:         req.Images,
		HasAnswerImage: hasAnswerImage,
		ImageStorage:   req.ImageStorage,
		IsActive:       true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	res, err := getCollection(colName).InsertOne(context.Background(), question)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create question"})
	}
	question.ID = res.InsertedID.(primitive.ObjectID)

	return c.Status(201).JSON(fiber.Map{"question": question})
}

func handleUpdateQuestion(c *fiber.Ctx) error {
	subject := c.Query("subject")
	id := c.Params("id")
	if subject == "" || id == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Subject and id are required"})
	}

	colName := subjectToCollection(subject)
	if colName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid subject"})
	}

	var req QuestionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	now := time.Now()
	update := bson.M{"updated_at": now}
	if req.Category != "" {
		update["category"] = req.Category
	}
	if req.Level != "" {
		update["level"] = req.Level
	}
	if req.QuestionType != "" {
		update["question_type"] = req.QuestionType
	}
	if req.AnswerFormat != "" {
		update["answer_format"] = req.AnswerFormat
	}
	update["is_multi_answer"] = req.IsMultiAnswer || req.QuestionType == "MULTIPLE_CHOICE_MULTI" || req.QuestionType == "SELECT_MANY" || req.QuestionType == "SENTENCE_EQUIVALENCE" || req.AnswerFormat == "MULTI_CHOICE"
	update["has_answer_image"] = req.HasAnswerImage || len(req.Images) > 0
	if req.ImageStorage != "" {
		update["image_storage"] = req.ImageStorage
	} else {
		update["image_storage"] = "MINIO"
	}
	if req.QuestionText != "" {
		update["question_text"] = req.QuestionText
	}
	if req.Passage != "" {
		update["passage"] = req.Passage
	}
	if req.Options != nil {
		update["options"] = req.Options
	}
	if req.CorrectAnswers != nil {
		update["correct_answers"] = req.CorrectAnswers
	}
	if req.Explanation != "" {
		update["explanation"] = req.Explanation
	}
	if req.Images != nil {
		update["images"] = req.Images
	}

	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid question ID"})
	}

	var question Question
	err = getCollection(colName).FindOneAndUpdate(
		context.Background(),
		bson.M{"_id": objID},
		bson.M{"$set": update},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&question)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Question not found"})
	}

	for j := range question.Images {
		storage := strings.ToLower(question.Images[j].Storage)
		if storage == "" || storage == "minio" || storage == "s3" {
			question.Images[j].ImageName = minioImageURL(question.Images[j].ImageName)
		}
	}

	return c.JSON(fiber.Map{"question": question})
}

func handleDeleteQuestion(c *fiber.Ctx) error {
	subject := c.Query("subject")
	id := c.Params("id")
	if subject == "" || id == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Subject and id are required"})
	}

	colName := subjectToCollection(subject)
	if colName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid subject"})
	}

	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid question ID"})
	}

	res, err := getCollection(colName).DeleteOne(context.Background(), bson.M{"_id": objID})
	if err != nil || res.DeletedCount == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Question not found"})
	}

	return c.JSON(fiber.Map{"message": "Question deleted"})
}

func handleGetCategories(c *fiber.Ctx) error {
	subject := c.Query("subject")
	if subject == "" {
		result := fiber.Map{}
		for _, s := range getAllSubjects() {
			colName := subjectToCollection(s)
			if colName == "" {
				continue
			}
			cats, _ := getCollection(colName).Distinct(context.Background(), "category", bson.M{})
			result[s] = cats
		}
		return c.JSON(fiber.Map{"categories": result})
	}

	colName := subjectToCollection(subject)
	if colName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid subject"})
	}

	cats, _ := getCollection(colName).Distinct(context.Background(), "category", bson.M{})
	return c.JSON(fiber.Map{"categories": cats})
}

func handleGetQuestionStats(c *fiber.Ctx) error {
	result := fiber.Map{}
	for _, s := range getAllSubjects() {
		colName := subjectToCollection(s)
		if colName == "" {
			continue
		}
		col := getCollection(colName)
		total, _ := col.CountDocuments(context.Background(), bson.M{})
		easy, _ := col.CountDocuments(context.Background(), bson.M{"level": "Easy"})
		medium, _ := col.CountDocuments(context.Background(), bson.M{"level": "Medium"})
		hard, _ := col.CountDocuments(context.Background(), bson.M{"level": "Hard"})
		cats, _ := col.Distinct(context.Background(), "category", bson.M{})
		result[s] = fiber.Map{
			"total":      total,
			"easy":       easy,
			"medium":     medium,
			"hard":       hard,
			"categories": cats,
		}
	}
	return c.JSON(fiber.Map{"stats": result})
}
