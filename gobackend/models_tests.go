package main

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type TestAllocation struct {
	ID             primitive.ObjectID `json:"_id" bson:"_id,omitempty"`
	TestID         string             `json:"test_id" bson:"test_id"`
	StudentID      primitive.ObjectID `json:"student_id" bson:"student_id"`
	StudentName    string             `json:"student_name" bson:"student_name"`
	StudentEmail   string             `json:"student_email" bson:"student_email"`
	TestType       string             `json:"test_type" bson:"test_type"`
	TestTitle      string             `json:"test_title" bson:"test_title"`
	Status         string             `json:"status" bson:"status"`
	AllocatedBy    string             `json:"allocated_by" bson:"allocated_by"`
	AllocatedByID  primitive.ObjectID `json:"allocated_by_id" bson:"allocated_by_id"`
	ScheduledAt    time.Time          `json:"scheduled_at" bson:"scheduled_at"`
	EndTime        time.Time          `json:"end_time" bson:"end_time"`
	ExpiresAt      time.Time          `json:"expires_at" bson:"expires_at"`
	ExpiredAt      *time.Time         `json:"expired_at,omitempty" bson:"expired_at,omitempty"`
	QuestionIDs    []string           `json:"question_ids" bson:"question_ids"`
	Sections       []TestSection      `json:"sections" bson:"sections"`
	ViolationCount int                `json:"violation_count,omitempty" bson:"violation_count,omitempty"`
	MalpracticeAt  *time.Time         `json:"malpractice_at,omitempty" bson:"malpractice_at,omitempty"`
	CreatedAt      time.Time          `json:"created_at" bson:"created_at"`
	UpdatedAt      time.Time          `json:"updated_at" bson:"updated_at"`
}

type TestSection struct {
	Name               string     `json:"name" bson:"name"`
	Subject            string     `json:"subject" bson:"subject"`
	Difficulty         string     `json:"difficulty" bson:"difficulty"`
	QuestionIDs        []string   `json:"question_ids" bson:"question_ids"`
	DurationMins       int        `json:"duration_mins" bson:"duration_mins"`
	RemainingTimeSecs  int        `json:"remaining_time_secs,omitempty" bson:"remaining_time_secs,omitempty"`
	Locked             bool       `json:"locked" bson:"locked"`
	Score              int        `json:"score,omitempty" bson:"score,omitempty"`
	TotalQuestions     int        `json:"total_questions,omitempty" bson:"total_questions,omitempty"`
	IsSelected         bool       `json:"is_selected,omitempty" bson:"is_selected,omitempty"`
	SelectedModule     string     `json:"selected_module,omitempty" bson:"selected_module,omitempty"`
	SelectedDifficulty string     `json:"selected_difficulty,omitempty" bson:"selected_difficulty,omitempty"`
	SubmittedAt        *time.Time `json:"submitted_at,omitempty" bson:"submitted_at,omitempty"`
	StartedAt          *time.Time `json:"started_at,omitempty" bson:"started_at,omitempty"`
}

type TestViolation struct {
	ID            primitive.ObjectID `json:"_id" bson:"_id,omitempty"`
	AllocationID  primitive.ObjectID `json:"allocation_id" bson:"allocation_id"`
	StudentID     primitive.ObjectID `json:"student_id" bson:"student_id"`
	ViolationType string             `json:"violation_type" bson:"violation_type"`
	Details       string             `json:"details" bson:"details"`
	Severity      string             `json:"severity" bson:"severity"`
	CreatedAt     time.Time          `json:"created_at" bson:"created_at"`
}

type AdaptiveSettings struct {
	ID                primitive.ObjectID `json:"_id" bson:"_id,omitempty"`
	AdaptiveEnabled   bool               `json:"adaptive_enabled" bson:"adaptive_enabled"`
	RoutingModel      string             `json:"routing_model" bson:"routing_model"`
	VerbalEasyMax     int                `json:"verbal_easy_max" bson:"verbal_easy_max"`
	VerbalMediumMax   int                `json:"verbal_medium_max" bson:"verbal_medium_max"`
	QuantEasyMax      int                `json:"quant_easy_max" bson:"quant_easy_max"`
	QuantMediumMax    int                `json:"quant_medium_max" bson:"quant_medium_max"`
	Section1Count     int                `json:"section1_count" bson:"section1_count"`
	Section2Count     int                `json:"section2_count" bson:"section2_count"`
	ModuleLowerLabel  string             `json:"module_lower_label" bson:"module_lower_label"`
	ModuleMediumLabel string             `json:"module_medium_label" bson:"module_medium_label"`
	ModuleHigherLabel string             `json:"module_higher_label" bson:"module_higher_label"`
	UpdatedAt         time.Time          `json:"updated_at" bson:"updated_at"`
}

type StudentResponse struct {
	ID            primitive.ObjectID `json:"_id" bson:"_id,omitempty"`
	AllocationID  primitive.ObjectID `json:"allocation_id" bson:"allocation_id"`
	StudentID     primitive.ObjectID `json:"student_id" bson:"student_id"`
	SectionIndex  int                `json:"section_index" bson:"section_index"`
	QuestionID    string             `json:"question_id" bson:"question_id"`
	StudentAnswer string             `json:"student_answer" bson:"student_answer"`
	IsCorrect     bool               `json:"is_correct" bson:"is_correct"`
	SubmittedAt   time.Time          `json:"submitted_at" bson:"submitted_at"`
}

type SubmitSectionRequest struct {
	SectionIndex int             `json:"section_index"`
	Responses    []ResponseEntry `json:"responses"`
}

type ResponseEntry struct {
	QuestionID    string `json:"question_id"`
	StudentAnswer string `json:"student_answer"`
}

type StudentQuestionHistory struct {
	ID          primitive.ObjectID `json:"_id" bson:"_id,omitempty"`
	StudentID   primitive.ObjectID `json:"student_id" bson:"student_id"`
	QuestionID  string             `json:"question_id" bson:"question_id"`
	TestID      string             `json:"test_id" bson:"test_id"`
	Subject     string             `json:"subject" bson:"subject"`
	AttemptedAt time.Time          `json:"attempted_at" bson:"attempted_at"`
}

type AllocateTestRequest struct {
	StudentIDs  []string `json:"student_ids"`
	TestType    string   `json:"test_type"`
	ScheduledAt string   `json:"scheduled_at"`
}
