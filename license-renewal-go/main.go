package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type LicenseRequest struct {
	StartPeriod          string `json:"start_period"`
	EndPeriod            string `json:"end_period"`
	WindowDays           int    `json:"window_days"`
	LoginDurationPerUser int    `json:"loginDurationPerUser"`
}

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Printf("Warning: Error loading .env file: %v", err)
	}

	startPeriodFlag := flag.String("start", "", "Start period (YYYY-MM-DDTHH:MM:SSZ format)")
	endPeriodFlag := flag.String("end", "", "End period (YYYY-MM-DDTHH:MM:SSZ format)")
	flag.Parse()

	serverURL := getEnv("SERVER_URL", "http://localhost:5000")
	tenantID := getEnv("TENANT_ID", "1")
	windowDays := getEnvAsInt("WINDOW_DAYS", 30)
	loginDurationPerUser := getEnvAsInt("LOGIN_DURATION_PER_USER", 6)

	startPeriod := *startPeriodFlag
	if startPeriod == "" {
		startPeriod = time.Now().Format("2006-01-02T15:04:05Z07:00")
	}

	endPeriod := *endPeriodFlag
	if endPeriod == "" {
		endPeriod = time.Now().AddDate(1, 0, 0).Format("2006-01-02T15:04:05Z07:00")
	}

	fmt.Printf("Configuration:\n")
	fmt.Printf("Server URL: %s\n", serverURL)
	fmt.Printf("Tenant ID: %s\n", tenantID)
	fmt.Printf("Start Period: %s\n", startPeriod)
	fmt.Printf("End Period: %s\n", endPeriod)
	fmt.Printf("Window Days: %d\n", windowDays)
	fmt.Printf("Login Duration Per User: %d\n\n", loginDurationPerUser)

	licenseReq := LicenseRequest{
		StartPeriod:          startPeriod,
		EndPeriod:            endPeriod,
		WindowDays:           windowDays,
		LoginDurationPerUser: loginDurationPerUser,
	}

	jsonData, err := json.Marshal(licenseReq)
	if err != nil {
		log.Fatalf("Error marshaling JSON: %v", err)
	}

	url := fmt.Sprintf("%s/api/v1/security/license/add?tenantId=%s", serverURL, tenantID)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Fatalf("Error creating request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("Error making request: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalf("Error reading response: %v", err)
	}

	fmt.Printf("Response Status: %s\n", resp.Status)
	fmt.Printf("Response Body: %s\n", string(body))

	if resp.StatusCode == 201 {
		fmt.Println("License renewed successfully!")
	} else {
		fmt.Println("Failed to renew license.")
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
