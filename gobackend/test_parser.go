//go:build ignore

package main

import (
	"fmt"
	"os"
	"gre-backend/services"
)

func main() {
	files := []string{
		"/home/ramji/Desktop/GRE/gre/excels/sample_awa_questions.xlsx",
		"/home/ramji/Desktop/GRE/gre/excels/sample_quant_questions.xlsx",
		"/home/ramji/Desktop/GRE/gre/excels/sample_verbal_questions.xlsx",
		"/home/ramji/Desktop/GRE/gre/excels/sample_image_questions.xlsx",
	}

	for i, path := range files {
		f, err := os.Open(path)
		if err != nil {
			fmt.Println("Error opening file:", path, err)
			continue
		}
		rows, missing, err := services.ParseQuestionExcel(f)
		f.Close()
		fmt.Printf("[%d] File: %s | Rows Parsed: %d | Missing Cols: %v | Error: %v\n", i+1, path, len(rows), missing, err)
		if len(rows) > 0 {
			fmt.Printf("    Sample Row 1: Text='%s', Type='%s', Level='%s', Answer='%s', QImages='%s', AnsImages='%s'\n",
				truncate(rows[0].QuestionText, 50), rows[0].QuestionType, rows[0].Level, rows[0].CorrectAnswer, rows[0].QuestionImages, rows[0].AnswerImages)
		}
	}
}

func truncate(s string, n int) string {
	if len(s) > n {
		return s[:n] + "..."
	}
	return s
}
