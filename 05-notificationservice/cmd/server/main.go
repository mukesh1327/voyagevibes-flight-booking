package main

import (
	"os"
	"time"

	"github.com/redis/go-redis/v9"
	"voyagevibes/notificationservice/internal/httpapi"
	"voyagevibes/notificationservice/internal/notification"
)

func main() {
	port := getenv("PORT", "8086")
	redisAddr := getenv("REDIS_ADDR", "localhost:6379")

	redisClient := redis.NewClient(&redis.Options{Addr: redisAddr})
	service := notification.NewService(redisClient, 24*time.Hour)
	router := httpapi.NewRouter(redisClient, service)

	if err := router.Run(":" + port); err != nil {
		panic(err)
	}
}

func getenv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
