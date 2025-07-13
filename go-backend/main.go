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
	ID     int          `json:"id"`
	Data   ScrapeResult `json:"data"`
	Url    string       `json:"url"`
	Status string       `json:"status"`
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
		crawData := crawl(payload.Url, insertedId)

		jsonBytes, err := json.Marshal(crawData.Data)
		if err != nil {
			log.Println("JSON marshal failed:", err)
		}

		_, err = DB.Exec(
			"Update crawl_data SET data = ? where id = ?",
			string(jsonBytes),
			insertedId,
		)

		if err != nil {
			log.Println("Database update failed")
		}
	}()
	c.Status(http.StatusOK)
}

func getCurrentCrawlData(c *gin.Context) {
	pageStr := c.Query("page")
	srtColName := c.Query("srtColName")
	order := c.Query("order")
	// filColName := c.Query("filColName")
	// filColValue := c.Query("filColName")

	if pageStr == "" || (srtColName != "" && order == "") {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var totalCount int
	DB.QueryRow("SELECT COUNT(id) FROM crawl_data").Scan(&totalCount)

	var query string

	switch srtColName {
	case "id":
		query = fmt.Sprintf(`
					SELECT id, data, url
					FROM crawl_data
					WHERE user_id = 1
					ORDER BY id %s
					LIMIT %d OFFSET %d
					`, order, 10, (page-1)*10,
		)
	case "url":
		query = fmt.Sprintf(`
					SELECT id, data, url
					FROM crawl_data
					WHERE user_id = 1
					ORDER BY url %s
					LIMIT %d OFFSET %d
					`, order, 10, (page-1)*10,
		)
	default:
		if srtColName == "" {
			query = fmt.Sprintf(`
						SELECT id, data, url
						FROM crawl_data
						WHERE user_id = 1
						LIMIT %d OFFSET %d
						`, 10, (page-1)*10,
			)
		} else {
			query = fmt.Sprintf(`
						SELECT id, data, url
						FROM crawl_data
						WHERE user_id = 1
						ORDER BY JSON_UNQUOTE(JSON_EXTRACT(data, '$.%s')) %s
						LIMIT %d OFFSET %d
						`, srtColName, order, 10, (page-1)*10,
			)
		}
	}

	rows, err := DB.Query(query)

	if err != nil {
		log.Println("Query execution error ?", err)
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

		if dataBytes == nil || len(dataBytes) == 0 {
			if checkCrawIdRunning(int64(d.ID)) {
				d.Status = "running"
			} else {
				d.Status = "stopped"
			}
		} else {
			d.Status = "done"
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

func stopCrawl(c *gin.Context) {
	var id int64

	if err := c.ShouldBind(&id); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	if !checkCrawIdRunning(id) {
		c.JSON(http.StatusConflict, gin.H{
			"message": "Job is already stopped/finished",
		})
		return
	}

	cleanUpCrawlId(id)

	c.Status(http.StatusOK)
}

func reStartCrawling(c *gin.Context) {
	var id int64

	if err := c.ShouldBind(&id); err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	if checkCrawIdRunning(id) {
		c.JSON(http.StatusConflict, gin.H{
			"message": "Job is already running",
		})
		return
	}

	var url string
	DB.QueryRow("SELECT url FROM crawl_data Where id=" + strconv.FormatInt(id, 10)).Scan(&url)

	go func() {
		crawData := crawl(url, id)

		jsonBytes, err := json.Marshal(crawData.Data)
		if err != nil {
			log.Println("JSON marshal failed:", err)
		}

		_, err = DB.Exec(
			"Update crawl_data SET data = ? where id = ?",
			string(jsonBytes),
			id,
		)

		if err != nil {
			log.Println("Database update failed")
		}
	}()

	c.Status(http.StatusOK)
}

// Todo
// 1. Move DB operations to a different file
// 2. Add support for FE filter and pass those filters in BE and accordingly send data from crawl-data api only 10 as per page

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
	router.POST("/url/crawl/reStart", reStartCrawling)
	router.POST("/url/crawl/stop", stopCrawl)
	router.GET("/url/crawl-data", getCurrentCrawlData)

	router.Run("localhost:8080")
}
