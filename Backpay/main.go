package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"backpay/routes"

	"github.com/joho/godotenv"
)

func main() {
	// Load local development environment variables from Backpay/.env when present.
	_ = godotenv.Load()

	initDBOnly := flag.Bool("init-db", false, "initialize database tables and exit")
	seedDemo := flag.Bool("seed-demo", false, "seed demo data into database and exit")
	flag.Parse()

	db, err := connectDatabase()
	if err != nil {
		log.Fatal("db setup:", err)
	}
	if db != nil {
		defer db.Close()
	}

	if *initDBOnly {
		if db == nil {
			log.Println("database not configured. Set NEON_DATABASE_URL then run: go run . -init-db")
			return
		}
		log.Println("database schema initialized successfully")
		return
	}

	if *seedDemo {
		if db == nil {
			log.Println("database not configured. Set NEON_DATABASE_URL then run: go run . -seed-demo")
			return
		}
		if err := SeedDemoData(db); err != nil {
			log.Fatal("seed demo:", err)
		}
		log.Println("demo data seeded successfully")
		return
	}

	app := routes.NewApp(db)
	mux := http.NewServeMux()
	app.Register(mux)

	if err := http.ListenAndServe(":8080", WithLogging(WithCORS(mux))); err != nil {
		log.Fatal(err)
	}
}

func WithCORS(next http.Handler) http.Handler {
	allowedOrigins := parseAllowedOrigins(os.Getenv("CORS_ALLOWED_ORIGINS"))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if isAllowedOrigin(origin, allowedOrigins) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}

		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func parseAllowedOrigins(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return []string{"http://localhost:3000"}
	}

	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		origin := strings.TrimSpace(part)
		if origin != "" {
			origins = append(origins, origin)
		}
	}

	if len(origins) == 0 {
		return []string{"http://localhost:3000"}
	}

	return origins
}

func isAllowedOrigin(origin string, allowed []string) bool {
	if origin == "" {
		return false
	}
	for _, allow := range allowed {
		if allow == "*" || allow == origin {
			return true
		}
	}
	return false
}

type responseRecorder struct {
	http.ResponseWriter
	status int
}

func (r *responseRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func WithLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := &responseRecorder{ResponseWriter: w, status: http.StatusOK}
		start := time.Now()
		next.ServeHTTP(rec, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.RequestURI(), rec.status, fmt.Sprintf("%dms", time.Since(start).Milliseconds()))
	})
}
