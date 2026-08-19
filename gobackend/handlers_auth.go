package main

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func handleLogin(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}
	if req.Email == "" || req.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Email and password required"})
	}

	var user User
	col := getCollection("users")
	err := col.FindOne(context.Background(), bson.M{"email": req.Email}).Decode(&user)
	if err != nil || !checkPassword(user.Password, req.Password) {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	token := signJWT(user)
	return c.JSON(fiber.Map{
		"token": token,
		"user":  fiber.Map{"email": user.Email, "name": user.Name, "role": user.Role},
	})
}

func handleRegister(c *fiber.Ctx) error {
	var req RegisterRequest
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

	token := signJWT(user)
	return c.Status(201).JSON(fiber.Map{
		"token": token,
		"user":  fiber.Map{"email": user.Email, "name": user.Name, "role": user.Role},
	})
}

func handleMe(c *fiber.Ctx) error {
	userID, _ := primitive.ObjectIDFromHex(c.Locals("userID").(string))
	var user User
	getCollection("users").FindOne(context.Background(), bson.M{"_id": userID}).Decode(&user)
	return c.JSON(fiber.Map{"user": fiber.Map{
		"_id": user.ID, "email": user.Email, "name": user.Name, "role": user.Role,
	}})
}
