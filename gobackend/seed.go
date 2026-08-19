package main

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

func seedAdmin() {
	col := getCollection("users")
	filter := bson.M{"email": "admin@gre.com", "role": "admin"}
	count, _ := col.CountDocuments(context.Background(), filter)
	if count == 0 {
		now := time.Now()
		col.InsertOne(context.Background(), User{
			Email:     "admin@gre.com",
			Password:  hashPassword("admin123"),
			Name:      "Admin",
			Role:      "admin",
			CreatedAt: now,
			UpdatedAt: now,
		})
		log.Println("Default admin created: admin@gre.com / admin123")
	}
}
