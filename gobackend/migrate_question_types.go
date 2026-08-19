// +build ignore

// Run with:  go run migrate_question_types.go
// This is a standalone migration tool — do NOT include in the main server build.
package main

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const mongoURI  = "mongodb://localhost:27017"
const dbName    = "gre_db"

type MQOption struct {
	Label string `bson:"label"`
	Text  string `bson:"text"`
}

type MQDoc struct {
	ID           primitive.ObjectID `bson:"_id"`
	QuestionID   string             `bson:"question_id"`
	Subject      string             `bson:"subject"`
	Category     string             `bson:"category"`
	QuestionText string             `bson:"question_text"`
	QuestionType string             `bson:"question_type"`
	AnswerFormat string             `bson:"answer_format"`
	IsMultiAnswer bool              `bson:"is_multi_answer"`
	Options      []MQOption         `bson:"options"`
}

func classifyQuestion(q MQDoc) (questionType, answerFormat string, isMultiAnswer bool) {
	cat   := strings.ToUpper(strings.TrimSpace(q.Category))
	qtype := strings.ToUpper(strings.TrimSpace(q.QuestionType))
	qtext := strings.ToUpper(strings.TrimSpace(q.QuestionText))
	subj  := strings.ToUpper(strings.TrimSpace(q.Subject))
	nOpts := len(q.Options)

	// ── AWA ──────────────────────────────────────────────────────────────────
	if subj == "AWA" || strings.Contains(cat, "AWA") || strings.Contains(cat, "ANALYTICAL WRITING") || qtype == "AWA" {
		return "AWA", "ESSAY", false
	}

	// ── QUANT branch ─────────────────────────────────────────────────────────
	if subj == "QUANT" {
		// Quantitative Comparison: text mentions "Quantity A"
		if strings.Contains(qtext, "QUANTITY A") || strings.Contains(cat, "QUANTITATIVE COMPARISON") || qtype == "QUANTITATIVE_COMPARISON" {
			return "QUANTITATIVE_COMPARISON", "SINGLE_CHOICE", false
		}
		// Numeric Entry: zero options OR explicit category/type markers
		if nOpts == 0 || strings.Contains(cat, "NUMERIC ENTRY") || qtype == "NUMERIC_ENTRY" || qtype == "FRACTION" {
			return "NUMERIC_ENTRY", "NUMERIC_ENTRY", false
		}
		// Multiple-select (3-or-more correct): we can't always tell from structure alone,
		// but honour existing is_multi_answer or explicit type.
		if q.IsMultiAnswer || strings.Contains(qtype, "MULTI") || strings.Contains(qtype, "SELECT_MANY") {
			return "MULTIPLE_CHOICE_MULTI", "MULTI_CHOICE", true
		}
		// Default Quant: single-choice MCQ (5 opts normal)
		return "MCQ", "SINGLE_CHOICE", false
	}

	// ── VERBAL branch ─────────────────────────────────────────────────────────
	if subj == "VERBAL" {
		// Sentence Equivalence: always 6 options, pick 2
		if strings.Contains(cat, "SENTENCE EQUIVALENCE") || qtype == "SENTENCE_EQUIVALENCE" {
			return "SENTENCE_EQUIVALENCE", "MULTI_CHOICE", true
		}
		// Text Completion 2-blank: exactly 6 options + explicit marker OR category
		if strings.Contains(cat, "TEXT COMPLETION") || qtype == "TEXT_COMPLETION" {
			if nOpts == 6 {
				return "TEXT_COMPLETION", "TEXT_COMPLETION_2", false
			}
			if nOpts == 9 {
				return "TEXT_COMPLETION", "TEXT_COMPLETION_3", false
			}
			// Single-blank TC: 3 or 5 options
			return "TEXT_COMPLETION", "SINGLE_CHOICE", false
		}
		// Detect multi-blank by question text markers when category is generic
		hasBlankII := strings.Contains(qtext, "BLANK (II)") || strings.Contains(qtext, "BLANK II") ||
			strings.Contains(qtext, "(BLANK II)") || strings.Contains(qtext, "[BLANK II]")
		hasBlankIII := strings.Contains(qtext, "BLANK (III)") || strings.Contains(qtext, "BLANK III")

		if nOpts == 9 && hasBlankIII {
			return "TEXT_COMPLETION", "TEXT_COMPLETION_3", false
		}
		if nOpts == 6 && hasBlankII {
			return "TEXT_COMPLETION", "TEXT_COMPLETION_2", false
		}

		// Reading Comprehension multi-select
		if strings.Contains(cat, "READING COMPREHENSION") || qtype == "READING_COMPREHENSION" {
			if q.IsMultiAnswer || strings.Contains(qtype, "MULTI") {
				return "READING_COMPREHENSION", "MULTI_CHOICE", true
			}
			return "READING_COMPREHENSION", "SINGLE_CHOICE", false
		}

		// Sentence Equivalence detected by 6-option + non-TC
		if nOpts == 6 && !strings.Contains(cat, "TEXT COMPLETION") {
			return "SENTENCE_EQUIVALENCE", "MULTI_CHOICE", true
		}

		// Default Verbal: single-choice MCQ
		return "MCQ", "SINGLE_CHOICE", false
	}

	// Fallback: leave unchanged
	return q.QuestionType, q.AnswerFormat, q.IsMultiAnswer
}

func migrateCollection(ctx context.Context, col *mongo.Collection) (updated, skipped int) {
	cur, err := col.Find(ctx, bson.M{})
	if err != nil {
		log.Printf("  [ERROR] find: %v", err)
		return
	}
	defer cur.Close(ctx)

	for cur.Next(ctx) {
		var q MQDoc
		if err := cur.Decode(&q); err != nil {
			log.Printf("  [WARN] decode: %v", err)
			continue
		}

		newType, newFmt, newMulti := classifyQuestion(q)

		// Only update if something actually changed
		if newType == q.QuestionType && newFmt == q.AnswerFormat && newMulti == q.IsMultiAnswer {
			skipped++
			continue
		}

		_, err := col.UpdateOne(ctx,
			bson.M{"_id": q.ID},
			bson.M{"$set": bson.M{
				"question_type":  newType,
				"answer_format":  newFmt,
				"is_multi_answer": newMulti,
				"updated_at":     time.Now(),
			}},
		)
		if err != nil {
			log.Printf("  [ERROR] update %s: %v", q.QuestionID, err)
			continue
		}

		fmt.Printf("  ✓ %-20s  %s → type:%-30s fmt:%-22s multi:%v\n",
			q.QuestionID, q.Subject, newType, newFmt, newMulti)
		updated++
	}
	return
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatalf("MongoDB connect: %v", err)
	}
	defer client.Disconnect(ctx)

	db := client.Database(dbName)

	collections := []string{"verbal_questions", "quant_questions", "awa_questions"}
	totalUpdated, totalSkipped := 0, 0

	for _, colName := range collections {
		fmt.Printf("\n═══ Migrating: %s ═══\n", colName)
		u, s := migrateCollection(ctx, db.Collection(colName))
		totalUpdated += u
		totalSkipped += s
		fmt.Printf("    Updated: %d  |  Already correct (skipped): %d\n", u, s)
	}

	fmt.Printf("\n✅ Migration complete — Total updated: %d  |  Total skipped: %d\n", totalUpdated, totalSkipped)
}
