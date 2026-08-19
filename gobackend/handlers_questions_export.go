package main

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/xuri/excelize/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func handleExportQuestions(c *fiber.Ctx) error {
	subject := c.Query("subject")
	if subject == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Subject is required (Quant, Verbal, AWA)"})
	}

	colName := subjectToCollection(subject)
	if colName == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid subject"})
	}

	col := getCollection(colName)
	findOpts := options.Find().SetSort(bson.D{{Key: "category", Value: 1}, {Key: "level", Value: 1}, {Key: "created_at", Value: 1}})
	cur, err := col.Find(context.Background(), bson.M{}, findOpts)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch questions"})
	}
	defer cur.Close(context.Background())

	var questions []Question
	if err := cur.All(context.Background(), &questions); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to decode questions"})
	}

	f := excelize.NewFile()
	sheetName := subject
	f.SetSheetName(f.GetSheetName(0), sheetName)

	// Subject-specific headers
	var headers []string
	var valuesPerQuestion func(Question) []interface{}
	var colWidths map[int]float64

	if subject == "AWA" {
		headers = []string{
			"Subject",
			"Category",
			"Difficulty",
			"Question Type",
			"Question Text",
			"Explanation",
		}
		colWidths = map[int]float64{
			0: 10, 1: 25, 2: 10, 3: 15, 4: 60, 5: 50,
		}
		valuesPerQuestion = func(q Question) []interface{} {
			return []interface{}{
				q.Subject,
				q.Category,
				q.Level,
				q.QuestionType,
				q.QuestionText,
				q.Explanation,
			}
		}
	} else {
		headers = []string{
			"Subject",
			"Category",
			"Difficulty",
			"Question Type",
			"Question Text",
			"Passage",
			"Option A",
			"Option B",
			"Option C",
			"Option D",
			"Option E",
			"Option F",
			"Correct Answer(s)",
			"Explanation",
			"Question Images",
			"Answer Images",
		}
		colWidths = map[int]float64{
			0: 10, 1: 25, 2: 10, 3: 22, 4: 50, 5: 40,
			6: 25, 7: 25, 8: 25, 9: 25, 10: 25, 11: 25,
			12: 15, 13: 50, 14: 30, 15: 30,
		}
		valuesPerQuestion = func(q Question) []interface{} {
			optionMap := map[string]string{}
			for _, opt := range q.Options {
				optionMap[opt.Label] = opt.Text
			}
			correctAnswers := []string{}
			for _, ca := range q.CorrectAnswers {
				if ca.OptionLabel != "" {
					correctAnswers = append(correctAnswers, ca.OptionLabel)
				} else if ca.Value != "" {
					correctAnswers = append(correctAnswers, ca.Value)
				}
			}
			questionImages := []string{}
			answerImages := []string{}
			for _, img := range q.Images {
				if img.Type == "answer" {
					answerImages = append(answerImages, img.ImageName)
				} else {
					questionImages = append(questionImages, img.ImageName)
				}
			}
			return []interface{}{
				q.Subject,
				q.Category,
				q.Level,
				q.QuestionType,
				q.QuestionText,
				q.Passage,
				optionMap["A"],
				optionMap["B"],
				optionMap["C"],
				optionMap["D"],
				optionMap["E"],
				optionMap["F"],
				strings.Join(correctAnswers, ","),
				q.Explanation,
				strings.Join(questionImages, ","),
				strings.Join(answerImages, ","),
			}
		}
	}

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 11, Color: "FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"2563EB"}},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
	})

	for i, h := range headers {
		col := i + 1
		cell, _ := excelize.CoordinatesToCellName(col, 1)
		f.SetCellValue(sheetName, cell, h)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
	}

	for i, w := range colWidths {
		cName, _ := excelize.ColumnNumberToName(i + 1)
		f.SetColWidth(sheetName, cName, cName, w)
	}

	bodyStyle, _ := f.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{Vertical: "top", WrapText: true},
	})

	for rowIdx, q := range questions {
		row := rowIdx + 2
		values := valuesPerQuestion(q)
		for i, v := range values {
			cell, _ := excelize.CoordinatesToCellName(i+1, row)
			f.SetCellValue(sheetName, cell, v)
			f.SetCellStyle(sheetName, cell, cell, bodyStyle)
		}
	}

	f.SetRowHeight(sheetName, 1, 30)

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to write Excel file"})
	}
	f.Close()

	filename := fmt.Sprintf("%s_Export_%s.xlsx", subject, time.Now().Format("20060102_150405"))
	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	return c.Send(buf.Bytes())
}
