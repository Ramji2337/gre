package main

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"

	"gre-backend/services"
)

type BulkImportResult struct {
	Name   string `json:"name"`
	Email  string `json:"email"`
	Status string `json:"status"`
	Reason string `json:"reason,omitempty"`
}

type BulkImportSummary struct {
	Total   int                `json:"total"`
	Created int                `json:"created"`
	Skipped int                `json:"skipped"`
	Failed  int                `json:"failed"`
	Results []BulkImportResult `json:"results"`
}

func handleBulkImport(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "No file uploaded"})
	}

	if !strings.HasSuffix(strings.ToLower(file.Filename), ".xlsx") &&
		!strings.HasSuffix(strings.ToLower(file.Filename), ".xls") {
		return c.Status(400).JSON(fiber.Map{"error": "Only .xlsx and .xls files are supported"})
	}

	src, err := file.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to open file"})
	}
	defer src.Close()

	rows, err := services.ParseExcelFile(src)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": fmt.Sprintf("Excel parse error: %v", err)})
	}

	col := getCollection("users")
	summary := BulkImportSummary{Results: []BulkImportResult{}}

	for _, row := range rows {
		summary.Total++
		result := BulkImportResult{Name: row.Name, Email: row.Email}

		if row.Name == "" || row.Email == "" {
			result.Status = "failed"
			result.Reason = "Name and email are required"
			summary.Failed++
			summary.Results = append(summary.Results, result)
			continue
		}

		count, _ := col.CountDocuments(context.Background(), bson.M{"email": row.Email})
		if count > 0 {
			result.Status = "skipped"
			result.Reason = "Email already exists"
			summary.Skipped++
			summary.Results = append(summary.Results, result)
			continue
		}

		username := row.Username
		if username == "" {
			username = strings.Split(row.Email, "@")[0]
		}
		usernameCount, _ := col.CountDocuments(context.Background(), bson.M{"username": username})
		if usernameCount > 0 {
			result.Status = "failed"
			result.Reason = "Username already exists"
			summary.Failed++
			summary.Results = append(summary.Results, result)
			continue
		}

		password := row.Password
		if password == "" {
			password = services.GenerateRandomPassword(12)
		}

		now := time.Now()
		user := User{
			Email:     row.Email,
			Password:  hashPassword(password),
			Name:      row.Name,
			Username:  username,
			Phone:     row.Phone,
			City:      row.City,
			Country:   row.Country,
			Role:      "student",
			CreatedAt: now,
			UpdatedAt: now,
		}

		_, err := col.InsertOne(context.Background(), user)
		if err != nil {
			result.Status = "failed"
			result.Reason = fmt.Sprintf("DB error: %v", err)
			summary.Failed++
			summary.Results = append(summary.Results, result)
			continue
		}

		// Send email with credentials
		go func(email, name, pwd string) {
			if err := services.SendStudentCredentials(email, name, pwd); err != nil {
				log.Printf("Failed to send email to %s: %v", email, err)
			}
		}(row.Email, row.Name, password)

		result.Status = "created"
		summary.Created++
		summary.Results = append(summary.Results, result)
	}

	return c.JSON(summary)
}

type RetryRow struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Username string `json:"username"`
	Phone    string `json:"phone"`
	City     string `json:"city"`
	Country  string `json:"country"`
	Password string `json:"password"`
}

func handleBulkImportRetry(c *fiber.Ctx) error {
	var rows []RetryRow
	if err := c.BodyParser(&rows); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	col := getCollection("users")
	summary := BulkImportSummary{Results: []BulkImportResult{}}

	for _, row := range rows {
		summary.Total++
		result := BulkImportResult{Name: row.Name, Email: row.Email}

		if row.Name == "" || row.Email == "" {
			result.Status = "failed"
			result.Reason = "Name and email are required"
			summary.Failed++
			summary.Results = append(summary.Results, result)
			continue
		}

		emailCount, _ := col.CountDocuments(context.Background(), bson.M{"email": row.Email})
		if emailCount > 0 {
			result.Status = "skipped"
			result.Reason = "Email already exists"
			summary.Skipped++
			summary.Results = append(summary.Results, result)
			continue
		}

		username := row.Username
		if username == "" {
			username = strings.Split(row.Email, "@")[0]
		}
		usernameCount, _ := col.CountDocuments(context.Background(), bson.M{"username": username})
		if usernameCount > 0 {
			result.Status = "failed"
			result.Reason = "Username already exists"
			summary.Failed++
			summary.Results = append(summary.Results, result)
			continue
		}

		password := row.Password
		if password == "" {
			password = services.GenerateRandomPassword(12)
		}

		now := time.Now()
		user := User{
			Email:     row.Email,
			Password:  hashPassword(password),
			Name:      row.Name,
			Username:  username,
			Phone:     row.Phone,
			City:      row.City,
			Country:   row.Country,
			Role:      "student",
			CreatedAt: now,
			UpdatedAt: now,
		}

		_, err := col.InsertOne(context.Background(), user)
		if err != nil {
			result.Status = "failed"
			result.Reason = fmt.Sprintf("DB error: %v", err)
			summary.Failed++
			summary.Results = append(summary.Results, result)
			continue
		}

		go func(email, name, pwd string) {
			if err := services.SendStudentCredentials(email, name, pwd); err != nil {
				log.Printf("Failed to send email to %s: %v", email, err)
			}
		}(row.Email, row.Name, password)

		result.Status = "created"
		summary.Created++
		summary.Results = append(summary.Results, result)
	}

	return c.JSON(summary)
}
