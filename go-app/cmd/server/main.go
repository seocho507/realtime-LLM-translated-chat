package main

import (
	"log"
	"net/http"
	"os"

	"talk/go-app/internal/app"
	"talk/go-app/internal/config"
)

func main() {
	cfg := config.LoadConfig()
	handler, err := app.BuildHandler(cfg)
	if err != nil {
		log.Fatal(err)
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8001"
	}
	addr := ":" + port
	log.Printf("listening on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal(err)
	}
}
