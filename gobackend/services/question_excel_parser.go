package services

import (
	"fmt"
	"io"
	"strings"

	"github.com/xuri/excelize/v2"
)

type QuestionExcelRow struct {
	Category       string
	Level          string
	QuestionType   string
	QuestionText   string
	Passage        string
	OptionA        string
	OptionB        string
	OptionC        string
	OptionD        string
	OptionE        string
	OptionF        string
	CorrectAnswer  string
	Explanation    string
	QuestionImages string
	AnswerImages   string
	ImageName      string
	ImageType      string
	HasAnswerImage string
}

func ParseQuestionExcel(file io.Reader) ([]QuestionExcelRow, []string, error) {
	f, err := excelize.OpenReader(file)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to open excel file: %w", err)
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, nil, fmt.Errorf("no sheets found in excel file")
	}

	rows, err := f.GetRows(sheets[0])
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read rows: %w", err)
	}

	if len(rows) == 0 {
		return nil, nil, fmt.Errorf("excel file is empty")
	}

	header := rows[0]

	aliases := map[string][]string{
		"category":         {"category", "sub category", "subcategory", "topic"},
		"level":            {"level", "difficulty", "difficulty level"},
		"question_type":    {"question type", "type", "qtype"},
		"question_text":    {"question text", "question", "questiontext", "q text"},
		"passage":          {"passage", "reading passage", "comprehension passage"},
		"option_a":         {"option a", "optiona", "a", "choice a"},
		"option_b":         {"option b", "optionb", "b", "choice b"},
		"option_c":         {"option c", "optionc", "c", "choice c"},
		"option_d":         {"option d", "optiond", "d", "choice d"},
		"option_e":         {"option e", "optione", "e", "choice e"},
		"option_f":         {"option f", "optionf", "f", "choice f"},
		"correct_answer":   {"correct answer", "correct", "answer", "correct option", "right answer"},
		"explanation":      {"explanation", "solution", "answer explanation", "rationale"},
		"question_images":  {"question images", "question image", "question image names", "question image name", "image name", "image", "image file", "image filename"},
		"answer_images":    {"answer images", "answer image", "answer image names", "answer image name", "answer image file"},
		"image_name":       {"image name", "image", "image file", "image filename", "question image"},
		"image_type":       {"image type", "image kind", "img type"},
		"has_answer_image": {"has answer image", "answer image", "has answer img"},
	}

	aliasToField := map[string]string{}
	for canonical, list := range aliases {
		for _, a := range list {
			aliasToField[a] = canonical
		}
	}

	colMap := map[string]int{}
	var missingCols []string
	for i, h := range header {
		cleaned := strings.ToLower(strings.TrimSpace(h))
		if canonical, ok := aliasToField[cleaned]; ok {
			colMap[canonical] = i
		}
	}

	requiredCols := []string{"question_text"}
	for _, req := range requiredCols {
		if _, ok := colMap[req]; !ok {
			missingCols = append(missingCols, req)
		}
	}

	if len(missingCols) > 0 {
		return nil, missingCols, fmt.Errorf("missing required columns: %v", missingCols)
	}

	getVal := func(row []string, key string) string {
		idx, ok := colMap[key]
		if !ok || idx >= len(row) {
			return ""
		}
		return strings.TrimSpace(row[idx])
	}

	var result []QuestionExcelRow
	for i := 1; i < len(rows); i++ {
		row := rows[i]
		qText := getVal(row, "question_text")
		if qText == "" {
			continue
		}

		level := getVal(row, "level")
		if level == "" {
			level = "Medium"
		}
		level = strings.Title(strings.ToLower(level))

		qType := getVal(row, "question_type")
		if qType == "" {
			qType = "MULTIPLE_CHOICE_SINGLE"
		}
		qType = strings.ToUpper(strings.ReplaceAll(qType, " ", "_"))

		imgType := getVal(row, "image_type")
		if imgType == "" {
			imgType = "question"
		}

		questionImgs := getVal(row, "question_images")
		if questionImgs == "" {
			questionImgs = getVal(row, "image_name")
		}
		answerImgs := getVal(row, "answer_images")

		result = append(result, QuestionExcelRow{
			Category:       getVal(row, "category"),
			Level:          level,
			QuestionType:   qType,
			QuestionText:   qText,
			Passage:        getVal(row, "passage"),
			OptionA:        getVal(row, "option_a"),
			OptionB:        getVal(row, "option_b"),
			OptionC:        getVal(row, "option_c"),
			OptionD:        getVal(row, "option_d"),
			OptionE:        getVal(row, "option_e"),
			OptionF:        getVal(row, "option_f"),
			CorrectAnswer:  strings.ToUpper(strings.TrimSpace(getVal(row, "correct_answer"))),
			Explanation:    getVal(row, "explanation"),
			QuestionImages: questionImgs,
			AnswerImages:   answerImgs,
			ImageName:      getVal(row, "image_name"),
			ImageType:      imgType,
			HasAnswerImage: getVal(row, "has_answer_image"),
		})
	}

	return result, nil, nil
}
