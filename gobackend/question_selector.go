package main

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type QuestionSelector struct {
	StudentID primitive.ObjectID
}

func NewQuestionSelector(studentID primitive.ObjectID) *QuestionSelector {
	return &QuestionSelector{StudentID: studentID}
}

func (qs *QuestionSelector) getSeenQuestionIDs() (map[string]bool, error) {
	cur, err := getCollection("student_question_history").Find(
		context.Background(),
		bson.M{"student_id": qs.StudentID},
	)
	if err != nil {
		return nil, err
	}
	defer cur.Close(context.Background())

	seen := make(map[string]bool)
	for cur.Next(context.Background()) {
		var h StudentQuestionHistory
		if err := cur.Decode(&h); err == nil {
			seen[h.QuestionID] = true
		}
	}
	return seen, nil
}

func (qs *QuestionSelector) selectFromCollection(colName string, count int, levelFilter string) ([]Question, error) {
	seenMap, err := qs.getSeenQuestionIDs()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch seen question history: %w", err)
	}

	filter := bson.M{"is_active": true}
	if levelFilter != "" {
		filter["level"] = levelFilter
	}

	cur, err := getCollection(colName).Find(context.Background(), filter)
	if err != nil {
		return nil, err
	}
	defer cur.Close(context.Background())

	var allQuestions []Question
	if err := cur.All(context.Background(), &allQuestions); err != nil {
		return nil, err
	}

	rand.Shuffle(len(allQuestions), func(i, j int) {
		allQuestions[i], allQuestions[j] = allQuestions[j], allQuestions[i]
	})

	var unseen []Question
	var seenQuestions []Question
	for _, q := range allQuestions {
		if seenMap[q.QuestionID] {
			seenQuestions = append(seenQuestions, q)
		} else {
			unseen = append(unseen, q)
		}
	}

	result := []Question{}
	for _, q := range unseen {
		if len(result) >= count {
			break
		}
		result = append(result, q)
	}

	if len(result) < count {
		for _, q := range seenQuestions {
			if len(result) >= count {
				break
			}
			result = append(result, q)
		}
	}

	if len(result) < count {
		for _, q := range allQuestions {
			if len(result) >= count {
				break
			}
			alreadyAdded := false
			for _, r := range result {
				if r.QuestionID == q.QuestionID {
					alreadyAdded = true
					break
				}
			}
			if !alreadyAdded {
				result = append(result, q)
			}
		}
	}

	return result, nil
}

func (qs *QuestionSelector) SelectFullLengthExam() ([]TestSection, []string, error) {
	awaQuestions, err := qs.selectFromCollection("awa_questions", 1, "")
	if err != nil {
		return nil, nil, err
	}

	verbalQuestions, err := qs.selectFromCollection("verbal_questions", 12, "")
	if err != nil {
		return nil, nil, err
	}

	quantQuestions, err := qs.selectFromCollection("quant_questions", 12, "")
	if err != nil {
		return nil, nil, err
	}

	sections := []TestSection{
		{Name: "Analytical Writing", Subject: "AWA", Difficulty: "", QuestionIDs: extractQuestionIDs(awaQuestions), DurationMins: 30, RemainingTimeSecs: 1800, Locked: false, IsSelected: true},
		{Name: "Verbal Reasoning 1", Subject: "Verbal", Difficulty: "", QuestionIDs: extractQuestionIDs(verbalQuestions), DurationMins: 18, RemainingTimeSecs: 1080, Locked: false, IsSelected: true},
		{Name: "Verbal Reasoning 2", Subject: "Verbal", Difficulty: "", QuestionIDs: []string{}, DurationMins: 23, RemainingTimeSecs: 1380, Locked: true, IsSelected: false},
		{Name: "Quantitative Reasoning 1", Subject: "Quant", Difficulty: "", QuestionIDs: extractQuestionIDs(quantQuestions), DurationMins: 21, RemainingTimeSecs: 1260, Locked: false, IsSelected: true},
		{Name: "Quantitative Reasoning 2", Subject: "Quant", Difficulty: "", QuestionIDs: []string{}, DurationMins: 26, RemainingTimeSecs: 1560, Locked: true, IsSelected: false},
	}

	allIDs := []string{}
	allIDs = append(allIDs, extractQuestionIDs(awaQuestions)...)
	allIDs = append(allIDs, extractQuestionIDs(verbalQuestions)...)
	allIDs = append(allIDs, extractQuestionIDs(quantQuestions)...)

	return sections, allIDs, nil
}

func (qs *QuestionSelector) SelectAdaptiveSection2(subject string, difficulty string, count int) ([]string, error) {
	return qs.SelectAdaptiveModule(subject, difficulty, count, nil)
}

func (qs *QuestionSelector) SelectAdaptiveModule(subject string, difficulty string, count int, excludeIDs []string) ([]string, error) {
	colName := subjectToCollection(subject)
	if colName == "" {
		return nil, fmt.Errorf("unknown subject: %s", subject)
	}

	seenMap, err := qs.getSeenQuestionIDs()
	if err != nil {
		log.Printf("Warning: could not fetch seen questions: %v", err)
		seenMap = make(map[string]bool)
	}

	excludeSet := make(map[string]bool)
	for _, id := range excludeIDs {
		excludeSet[id] = true
	}

	filter := bson.M{"is_active": true}
	if difficulty != "" {
		filter["level"] = difficulty
	}

	cur, err := getCollection(colName).Find(context.Background(), filter)
	if err != nil {
		return nil, err
	}
	defer cur.Close(context.Background())

	var allQuestions []Question
	if err := cur.All(context.Background(), &allQuestions); err != nil {
		return nil, err
	}

	rand.Shuffle(len(allQuestions), func(i, j int) {
		allQuestions[i], allQuestions[j] = allQuestions[j], allQuestions[i]
	})

	var unseen []Question
	var seenQuestions []Question
	for _, q := range allQuestions {
		if excludeSet[q.QuestionID] {
			continue
		}
		if seenMap[q.QuestionID] {
			seenQuestions = append(seenQuestions, q)
		} else {
			unseen = append(unseen, q)
		}
	}

	result := []Question{}
	for _, q := range unseen {
		if len(result) >= count {
			break
		}
		result = append(result, q)
	}

	if len(result) < count {
		for _, q := range seenQuestions {
			if len(result) >= count {
				break
			}
			result = append(result, q)
		}
	}

	if len(result) < count {
		for _, q := range allQuestions {
			if len(result) >= count {
				break
			}
			if excludeSet[q.QuestionID] {
				continue
			}
			alreadyAdded := false
			for _, r := range result {
				if r.QuestionID == q.QuestionID {
					alreadyAdded = true
					break
				}
			}
			if !alreadyAdded {
				result = append(result, q)
			}
		}
	}

	// Ultimate fallback: if still under count because level filter was too restrictive, fetch any active questions
	if len(result) < count {
		fallbackCur, err := getCollection(colName).Find(context.Background(), bson.M{"is_active": true})
		if err == nil {
			var fallbackQuestions []Question
			if fallbackCur.All(context.Background(), &fallbackQuestions) == nil {
				rand.Shuffle(len(fallbackQuestions), func(i, j int) {
					fallbackQuestions[i], fallbackQuestions[j] = fallbackQuestions[j], fallbackQuestions[i]
				})
				for _, q := range fallbackQuestions {
					if len(result) >= count {
						break
					}
					if excludeSet[q.QuestionID] {
						continue
					}
					alreadyAdded := false
					for _, r := range result {
						if r.QuestionID == q.QuestionID {
							alreadyAdded = true
							break
						}
					}
					if !alreadyAdded {
						result = append(result, q)
					}
				}
			}
			fallbackCur.Close(context.Background())
		}
	}

	return extractQuestionIDs(result), nil
}

func extractQuestionIDs(questions []Question) []string {
	ids := make([]string, 0, len(questions))
	for _, q := range questions {
		ids = append(ids, q.QuestionID)
	}
	return ids
}

func recordQuestionHistory(studentID primitive.ObjectID, testID string, questionIDs []string, subject string) {
	docs := []interface{}{}
	now := time.Now()
	for _, qid := range questionIDs {
		docs = append(docs, StudentQuestionHistory{
			StudentID:   studentID,
			QuestionID:  qid,
			TestID:      testID,
			Subject:     subject,
			AttemptedAt: now,
		})
	}
	if len(docs) > 0 {
		opts := options.InsertMany().SetOrdered(false)
		getCollection("student_question_history").InsertMany(context.Background(), docs, opts)
	}
}
