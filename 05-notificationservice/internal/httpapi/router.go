package httpapi

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"voyagevibes/notificationservice/internal/notification"
)

func NewRouter(redisClient *redis.Client, service *notification.Service) *gin.Engine {
	router := gin.Default()
	healthHandler := func(c *gin.Context) {
		if err := redisClient.Ping(context.Background()).Err(); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "DOWN", "service": "notification-service"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "UP", "service": "notification-service"})
	}

	router.GET("/health", healthHandler)
	router.GET("/notifications/health", healthHandler)

	router.POST("/notifications/booking-confirmed", func(c *gin.Context) {
		var request notification.BookingConfirmedRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
			return
		}

		result, err := service.SendBookingConfirmed(c.Request.Context(), request)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, result)
	})

	return router
}
