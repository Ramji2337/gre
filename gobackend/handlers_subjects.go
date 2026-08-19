package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
)

func handleAddSubject(c *fiber.Ctx) error {
	var req struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Subject name is required"})
	}

	for _, s := range getAllSubjects() {
		if strings.EqualFold(s, name) {
			return c.Status(409).JSON(fiber.Map{"error": "Subject already exists"})
		}
	}

	colName := strings.ToLower(strings.ReplaceAll(name, " ", "_")) + "_questions"

	getCollection("subjects").InsertOne(context.Background(), bson.M{
		"name":       name,
		"collection": colName,
		"created_at": time.Now(),
	})

	return c.Status(201).JSON(fiber.Map{
		"message":    "Subject created successfully",
		"subject":    name,
		"collection": colName,
	})
}

func handleAddCategory(c *fiber.Ctx) error {
	subject := c.Query("subject")
	if subject == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Subject is required"})
	}

	colName := subjectToCollection(subject)
	if colName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid subject"})
	}

	var req struct {
		Category string `json:"category"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	category := strings.TrimSpace(req.Category)
	if category == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Category name is required"})
	}

	existingCats, _ := getCollection(colName).Distinct(context.Background(), "category", bson.M{})
	for _, ec := range existingCats {
		if existingCat, ok := ec.(string); ok && strings.EqualFold(existingCat, category) {
			return c.Status(409).JSON(fiber.Map{"error": "Category already exists"})
		}
	}

	placeholder := bson.M{
		"question_id":     fmt.Sprintf("PLACEHOLDER_%s_%d", subject, time.Now().UnixNano()),
		"subject":         subject,
		"category":        category,
		"level":           "Medium",
		"question_type":   "PLACEHOLDER",
		"answer_format":   "SINGLE_CHOICE",
		"question_text":   "",
		"options":         []interface{}{},
		"correct_answers": []interface{}{},
		"explanation":     "",
		"images":          []interface{}{},
		"has_answer_image": false,
		"image_storage":   "S3",
		"tags":            []string{},
		"metadata":        bson.M{},
		"is_active":       false,
		"version":         1,
		"created_at":      time.Now(),
		"updated_at":      time.Now(),
		"is_placeholder":  true,
	}

	_, err := getCollection(colName).InsertOne(context.Background(), placeholder)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create category"})
	}

	return c.Status(201).JSON(fiber.Map{
		"message":  "Category created successfully",
		"category": category,
		"subject":  subject,
	})
}

func handleGetSubjects(c *fiber.Ctx) error {
	subjects := getAllSubjects()
	result := []fiber.Map{}
	for _, s := range subjects {
		colName := subjectToCollection(s)
		if colName == "" {
			continue
		}
		col := getCollection(colName)
		total, _ := col.CountDocuments(context.Background(), bson.M{})
		cats, _ := col.Distinct(context.Background(), "category", bson.M{})
		isDefault := s == "Quant" || s == "Verbal" || s == "AWA"
		result = append(result, fiber.Map{
			"name":         s,
			"total":        total,
			"categories":   cats,
			"is_default":   isDefault,
			"collection":   colName,
		})
	}
	return c.JSON(fiber.Map{"subjects": result})
}
