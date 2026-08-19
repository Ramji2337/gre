package main

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type User struct {
	ID        primitive.ObjectID `json:"_id" bson:"_id,omitempty"`
	Email     string             `json:"email" bson:"email"`
	Password  string             `json:"-" bson:"password"`
	Name      string             `json:"name" bson:"name"`
	Username  string             `json:"username" bson:"username"`
	Phone     string             `json:"phone" bson:"phone"`
	City      string             `json:"city" bson:"city"`
	Country   string             `json:"country" bson:"country"`
	Role      string             `json:"role" bson:"role"`
	CreatedAt time.Time          `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time          `json:"updatedAt" bson:"updatedAt"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Name     string `json:"name"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Phone    string `json:"phone"`
	City     string `json:"city"`
	Country  string `json:"country"`
}

type StudentRequest struct {
	Name     string `json:"name"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Phone    string `json:"phone"`
	City     string `json:"city"`
	Country  string `json:"country"`
}

type QuestionOption struct {
	Label string `json:"label" bson:"label"`
	Text  string `json:"text" bson:"text"`
}

type CorrectAnswer struct {
	Value       string `json:"value" bson:"value"`
	Format      string `json:"format" bson:"format"`
	OptionLabel string `json:"option_label" bson:"option_label"`
}

type QuestionImage struct {
	Type      string `json:"type" bson:"type"`
	ImageName string `json:"image_name" bson:"image_name"`
	Storage   string `json:"storage" bson:"storage"`
	Caption   string `json:"caption" bson:"caption"`
}

type Question struct {
	ID             primitive.ObjectID `json:"_id" bson:"_id,omitempty"`
	QuestionID     string             `json:"question_id" bson:"question_id"`
	Subject        string             `json:"subject" bson:"subject"`
	Category       string             `json:"category" bson:"category"`
	Level          string             `json:"level" bson:"level"`
	QuestionType   string             `json:"question_type" bson:"question_type"`
	AnswerFormat   string             `json:"answer_format" bson:"answer_format"`
	IsMultiAnswer  bool               `json:"is_multi_answer" bson:"is_multi_answer"`
	QuestionText   string             `json:"question_text" bson:"question_text"`
	Passage        string             `json:"passage" bson:"passage"`
	Options        []QuestionOption   `json:"options" bson:"options"`
	CorrectAnswers []CorrectAnswer    `json:"correct_answers" bson:"correct_answers"`
	Explanation    string             `json:"explanation" bson:"explanation"`
	Images         []QuestionImage    `json:"images" bson:"images"`
	HasAnswerImage bool               `json:"has_answer_image" bson:"has_answer_image"`
	ImageStorage   string             `json:"image_storage" bson:"image_storage"`
	IsActive       bool               `json:"is_active" bson:"is_active"`
	CreatedAt      time.Time          `json:"created_at" bson:"created_at"`
	UpdatedAt      time.Time          `json:"updated_at" bson:"updated_at"`
}

type QuestionRequest struct {
	Subject        string           `json:"subject"`
	Category       string           `json:"category"`
	Level          string           `json:"level"`
	QuestionType   string           `json:"question_type"`
	AnswerFormat   string           `json:"answer_format"`
	IsMultiAnswer  bool             `json:"is_multi_answer"`
	QuestionText   string           `json:"question_text"`
	Passage        string           `json:"passage"`
	Options        []QuestionOption `json:"options"`
	CorrectAnswers []CorrectAnswer  `json:"correct_answers"`
	Explanation    string           `json:"explanation"`
	Images         []QuestionImage  `json:"images"`
	HasAnswerImage bool             `json:"has_answer_image"`
	ImageStorage   string           `json:"image_storage"`
}
