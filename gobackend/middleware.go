package main

import (
	"github.com/gofiber/fiber/v2"
)

func authMiddleware(c *fiber.Ctx) error {
	token := c.Get("Authorization")
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}
	if token == "" {
		return c.Status(401).JSON(fiber.Map{"error": "No token"})
	}

	claims, err := parseJWT(token)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid token"})
	}

	c.Locals("userID", claims["id"])
	c.Locals("email", claims["email"])
	c.Locals("role", claims["role"])
	return c.Next()
}

func adminOnly(c *fiber.Ctx) error {
	if c.Locals("role") != "admin" {
		return c.Status(403).JSON(fiber.Map{"error": "Admin only"})
	}
	return c.Next()
}
