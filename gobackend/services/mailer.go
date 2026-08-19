package services

import (
	"fmt"
	"net/smtp"
	"strings"
)

type MailConfig struct {
	Host     string
	Port     string
	Username string
	Password string
	From     string
}

var MailCfg = MailConfig{
	Host:     "smtp.gmail.com",
	Port:     "587",
	Username: "ramjib2311@gmail.com",
	Password: "zlir gpui rado vtsz",
	From:     "ramjib2311@gmail.com",
}

func SendStudentCredentials(toEmail, name, password string) error {
	subject := "Welcome to GRE Prep Platform - Your Login Credentials"
	body := fmt.Sprintf(`Hi %s,

Welcome to the GRE Prep Platform!

Your account has been created successfully. Here are your login credentials:

Email: %s
Password: %s

Please log in at http://localhost:3001 and change your password after your first login.

Best regards,
GRE Prep Team`, name, toEmail, password)

	msg := strings.Join([]string{
		"From: " + MailCfg.From,
		"To: " + toEmail,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")

	addr := MailCfg.Host + ":" + MailCfg.Port
	auth := smtp.PlainAuth("", MailCfg.Username, MailCfg.Password, MailCfg.Host)
	return smtp.SendMail(addr, auth, MailCfg.From, []string{toEmail}, []byte(msg))
}
