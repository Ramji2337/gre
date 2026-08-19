//go:build ignore

package main

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const mongoURI = "mongodb://localhost:27017"
const dbName   = "gre_db"

type OptionDoc struct {
	Label string `bson:"label"`
	Text  string `bson:"text"`
}

type CorrectAns struct {
	Value       string `bson:"value"`
	Format      string `bson:"format"`
	OptionLabel string `bson:"option_label"`
}

type QuestionDoc struct {
	ID             interface{}  `bson:"_id"`
	QuestionID     string       `bson:"question_id"`
	Subject        string       `bson:"subject"`
	Category       string       `bson:"category"`
	QuestionText   string       `bson:"question_text"`
	QuestionType   string       `bson:"question_type"`
	AnswerFormat   string       `bson:"answer_format"`
	IsMultiAnswer  bool         `bson:"is_multi_answer"`
	Options        []OptionDoc  `bson:"options"`
	CorrectAnswers []CorrectAns `bson:"correct_answers"`
	IsActive       bool         `bson:"is_active"`
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatalf("MongoDB connection error: %v", err)
	}
	defer client.Disconnect(ctx)

	db := client.Database(dbName)

	collections := []string{"verbal_questions", "quant_questions", "awa_questions"}

	var deactivatedDummyCount int
	var updatedMultiCount int
	var updatedTCCount int

	for _, colName := range collections {
		col := db.Collection(colName)
		cursor, err := col.Find(ctx, bson.M{})
		if err != nil {
			log.Printf("Error querying collection %s: %v", colName, err)
			continue
		}

		for cursor.Next(ctx) {
			var q QuestionDoc
			if err := cursor.Decode(&q); err != nil {
				continue
			}

			text := strings.TrimSpace(q.QuestionText)
			lowerText := strings.ToLower(text)
			numOpts := len(q.Options)
			numCorrect := len(q.CorrectAnswers)

			// 1. Check if question has corrupted dummy options (Option A, Option B, Option C, Option D)
			hasDummy := false
			for _, o := range q.Options {
				t := strings.ToLower(strings.TrimSpace(o.Text))
				if t == "option a" || t == "option b" || t == "option c" || t == "option d" {
					hasDummy = true
					break
				}
			}

			if hasDummy {
				// Deactivate corrupted dummy question
				_, _ = col.UpdateOne(ctx, bson.M{"_id": q.ID}, bson.M{
					"$set": bson.M{"is_active": false, "updated_at": time.Now()},
				})
				deactivatedDummyCount++
				continue
			}

			// 2. Fix questions with multiple correct answers but set as single choice
			if numCorrect > 1 && (!q.IsMultiAnswer || q.QuestionType == "MCQ") {
				newType := "MULTIPLE_CHOICE_MULTI"
				newFmt := "MULTI_CHOICE"
				if numOpts == 6 && q.Subject == "Verbal" {
					newType = "SENTENCE_EQUIVALENCE"
				}

				_, _ = col.UpdateOne(ctx, bson.M{"_id": q.ID}, bson.M{
					"$set": bson.M{
						"is_multi_answer": true,
						"question_type":   newType,
						"answer_format":   newFmt,
						"updated_at":      time.Now(),
					},
				})
				updatedMultiCount++
			}

			// 3. Fix multi-blank TC questions where type was wrong
			hasB1 := strings.Contains(lowerText, "blank i") || strings.Contains(lowerText, "blank (i)") || strings.Contains(lowerText, "(i)")
			hasB2 := strings.Contains(lowerText, "blank ii") || strings.Contains(lowerText, "blank (ii)") || strings.Contains(lowerText, "(ii)")
			hasB3 := strings.Contains(lowerText, "blank iii") || strings.Contains(lowerText, "blank (iii)") || strings.Contains(lowerText, "(iii)")

			if (hasB2 || hasB3 || hasB1) && q.Subject == "Verbal" {
				if numOpts == 9 && (q.QuestionType != "TEXT_COMPLETION" || q.AnswerFormat != "TEXT_COMPLETION_3") {
					_, _ = col.UpdateOne(ctx, bson.M{"_id": q.ID}, bson.M{
						"$set": bson.M{
							"question_type": "TEXT_COMPLETION",
							"answer_format": "TEXT_COMPLETION_3",
							"updated_at":    time.Now(),
						},
					})
					updatedTCCount++
				} else if numOpts == 6 && hasB2 && q.QuestionType != "SENTENCE_EQUIVALENCE" && (q.QuestionType != "TEXT_COMPLETION" || q.AnswerFormat != "TEXT_COMPLETION_2") {
					_, _ = col.UpdateOne(ctx, bson.M{"_id": q.ID}, bson.M{
						"$set": bson.M{
							"question_type": "TEXT_COMPLETION",
							"answer_format": "TEXT_COMPLETION_2",
							"updated_at":    time.Now(),
						},
					})
					updatedTCCount++
				}
			}
		}
		cursor.Close(ctx)
	}

	fmt.Println("================ DATABASE REPAIR COMPLETE ================")
	fmt.Printf("1. Deactivated corrupted dummy questions (Option A/B/C/D): %d\n", deactivatedDummyCount)
	fmt.Printf("2. Updated questions with >1 correct answers to Multi-Answer: %d\n", updatedMultiCount)
	fmt.Printf("3. Fixed multi-blank Text Completion types & formats: %d\n", updatedTCCount)
	fmt.Println("==========================================================")
}
