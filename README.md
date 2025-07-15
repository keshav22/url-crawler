# URL Crawler
A simple full-stack URL crawler application built using **Go (Gin)** for the backend, **React** for the frontend, and **MySQL** as the database.

## Notes
- All config variables(DB, API_PREFIX, JWT_SECRET etc.)  are controlled via .env files so create one.
```
go-backend .env 
JWT_SECRET=[ADD_YOUR_VALUE]
FE_URL=[ADD_YOUR_VALUE]
DB_SERVER_ADDRESS=[ADD_YOUR_VALUE]
DB_USER=[ADD_YOUR_VALUE]
DB_PASSWORD=[ADD_YOUR_VALUE]
DATABASE=[ADD_YOUR_VALUE]

react-frotend .env
REACT_APP_BE_URL=[ADD_YOUR_VALUE]
```
- The app does **not** support registration; use the test accounts provided.
- Ensure MySQL is running and accessible by the backend.
- Backend and frontend must be run concurrently.

## Setup Instructions

### MySQL Setup

1. **Install MySQL server** if not already installed.

2. **Create the database and tables** by running the following SQL commands:

   ```sql 
   CREATE DATABASE crawler;
   USE crawler;

   CREATE TABLE users (
       id INT PRIMARY KEY AUTO_INCREMENT,
       email VARCHAR(255) NOT NULL UNIQUE,
       password VARCHAR(255) NOT NULL
   );

   CREATE TABLE crawl_data (
       id INT PRIMARY KEY AUTO_INCREMENT,
       url VARCHAR(100) NOT NULL,
       data JSON DEFAULT NULL,
       user_id INT NOT NULL
   );

3. **Insert sample users** (the app does not support user registration):

   ```sql
   INSERT INTO users (email, password) VALUES ('test@gmail.com', 'test@1234');
   INSERT INTO users (email, password) VALUES ('test1@gmail.com', 'test@1234');

### Backend (Go)

1. Navigate to the backend directory:

   `cd go-backend`

2. Download Go dependencies:

   `go mod tidy`

3. Run the server:

   `go run .`

> The backend will start on the default port (usually http://localhost:8080)

### Frontend (React)

1. Navigate to the frontend directory:

   `cd react-frontend`

2. Install frontend dependencies:

   `npm install`

3. Start the development server:

   `npm start`

4. To run tests:

    `npm test`

> The frontend will run on http://localhost:3000

## Project Structure

```
├── go-backend         # Go backend server (API)
├── react-frontend     # React frontend application
└── README.md
```

## To-Do / Enhancements

- [ ] Add user registration

## License

This project is open source and available under the MIT License.
