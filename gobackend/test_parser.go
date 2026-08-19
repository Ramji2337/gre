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
	}

	for _, path := range files {
		f, err := os.Open(path)
		if err != nil {
			fmt.Println("Error opening file:", path, err)
			continue
		}
		rows, missing, err := services.ParseQuestionExcel(f)
		f.Close()
		fmt.Printf("File: %s | Rows Parsed: %d | Missing Cols: %v | Error: %v\n", path, len(rows), missing, err)
		if len(rows) > 0 {
			fmt.Printf("  Sample Row 1: Text='%s', Type='%s', Level='%s', Answer='%s'\n", rows[0].QuestionText, rows[0].QuestionType, rows[0].Level, rows[0].CorrectAnswer)
		}
	}
}
