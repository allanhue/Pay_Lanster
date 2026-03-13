package routes

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/smtp"
	"os"
	"strconv"
	"strings"
	"time"
)

type sendMailRequest struct {
	OrgID   string `json:"orgId"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

type genericMailRequest struct {
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

type supportRequest struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Subject string `json:"subject"`
	Message string `json:"message"`
}

type mailConfig struct {
	Host           string
	Port           string
	From           string
	FromName       string
	Username       string
	Password       string
	SupportTo      string
	UseSSL         bool // SMTPS (implicit TLS), typically port 465
	UseCredentials bool
	UseBrevoAPI    bool
}

func envTrim(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}

func parseEnvBool(raw string, def bool) bool {
	raw = strings.TrimSpace(strings.ToLower(raw))
	if raw == "" {
		return def
	}
	switch raw {
	case "1", "true", "yes", "y", "on":
		return true
	case "0", "false", "no", "n", "off":
		return false
	default:
		return def
	}
}

// getMailConfig returns SMTP configuration from environment.
// Defaults match Brevo SMTP (username "apikey", password is your Brevo API key).
func getMailConfig() mailConfig {
	cfg := mailConfig{
		Host:           envTrim("MAIL_SERVER"),
		Port:           envTrim("MAIL_PORT"),
		From:           envTrim("MAIL_FROM"),
		FromName:       envTrim("MAIL_FROM_NAME"),
		Username:       envTrim("MAIL_USERNAME"),
		Password:       envTrim("MAIL_PASSWORD"),
		SupportTo:      envTrim("SUPPORT_MAIL_TO"),
		UseSSL:         parseEnvBool(envTrim("MAIL_SSL_TLS"), false),
		UseCredentials: parseEnvBool(envTrim("USE_CREDENTIALS"), true),
		UseBrevoAPI:    parseEnvBool(envTrim("BREVO_USE_API"), false),
	}

	if cfg.Host == "" {
		cfg.Host = "smtp-relay.brevo.com"
	}
	if cfg.Port == "" {
		cfg.Port = "587"
	}
	if cfg.From == "" {
		cfg.From = "centralhype9@gmail.com"
	}
	if cfg.FromName == "" {
		cfg.FromName = "PulseForge"
	}
	if cfg.SupportTo == "" {
		cfg.SupportTo = "centralhype9@gmail.com"
	}

	// Backwards compatibility: many setups store Brevo SMTP password in BREVO_API_KEY.
	if cfg.Password == "" {
		cfg.Password = envTrim("BREVO_API_KEY")
	}

	// Brevo SMTP requires username "apikey".
	if cfg.Username == "" && cfg.Password != "" {
		cfg.Username = "apikey"
	}

	// If port is 465, prefer implicit TLS unless explicitly disabled.
	if portNum, err := strconv.Atoi(cfg.Port); err == nil && portNum == 465 {
		cfg.UseSSL = true
	}

	return cfg
}

func buildMessage(cfg mailConfig, to []string, subject, bodyHTML string) []byte {
	headers := []struct {
		k string
		v string
	}{
		{"From", fmt.Sprintf("%s <%s>", cfg.FromName, cfg.From)},
		{"To", strings.Join(to, ", ")},
		{"Subject", subject},
		{"MIME-Version", "1.0"},
		{"Content-Type", "text/html; charset=UTF-8"},
		{"Date", time.Now().Format(time.RFC1123Z)},
	}

	var msg bytes.Buffer
	for _, h := range headers {
		msg.WriteString(fmt.Sprintf("%s: %s\r\n", h.k, h.v))
	}
	msg.WriteString("\r\n")
	msg.WriteString(bodyHTML)
	return msg.Bytes()
}

func sendMailSMTPS(cfg mailConfig, to []string, msg []byte, auth smtp.Auth) error {
	addr := net.JoinHostPort(cfg.Host, cfg.Port)
	conn, err := tls.DialWithDialer(&net.Dialer{Timeout: 12 * time.Second}, "tcp", addr, &tls.Config{
		ServerName: cfg.Host,
		MinVersion: tls.VersionTLS12,
	})
	if err != nil {
		return err
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, cfg.Host)
	if err != nil {
		return err
	}
	defer client.Close()

	if auth != nil {
		if ok, _ := client.Extension("AUTH"); ok {
			if err := client.Auth(auth); err != nil {
				return err
			}
		}
	}

	if err := client.Mail(cfg.From); err != nil {
		return err
	}
	for _, rcpt := range to {
		if err := client.Rcpt(rcpt); err != nil {
			return err
		}
	}

	w, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(msg); err != nil {
		_ = w.Close()
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return client.Quit()
}

// sendEmail sends email via SMTP (Brevo-compatible).
func sendEmail(to []string, subject, bodyHTML string) error {
	cfg := getMailConfig()

	if len(to) == 0 {
		return fmt.Errorf("missing recipients")
	}
	if cfg.From == "" {
		return fmt.Errorf("MAIL_FROM not configured")
	}

	if cfg.UseBrevoAPI {
		return sendEmailViaBrevoAPI(cfg, to, subject, bodyHTML)
	}

	var auth smtp.Auth
	if cfg.UseCredentials {
		if cfg.Password == "" {
			return fmt.Errorf("MAIL_PASSWORD/BREVO_API_KEY not configured")
		}
		auth = smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
	}

	msg := buildMessage(cfg, to, subject, bodyHTML)
	if cfg.UseSSL {
		return sendMailSMTPS(cfg, to, msg, auth)
	}

	addr := net.JoinHostPort(cfg.Host, cfg.Port)
	return smtp.SendMail(addr, auth, cfg.From, to, msg)
}

type brevoEmailRequest struct {
	Sender      brevoSender      `json:"sender"`
	To          []brevoRecipient `json:"to"`
	Subject     string           `json:"subject"`
	HTMLContent string           `json:"htmlContent"`
}

type brevoSender struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

type brevoRecipient struct {
	Email string `json:"email"`
}

func sendEmailViaBrevoAPI(cfg mailConfig, to []string, subject, bodyHTML string) error {
	apiKey := envTrim("BREVO_API_KEY")
	if apiKey == "" {
		return fmt.Errorf("BREVO_API_KEY not configured")
	}

	recipients := make([]brevoRecipient, 0, len(to))
	for _, addr := range to {
		addr = strings.TrimSpace(addr)
		if addr != "" {
			recipients = append(recipients, brevoRecipient{Email: addr})
		}
	}
	if len(recipients) == 0 {
		return fmt.Errorf("missing recipients")
	}

	payload := brevoEmailRequest{
		Sender:      brevoSender{Name: cfg.FromName, Email: cfg.From},
		To:          recipients,
		Subject:     subject,
		HTMLContent: bodyHTML,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.brevo.com/v3/smtp/email", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("api-key", apiKey)

	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("brevo api error: %s", strings.TrimSpace(string(raw)))
	}

	return nil
}

func (a *App) sendMail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req genericMailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Subject = strings.TrimSpace(req.Subject)
	req.HTML = strings.TrimSpace(req.HTML)
	if len(req.To) == 0 || req.Subject == "" || req.HTML == "" {
		writeError(w, http.StatusBadRequest, "to, subject and html are required")
		return
	}
	for i := range req.To {
		req.To[i] = strings.TrimSpace(req.To[i])
	}

	if err := sendEmail(req.To, req.Subject, req.HTML); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to send email: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"sent":    true,
		"message": "email sent successfully",
	})
}

func (a *App) sendMailTest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req sendMailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.OrgID == "" || req.Subject == "" || req.Body == "" {
		writeError(w, http.StatusBadRequest, "orgId, subject and body are required")
		return
	}

	supportTo := getMailConfig().SupportTo

	htmlBody := fmt.Sprintf(`
    <h2>Test Email from Payroll System</h2>
    <p><strong>Organization:</strong> %s</p>
    <p><strong>Subject:</strong> %s</p>
    <hr>
    <p>%s</p>
  `, req.OrgID, req.Subject, req.Body)

	if err := sendEmail([]string{supportTo}, req.Subject, htmlBody); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to send email: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"sent":    true,
		"message": "email sent successfully",
	})
}

// supportForm handles support/contact form submissions
func (a *App) supportForm(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req supportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.Email == "" || req.Subject == "" || req.Message == "" {
		writeError(w, http.StatusBadRequest, "name, email, subject and message are required")
		return
	}

	supportTo := getMailConfig().SupportTo

	emailSubject := fmt.Sprintf("[Support] %s from %s", req.Subject, req.Name)
	htmlBody := fmt.Sprintf(`
    <h2>New Support Request</h2>
    <table style="border-collapse: collapse; width: 100%%;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Name</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">%s</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Email</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">%s</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Subject</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">%s</td>
      </tr>
    </table>
    <h3>Message</h3>
    <p style="background: #f5f5f5; padding: 16px; border-radius: 4px;">%s</p>
    <hr>
    <p style="font-size: 12px; color: #666;">Sent from PulseForge Payroll Support Form</p>
  `, req.Name, req.Email, req.Subject, strings.ReplaceAll(req.Message, "\n", "<br>"))

	if err := sendEmail([]string{supportTo}, emailSubject, htmlBody); err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("failed to send support email: %v", err))
		return
	}

	// Send confirmation to user
	confirmSubject := "Your support request has been received - PulseForge"
	confirmBody := fmt.Sprintf(`
    <h2>Hi %s,</h2>
    <p>Thank you for contacting PulseForge Support. We have received your message regarding:</p>
    <p><strong>%s</strong></p>
    <p>Our team will review your request and get back to you within 24-48 hours.</p>
    <hr>
    <p style="font-size: 12px; color: #666;">This is an automated confirmation. Please do not reply to this email.</p>
  `, req.Name, req.Subject)

	// Best effort confirmation email
	_ = sendEmail([]string{req.Email}, confirmSubject, confirmBody)

	writeJSON(w, http.StatusOK, map[string]any{
		"sent":    true,
		"message": "Support request submitted successfully",
	})
}
