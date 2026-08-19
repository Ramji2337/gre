// +build ignore

// Run with: go run migrate_fix_merged_tc.go
// Fixes Text Completion questions where the Excel parser merged multiple options
// into a single option cell. Splits them back and sets correct type fields.
package main

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const fixMongoURI = "mongodb://localhost:27017"
const fixDBName   = "gre_db"

type FixOption struct {
	Label string `bson:"label"`
	Text  string `bson:"text"`
}

type FixDoc struct {
	ID           primitive.ObjectID `bson:"_id"`
	QuestionID   string             `bson:"question_id"`
	Options      []FixOption        `bson:"options"`
}

// labelPattern extracts (A), (B)...(I) prefixes from merged cell text
var labelPattern = regexp.MustCompile(`\(([A-I])\)\s*`)

// splitMergedOption splits text like "(G) assuage\n(H) refute\n(I) discomfit"
// into [{G, "assuage"}, {H, "refute"}, {I, "discomfit"}]
func splitMergedOption(text string) []FixOption {
	// Normalize: replace (X) with a delimiter we can split on
	norm := labelPattern.ReplaceAllStringFunc(text, func(m string) string {
		// Extract the letter
		match := labelPattern.FindStringSubmatch(m)
		if len(match) < 2 {
			return m
		}
		return "|||" + match[1] + "|||"
	})

	parts := strings.Split(norm, "|||")
	var result []FixOption
	for i := 0; i+1 < len(parts); i += 2 {
		label := strings.TrimSpace(parts[i])
		var optText string
		if i+1 < len(parts) {
			optText = strings.TrimSpace(parts[i+1])
		}
		if label != "" {
			result = append(result, FixOption{Label: label, Text: optText})
		}
	}
	return result
}

// expandOptions takes the stored (possibly merged) options and returns
// the fully expanded set of individual options.
func expandOptions(opts []FixOption) ([]FixOption, bool) {
	var expanded []FixOption
	changed := false

	for _, o := range opts {
		// Does this option text contain embedded (X) labels for other options?
		if labelPattern.MatchString(o.Text) {
			// Check if the embedded labels are DIFFERENT from this option's own label
			matches := labelPattern.FindAllStringSubmatch(o.Text, -1)
			hasOtherLabels := false
			for _, m := range matches {
				if len(m) >= 2 && m[1] != o.Label {
					hasOtherLabels = true
					break
				}
			}
			if hasOtherLabels {
				sub := splitMergedOption(o.Text)
				if len(sub) > 0 {
					expanded = append(expanded, sub...)
					changed = true
					continue
				}
			}
		}
		// No merge — keep as-is but strip leading label prefix from text
		clean := labelPattern.ReplaceAllString(o.Text, "")
		clean = strings.TrimSpace(clean)
		if clean != o.Text {
			changed = true
			expanded = append(expanded, FixOption{Label: o.Label, Text: clean})
		} else {
			expanded = append(expanded, o)
		}
	}
	return expanded, changed
}

// answerFormatFromCount returns TEXT_COMPLETION_2 for 6 options, TEXT_COMPLETION_3 for 9
func answerFormatFromCount(n int) string {
	switch n {
	case 6:
		return "TEXT_COMPLETION_2"
	case 9:
		return "TEXT_COMPLETION_3"
	case 3:
		return "TEXT_COMPLETION_1"
	default:
		return "TEXT_COMPLETION"
	}
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(fixMongoURI))
	if err != nil {
		log.Fatalf("MongoDB connect: %v", err)
	}
	defer client.Disconnect(ctx)

	col := client.Database(fixDBName).Collection("verbal_questions")

	// Find all questions that have at least one option whose text contains an embedded (H) or (I) label
	cur, err := col.Find(ctx, bson.M{
		"options.text": bson.M{"$regex": `\([H-I]\)`, "$options": "i"},
	})
	if err != nil {
		log.Fatalf("find: %v", err)
	}
	defer cur.Close(ctx)

	updated := 0
	for cur.Next(ctx) {
		var q FixDoc
		if err := cur.Decode(&q); err != nil {
			log.Printf("decode error: %v", err)
			continue
		}

		expanded, changed := expandOptions(q.Options)
		if !changed {
			fmt.Printf("  SKIP (no change): %s\n", q.QuestionID)
			continue
		}

		nOpts := len(expanded)
		fmt.Printf("  FIX %s: %d opts -> %d opts\n", q.QuestionID, len(q.Options), nOpts)
		for _, o := range expanded {
			fmt.Printf("    [%s] %s\n", o.Label, o.Text)
		}

		answerFmt := answerFormatFromCount(nOpts)

		_, err := col.UpdateOne(ctx,
			bson.M{"_id": q.ID},
			bson.M{"$set": bson.M{
				"options":         expanded,
				"question_type":   "TEXT_COMPLETION",
				"answer_format":   answerFmt,
				"is_multi_answer": false,
				"updated_at":      time.Now(),
			}},
		)
		if err != nil {
			log.Printf("  [ERROR] update %s: %v", q.QuestionID, err)
			continue
		}
		updated++
	}

	fmt.Printf("\n✅ Done — Fixed %d questions with merged options.\n", updated)
}
