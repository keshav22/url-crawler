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

	userID, exists := c.Get("userID")
	if !exists {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

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
		userID,
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
	userID, exists := c.Get("userID")
	if !exists {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	pageStr := c.Query("page")
	colName := c.Query("colName")
	order := c.Query("order")
	filterVal := c.Query("filterVal")

	if pageStr == "" || (colName != "" && order == "") {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var totalCount int
	DB.QueryRow(fmt.Sprintf(`SELECT COUNT(id) FROM crawl_data WHERE user_id=%d`, userID)).Scan(&totalCount)

	var query string

	switch colName {
	case "id":
		var additonalAnd string = ""
		if filterVal != "" {
			intVal, _ := strconv.ParseInt(filterVal, 10, 64)
			log.Println(intVal)
			additonalAnd = fmt.Sprintf(` And id=%d `, intVal)
		}

		query = fmt.Sprintf(`
					SELECT id, data, url
					FROM crawl_data
					WHERE user_id=%d %s
					ORDER BY id %s
					LIMIT %d OFFSET %d
					`, userID, additonalAnd, order, 10, (page-1)*10,
		)

	case "url":
		var additonalAnd string = ""
		if filterVal != "" {
			additonalAnd = fmt.Sprintf(` And url='%s' `, filterVal)
		}

		query = fmt.Sprintf(`
					SELECT id, data, url
					FROM crawl_data
					WHERE user_id=%d %s
					ORDER BY url %s
					LIMIT %d OFFSET %d
					`, userID, additonalAnd, order, 10, (page-1)*10,
		)
		log.Println(query)
	default:
		if colName == "" {
			query = fmt.Sprintf(`
						SELECT id, data, url
						FROM crawl_data
						WHERE user_id=%d
						LIMIT %d OFFSET %d
						`, userID, 10, (page-1)*10,
			)
		} else {
			var additonalAnd string = ""
			if filterVal != "" {
				additonalAnd = fmt.Sprintf(` And JSON_UNQUOTE(JSON_EXTRACT(data, '$.%s')) = '%s' `, colName, filterVal)
			}
			query = fmt.Sprintf(`
						SELECT id, data, url
						FROM crawl_data
						WHERE user_id=%d %s
						ORDER BY JSON_UNQUOTE(JSON_EXTRACT(data, '$.%s')) %s
						LIMIT %d OFFSET %d
						`, userID, additonalAnd, colName, order, 10, (page-1)*10,
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

		if checkCrawIdRunning(int64(d.ID)) {
			d.Status = "running"
		} else if dataBytes == nil || len(dataBytes) == 0 {
			d.Status = "stopped"
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
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	cleanUpCrawlId(id)

	c.Status(http.StatusOK)
}

func reStartCrawling(c *gin.Context) {
	var id int64

	userID, exists := c.Get("userID")
	if !exists {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

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
	DB.QueryRow(fmt.Sprintf(`SELECT url FROM crawl_data Where user_id=%d id=%s"`, userID, strconv.FormatInt(id, 10))).Scan(&url)

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

func getColDistincValues(c *gin.Context) {
	column := c.Query("column")

	userID, exists := c.Get("userID")
	if !exists {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	var distinctValues []string
	var query string

	switch column {
	case "id":
		query = fmt.Sprintf(`SELECT DISTINCT(id) FROM crawl_data where user_id=%d`, userID)
	case "url":
		query = fmt.Sprintf(`SELECT DISTINCT(url) FROM crawl_data where user_id=%d`, userID)
	default:
		query = fmt.Sprintf(`SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(data, '$.%s')) AS %s FROM crawl_data WHERE user_id=%d AND JSON_EXTRACT(data, '$.%s') IS NOT NULL`, column, column, userID, column)
	}

	rows, err := DB.Query(query)

	if err != nil {
		c.AbortWithStatus((http.StatusBadRequest))
		log.Println(err)
		return
	}

	for rows.Next() {
		var val string
		if err := rows.Scan(&val); err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		if val != "" {
			distinctValues = append(distinctValues, val)
		}
	}

	c.JSON(http.StatusOK, distinctValues)
}

func deleteCrawl(c *gin.Context) {
	crawId := c.Query("crawId")

	userID, exists := c.Get("userID")
	if !exists {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	id, err := strconv.Atoi(crawId)
	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	_, err = DB.Exec(fmt.Sprintf(`Delete from crawl_data where user_id=%d id=%d`, userID, id))

	if err != nil {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	c.Status(http.StatusOK)
}
