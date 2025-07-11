package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"

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

func startCrawling(c *gin.Context) {
	var payload crawlPayload

	if err := c.BindJSON(&payload); err != nil {
		return
	}

	go func() {
		crawData := crawl(payload.Url)
		jsonBytes, err := json.Marshal(crawData.Data)
		if err != nil {
			log.Fatal("JSON marshal failed:", err)
		}

		_, err = DB.Exec(
			"INSERT INTO crawl_data (user_id, data, url) VALUES (?, ?, ?)",
			1,
			string(jsonBytes),
			payload.Url,
		)

		if err != nil {
			log.Fatal("Database INSERT failed")
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
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	fmt.Println("page result:", page)

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

	c.JSON(http.StatusOK, jsonCrawlData)
}

// Todo
// 1. Return error codes and add logs
// 2. Move DB operations to a different file
// 3. Add support for deleting a crawl, abort it
// 4. Add support for FE filter and pass those filters in BE and accordingly send data from crawl-data api only 10 as per page
// 5. Add CORS configuration
// 6. Add status response in crawl-data - queued -> running -> done/error

func main() {
	CreateDatabase()

	router := gin.Default()

	router.POST("/url/crawl", startCrawling)
	// router.POST("/url/crawl", startCrawling)
	router.GET("/url/crawl-data", getCurrentCrawlData)

	router.Run("localhost:8080")
}
