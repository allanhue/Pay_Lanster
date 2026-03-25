package main

import (
	"backpay/routes"
	"flag"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load local development environment variables
	_ = godotenv.Load()
	_ = godotenv.Load("Backpay/.env")

	// Ensure colored Gin logs in terminals that don't auto-detect color support.
	gin.ForceConsoleColor()

	//  Setup Flags
	initDBOnly := flag.Bool("init-db", false, "initialize database tables and exit")
	seedDemo := flag.Bool("seed-demo", false, "seed demo data into database and exit")
	flag.Parse()

	//  Database Connection
	db, err := connectDatabase()
	if err != nil {
		log.Fatal("db setup:", err)
	}
	if db != nil {
		defer db.Close()
	}

	//  Handle DB commands
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

	//  Setup Router (Gin)
	app := routes.NewApp(db)
	r := gin.Default()
	r.Use(CORSMiddleware())
	app.Register(r)

	//  Get port
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	//  Start Server
	log.Printf("Server starting on port %s", port)
	r.Run(":" + port)
}

// -

func CORSMiddleware() gin.HandlerFunc {
	allowedOrigins := parseAllowedOrigins(os.Getenv("CORS_ALLOWED_ORIGINS"))

	return gin.HandlerFunc(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if isAllowedOrigin(origin, allowedOrigins) {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
		}

		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	})
}

// --- Helper Functions ---

func parseAllowedOrigins(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return []string{
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"https://paylanster.vercel.app",
		}
	}
	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		origin := strings.TrimSpace(part)
		if origin != "" {
			origins = append(origins, origin)
		}
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
