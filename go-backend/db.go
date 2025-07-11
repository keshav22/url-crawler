package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/go-sql-driver/mysql"
)

var DB *sql.DB

func CreateDatabase() {
	serverName := "localhost:3306"
	user := "keshav"
	password := "Keshav@12"
	dbName := "crawler"

	connectionString := fmt.Sprintf("%s:%s@tcp(%s)/%s?charset=utf8mb4&collation=utf8mb4_unicode_ci&parseTime=true&multiStatements=true", user, password, serverName, dbName)
	var err error

	DB, err = sql.Open("mysql", connectionString)
	if err != nil {
		log.Fatalf("Error opening database: %s", err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatalf("Error connecting to the database: %s", err)
	}

	log.Println("Database connected successfully")
}
