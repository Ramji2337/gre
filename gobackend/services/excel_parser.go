package services

import (
	"fmt"
	"io"
	"strings"

	"github.com/xuri/excelize/v2"
)

type ExcelRow struct {
	Name            string
	Email           string
	Username        string
	Phone           string
	City            string
	Country         string
	Password        string
	ConfirmPassword string
}

func ParseExcelFile(file io.Reader) ([]ExcelRow, error) {
	f, err := excelize.OpenReader(file)
	if err != nil {
		return nil, fmt.Errorf("failed to open excel file: %w", err)
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("no sheets found in excel file")
	}

	rows, err := f.GetRows(sheets[0])
	if err != nil {
		return nil, fmt.Errorf("failed to read rows: %w", err)
	}

	if len(rows) == 0 {
		return nil, fmt.Errorf("excel file is empty")
	}

	header := rows[0]

	// Canonical field name → list of possible header aliases (all lowercased)
	aliases := map[string][]string{
		"name":             {"name", "full name", "student name", "first name"},
		"email":            {"email", "email id", "email address", "e-mail", "mail"},
		"username":         {"username", "user name", "user id", "login id", "userid"},
		"phone":            {"phone", "phone number", "phone no", "phonenumber", "mobile", "mobile number", "mobile no", "mobileno", "contact", "contact number", "contact no", "cell", "cell number", "telephone", "tel"},
		"city":             {"city", "town", "location"},
		"country":          {"country", "nation", "nationality"},
		"password":         {"password", "pwd", "pass"},
		"confirm password": {"confirm password", "confirm", "confirm pwd", "cpassword", "retype password", "re-enter password"},
	}

	// Build reverse map: alias → canonical field
	aliasToField := map[string]string{}
	for canonical, list := range aliases {
		for _, a := range list {
			aliasToField[a] = canonical
		}
	}

	// Map canonical field name → column index
	colMap := map[string]int{}
	for i, h := range header {
		cleaned := strings.ToLower(strings.TrimSpace(h))
		if canonical, ok := aliasToField[cleaned]; ok {
			colMap[canonical] = i
		}
	}

	getVal := func(row []string, key string) string {
		idx, ok := colMap[key]
		if !ok || idx >= len(row) {
			return ""
		}
		return strings.TrimSpace(row[idx])
	}

	var result []ExcelRow
	for i := 1; i < len(rows); i++ {
		row := rows[i]
		name := getVal(row, "name")
		email := getVal(row, "email")

		if name == "" && email == "" {
			continue
		}

		result = append(result, ExcelRow{
			Name:            name,
			Email:           email,
			Username:        getVal(row, "username"),
			Phone:           getVal(row, "phone"),
			City:            getVal(row, "city"),
			Country:         getVal(row, "country"),
			Password:        getVal(row, "password"),
			ConfirmPassword: getVal(row, "confirm password"),
		})
	}

	return result, nil
}
