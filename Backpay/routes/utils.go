package routes

import (
  "crypto/rand"
  "encoding/json"
  "fmt"
  "net/http"
  "regexp"
  "strings"
)


func writeJSON(w http.ResponseWriter, status int, payload any) {
  w.Header().Set("Content-Type", "application/json")
  w.WriteHeader(status)
  _ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
  writeJSON(w, status, map[string]string{"error": message})
}

func (a *App) health(w http.ResponseWriter, _ *http.Request) {
  writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

var nonAlphaNum = regexp.MustCompile(`[^a-zA-Z0-9]+`)

func prefixFromName(raw string) string {
  cleaned := strings.ToUpper(nonAlphaNum.ReplaceAllString(strings.TrimSpace(raw), ""))
  if cleaned == "" {
    return "EMP"
  }
  if len(cleaned) >= 3 {
    return cleaned[:3]
  }
  return cleaned + strings.Repeat("X", 3-len(cleaned))
}

func randomDigits(n int) (string, error) {
  if n <= 0 {
    return "", fmt.Errorf("invalid digit length")
  }
  max := make([]byte, n)
  if _, err := rand.Read(max); err != nil {
    return "", err
  }
  digits := make([]byte, n)
  for i := 0; i < n; i++ {
    digits[i] = byte('0' + (max[i] % 10))
  }
  return string(digits), nil
}
