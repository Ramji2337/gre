package main

import (
	"context"
	"regexp"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func handleAdminStats(c *fiber.Ctx) error {
	db := getDB()
	quant, _ := db.Collection("quant_questions").CountDocuments(context.Background(), bson.M{"is_active": true})
	verbal, _ := db.Collection("verbal_questions").CountDocuments(context.Background(), bson.M{"is_active": true})
	awa, _ := db.Collection("awa_questions").CountDocuments(context.Background(), bson.M{"is_active": true})
	students, _ := db.Collection("users").CountDocuments(context.Background(), bson.M{"role": "student"})
	return c.JSON(fiber.Map{
		"quant": quant, "verbal": verbal, "awa": awa,
		"students": students, "total": quant + verbal + awa,
	})
}

func handleListStudents(c *fiber.Ctx) error {
	filter := bson.M{"role": "student"}

	// Search box — match across name, email, username, phone, city, country
	search := c.Query("search")
	if search != "" {
		escaped := regexp.QuoteMeta(search)
		filter["$or"] = bson.A{
			bson.M{"name": bson.M{"$regex": escaped, "$options": "i"}},
			bson.M{"email": bson.M{"$regex": escaped, "$options": "i"}},
			bson.M{"username": bson.M{"$regex": escaped, "$options": "i"}},
			bson.M{"phone": bson.M{"$regex": escaped, "$options": "i"}},
			bson.M{"city": bson.M{"$regex": escaped, "$options": "i"}},
			bson.M{"country": bson.M{"$regex": escaped, "$options": "i"}},
		}
	}

	// Filter by country
	country := c.Query("country")
	if country != "" {
		filter["country"] = country
	}

	// Filter by city
	city := c.Query("city")
	if city != "" {
		filter["city"] = bson.M{"$regex": regexp.QuoteMeta(city), "$options": "i"}
	}

	// Filter by date range
	dateFrom := c.Query("dateFrom")
	dateTo := c.Query("dateTo")
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
		filter["createdAt"] = dateFilter
	}

	// Pagination
	page, _ := strconv.Atoi(c.Query("page", "1"))
	if page < 1 {
		page = 1
	}
	limit := 20
	skip := (page - 1) * limit

	// Get total count for pagination
	total, _ := getCollection("users").CountDocuments(context.Background(), filter)
	totalPages := int(total) / limit
	if int(total)%limit != 0 {
		totalPages++
	}

	findOpts := options.Find().SetSkip(int64(skip)).SetLimit(int64(limit)).SetSort(bson.D{{Key: "createdAt", Value: -1}})

	cur, err := getCollection("users").Find(context.Background(), filter, findOpts)
	if err != nil {
		return c.JSON(fiber.Map{"students": []interface{}{}, "total": 0, "page": page, "totalPages": 0})
	}
	defer cur.Close(context.Background())

	var students []User
	cur.All(context.Background(), &students)
	if students == nil {
		students = []User{}
	}

	type StudentWithCounts struct {
		User
		CompletedTests int `json:"completed_tests"`
		UpcomingTests  int `json:"upcoming_tests"`
	}

	result := make([]StudentWithCounts, 0, len(students))
	for _, s := range students {
		completed, _ := getCollection("test_allocations").CountDocuments(context.Background(), bson.M{
			"student_id": s.ID,
			"status":     "COMPLETED",
		})
		upcoming, _ := getCollection("test_allocations").CountDocuments(context.Background(), bson.M{
			"student_id": s.ID,
			"status":     bson.M{"$in": bson.A{"SCHEDULED", "IN_PROGRESS"}},
		})
		result = append(result, StudentWithCounts{
			User:           s,
			CompletedTests: int(completed),
			UpcomingTests:  int(upcoming),
		})
	}

	return c.JSON(fiber.Map{
		"students":   result,
		"total":      total,
		"page":       page,
		"totalPages": totalPages,
		"limit":      limit,
	})
}

func handleCreateStudent(c *fiber.Ctx) error {
	var req StudentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Email == "" || req.Password == "" || req.Name == "" || req.Username == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name, username, email and password are required"})
	}

	col := getCollection("users")
	emailCount, _ := col.CountDocuments(context.Background(), bson.M{"email": req.Email})
	if emailCount > 0 {
		return c.Status(409).JSON(fiber.Map{"error": "Email already exists"})
	}
	usernameCount, _ := col.CountDocuments(context.Background(), bson.M{"username": req.Username})
	if usernameCount > 0 {
		return c.Status(409).JSON(fiber.Map{"error": "Username already exists"})
	}

	now := time.Now()
	user := User{
		Email:     req.Email,
		Password:  hashPassword(req.Password),
		Name:      req.Name,
		Username:  req.Username,
		Phone:     req.Phone,
		City:      req.City,
		Country:   req.Country,
		Role:      "student",
		CreatedAt: now,
		UpdatedAt: now,
	}

	res, _ := col.InsertOne(context.Background(), user)
	user.ID = res.InsertedID.(primitive.ObjectID)

	return c.Status(201).JSON(fiber.Map{"student": user})
}

func handleUpdateStudent(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid ID"})
	}

	var req StudentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	col := getCollection("users")

	// Check duplicate email (excluding current user)
	if req.Email != "" {
		emailCount, _ := col.CountDocuments(context.Background(), bson.M{"email": req.Email, "_id": bson.M{"$ne": id}})
		if emailCount > 0 {
			return c.Status(409).JSON(fiber.Map{"error": "Email already exists"})
		}
	}
	// Check duplicate username (excluding current user)
	if req.Username != "" {
		usernameCount, _ := col.CountDocuments(context.Background(), bson.M{"username": req.Username, "_id": bson.M{"$ne": id}})
		if usernameCount > 0 {
			return c.Status(409).JSON(fiber.Map{"error": "Username already exists"})
		}
	}

	update := bson.M{"updatedAt": time.Now()}
	if req.Name != "" {
		update["name"] = req.Name
	}
	if req.Email != "" {
		update["email"] = req.Email
	}
	if req.Username != "" {
		update["username"] = req.Username
	}
	if req.Phone != "" {
		update["phone"] = req.Phone
	}
	if req.City != "" {
		update["city"] = req.City
	}
	if req.Country != "" {
		update["country"] = req.Country
	}
	if req.Password != "" {
		update["password"] = hashPassword(req.Password)
	}

	var user User
	err = getCollection("users").FindOneAndUpdate(
		context.Background(),
		bson.M{"_id": id},
		bson.M{"$set": update},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&user)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Student not found"})
	}

	return c.JSON(fiber.Map{"student": user})
}

func handleDeleteStudent(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid ID"})
	}

	res, err := getCollection("users").DeleteOne(context.Background(), bson.M{"_id": id, "role": "student"})
	if err != nil || res.DeletedCount == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Student not found"})
	}

	return c.JSON(fiber.Map{"message": "Student deleted"})
}

func handleStudentAnalytics(c *fiber.Ctx) error {
	id, err := primitive.ObjectIDFromHex(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid ID"})
	}

	var student User
	err = getCollection("users").FindOne(context.Background(), bson.M{"_id": id, "role": "student"}).Decode(&student)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Student not found"})
	}

	// Get all allocations for this student
	cursor, err := getCollection("test_allocations").Find(context.Background(), bson.M{"student_id": id})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch allocations"})
	}
	defer cursor.Close(context.Background())

	var allocations []TestAllocation
	cursor.All(context.Background(), &allocations)

	completed := 0
	upcoming := 0
	for _, a := range allocations {
		if a.Status == "COMPLETED" {
			completed++
		} else if a.Status == "SCHEDULED" || a.Status == "IN_PROGRESS" {
			upcoming++
		}
	}

	// Calculate estimated score (placeholder — would need exam responses)
	verbalScore := 130
	quantScore := 130

	return c.JSON(fiber.Map{
		"student_name":    student.Name,
		"email":           student.Email,
		"total_tests":     len(allocations),
		"completed_tests": completed,
		"upcoming_tests":  upcoming,
		"estimated_score": fiber.Map{"verbal": verbalScore, "quant": quantScore, "overall": verbalScore + quantScore},
		"allocations":     allocations,
	})
}
