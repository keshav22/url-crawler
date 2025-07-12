package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type crawlPayload struct {
	Url string `json:"url"`
}

type crawlData struct {
	ID   int          `json:"id"`
	Data ScrapeResult `json:"data"`
	Url  string       `json:"url"`
}

type crawlDataResponse struct {
	PageCount int         `json:"pageCount"`
	Data      []crawlData `json:"data"`
}

func startCrawling(c *gin.Context) {
	var payload crawlPayload

	if err := c.BindJSON(&payload); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	if payload.Url == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	result, err := DB.Exec(
		"INSERT INTO crawl_data (user_id, url) VALUES (?, ?)",
		1,
		payload.Url,
	)

	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	insertedId, err := result.LastInsertId()

	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	go func() {
		crawData := crawl(payload.Url)

		jsonBytes, err := json.Marshal(crawData.Data)
		if err != nil {
			log.Fatal("JSON marshal failed:", err)
		}

		_, err = DB.Exec(
			"Update crawl_data SET data = ? where id = ?",
			string(jsonBytes),
			insertedId,
		)

		if err != nil {
			log.Fatal("Database update failed")
		}
	}()
	c.Status(http.StatusOK)
}

func getCurrentCrawlData(c *gin.Context) {
	pageStr := c.Query("page")

	if pageStr == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	fmt.Println("pageStr result:", pageStr)

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	fmt.Println("page result:", page)

	var totalCount int
	DB.QueryRow("SELECT COUNT(id) FROM crawl_data").Scan(&totalCount)

	rows, err := DB.Query(
		"Select id, data, url from crawl_data Where user_id=1 LIMIt ? OFFSET ?",
		10,
		(page-1)*10,
	)

	if err != nil {
		log.Fatal("Query execution error ?", err)
		c.AbortWithStatus(http.StatusBadRequest)
	}

	defer rows.Close()

	jsonCrawlData := []crawlData{}
	for rows.Next() {
		var d crawlData
		var dataBytes []byte
		if err := rows.Scan(&d.ID, &dataBytes, &d.Url); err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		json.Unmarshal(dataBytes, &d.Data)
		jsonCrawlData = append(jsonCrawlData, d)
	}

	response := crawlDataResponse{
		PageCount: func() int {
			if totalCount%10 == 0 {
				return totalCount / 10
			}
			return totalCount/10 + 1
		}(),
		Data: jsonCrawlData,
	}

	c.JSON(http.StatusOK, response)
}

// Todo
// 1. Move DB operations to a different file
// 2. Add support for deleting a crawl, abort it
// 3. Add support for FE filter and pass those filters in BE and accordingly send data from crawl-data api only 10 as per page
// 4. Add status response in crawl-data - queued -> running -> done/error

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

	router.POST("/url/crawl", startCrawling)
	// router.POST("/url/crawl", startCrawling)
	router.GET("/url/crawl-data", getCurrentCrawlData)

	router.Run("localhost:8080")
}
