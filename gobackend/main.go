package main

import (
	"context"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func main() {
	app := fiber.New()
	app.Use(cors.New(cors.Config{
		AllowOrigins: "http://localhost:3001,http://localhost:3000",
		AllowHeaders: "Origin,Content-Type,Accept,Authorization",
	}))

	// Connect MongoDB
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	var err error
	client, err = mongo.Connect(ctx, options.Client().ApplyURI(MONGO_URI))
	if err != nil {
		log.Fatal("MongoDB connection error:", err)
	}
	defer closeDB()
	log.Println("MongoDB connected")

	// Seed admin
	seedAdmin()

	// --- Auth Routes ---
	app.Post("/api/login", handleLogin)
	app.Post("/api/register", handleRegister)
	app.Get("/api/me", authMiddleware, handleMe)

	// --- Admin Routes ---
	admin := app.Group("/api/admin", authMiddleware, adminOnly)
	admin.Get("/stats", handleAdminStats)
	admin.Get("/students", handleListStudents)
	admin.Post("/students", handleCreateStudent)
	admin.Post("/students/bulk-import", handleBulkImport)
	admin.Post("/students/bulk-import-retry", handleBulkImportRetry)
	admin.Put("/students/:id", handleUpdateStudent)
	admin.Delete("/students/:id", handleDeleteStudent)
	admin.Get("/students/:id/analytics", handleStudentAnalytics)

	// Question Bank Routes
	admin.Get("/questions", handleListQuestions)
	admin.Get("/questions/stats", handleGetQuestionStats)
	admin.Get("/questions/categories", handleGetCategories)
	admin.Get("/questions/export", handleExportQuestions)
	admin.Get("/questions/:id", handleGetQuestion)
	admin.Post("/questions", handleCreateQuestion)
	admin.Put("/questions/:id", handleUpdateQuestion)
	admin.Delete("/questions/:id", handleDeleteQuestion)
	admin.Post("/questions/bulk-upload", handleBulkUploadQuestions)
	admin.Post("/questions/upload-image", handleUploadImage)
	admin.Get("/subjects", handleGetSubjects)
	admin.Post("/subjects", handleAddSubject)
	admin.Post("/categories", handleAddCategory)

	// Test Allocation Routes
	admin.Post("/tests/allocate", handleAllocateTest)
	admin.Get("/tests/allocations", handleListAllocations)
	admin.Get("/tests/allocations/:id", handleGetAllocation)
	admin.Delete("/tests/allocations/:id", handleCancelAllocation)
	admin.Put("/tests/allocations/:id", handleRescheduleAllocation)
	admin.Post("/tests/allocations/:id/reallocate", handleReallocateTest)
	admin.Get("/tests/allocations/:id/questions", handleGetAllocationQuestions)
	admin.Get("/tests/allocations/:id/student-answers", handleGetStudentAnswersSummary)
	admin.Get("/tests/allocations/:id/violations", handleGetAllocationViolations)

	// Adaptive Settings Routes
	admin.Get("/adaptive-settings", handleGetAdaptiveSettings)
	admin.Put("/adaptive-settings", handleUpdateAdaptiveSettings)

	// --- Student Routes ---
	student := app.Group("/api/student", authMiddleware)
	student.Get("/stats", handleStudentStats)
	student.Get("/dashboard", handleStudentDashboard)
	student.Get("/available-tests", handleStudentAvailableTests)
	student.Get("/history", handleStudentHistory)
	student.Post("/tests/:id/start", handleStartTest)
	student.Post("/tests/:id/start-section", handleStartSection)
	student.Get("/tests/:id/questions", handleGetTestQuestions)
	student.Post("/tests/:id/submit", handleSubmitExam)
	student.Post("/tests/:id/violation", handleLogViolation)
	student.Post("/tests/:id/answer", handleSaveAnswer)
	student.Post("/tests/:id/flush-answers", handleFlushAnswers)
	student.Get("/tests/:id/result", handleGetTestResult)
	student.Get("/analytics", handleStudentAnalyticsPage)
	student.Post("/tests/allocations/:id/submit-section", handleSubmitSection)

	// Public Routes
	app.Get("/api/public/questions", handlePublicListQuestions)
	app.Get("/api/public/categories", handleGetCategories)
	app.Static("/public", "../front/public")

	// Public Image Proxy
	app.Get("/api/images/:filename", handleGetImage)

	// Health
	app.Get("/api/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	log.Println("Server running on http://localhost:" + PORT)
	log.Fatal(app.Listen(":" + PORT))
}
