package main

import (
	"context"

	"go.mongodb.org/mongo-driver/mongo"
)

var client *mongo.Client

func getDB() *mongo.Database {
	return client.Database(DB_NAME)
}

func getCollection(name string) *mongo.Collection {
	return getDB().Collection(name)
}

func closeDB() {
	if client != nil {
		client.Disconnect(context.Background())
	}
}
