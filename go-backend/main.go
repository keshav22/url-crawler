package main

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	CreateDatabase()

	router := gin.Default()

	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "https://mytrusteddomain.com"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	router.POST("/login", loginHandler)
	auth := router.Group("/")
	auth.Use(AuthMiddleware())
	{
		auth.POST("url/crawl", startCrawling)
		auth.POST("url/crawl/reStart", reStartCrawling)
		auth.POST("url/crawl/stop", stopCrawl)
		auth.GET("url/crawl-data", getCurrentCrawlData)
		auth.GET("url/crawl/distinct", getColDistincValues)
		auth.DELETE("url/crawl/delete", deleteCrawl)
		auth.GET("/logout", logoutHandler)
	}

	router.Run("localhost:8080")
}
