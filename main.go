package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

type App struct {
	Database *sql.DB
}

// album represents data about a record album.
type album struct {
	ID     string  `json:"id"`
	Title  string  `json:"title"`
	Artist string  `json:"artist"`
	Price  float64 `json:"price"`
}

type crawlPayload struct {
	Url string `json:"url"`
}

// albums slice to seed record album data.
var albums = []album{
	{ID: "1", Title: "Blue Train", Artist: "John Coltrane", Price: 4.99},
	{ID: "2", Title: "Jeru", Artist: "Gerry Mulligan", Price: 17.99},
	{ID: "3", Title: "Sarah Vaughan and Clifford Brown", Artist: "Sarah Vaughan", Price: 39.99},
}

// getAlbums responds with the list of all albums as JSON.
func getAlbums(c *gin.Context) {
	c.IndentedJSON(http.StatusOK, albums)
}

func startCrawling(c *gin.Context) {
	var payload crawlPayload

	// Call BindJSON to bind the received JSON to
	// newAlbum.
	if err := c.BindJSON(&payload); err != nil {
		return
	}
	// debugg
	// Add the new album to the slice.

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

	// c.IndentedJSON(http.StatusCreated, newAlbum)
	c.Status(http.StatusOK)
}

func main() {
	CreateDatabase()

	router := gin.Default()
	router.GET("/albums", getAlbums)

	router.POST("/url/crawl", startCrawling)
	router.Run("localhost:8080")
}
