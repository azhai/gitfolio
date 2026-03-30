package tests

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/azhai/gitfolio/cmd"
	"github.com/azhai/gitfolio/config"
	"github.com/azhai/gitfolio/models"
	"github.com/azhai/gitfolio/routes"
	"github.com/gofiber/fiber/v3"
)

func SetupTestRouter() *fiber.App {
	config.AppConfig = &config.Config{
		Auth: config.AuthConfig{
			JWTSecret:     "test-secret-key",
			SessionSecret: "test-session-secret",
			TokenExpiry:   24,
		},
		Repository: config.RepositoryConfig{
			Root: "./test-repositories",
		},
	}

	cfg := &config.DatabaseConfig{
		Type: "sqlite",
		Name: ":memory:",
	}

	cmd.ConnectDB(cfg)
	defer models.Disconnect()
	return routes.SetupRouter()
}

func MakeRequest(app *fiber.App, method, path string, body any, headers map[string]string) (*http.Response, error) {
	var reqBody bytes.Buffer
	if body != nil {
		json.NewEncoder(&reqBody).Encode(body)
	}

	req := httptest.NewRequest(method, path, &reqBody)
	req.Header.Set("Content-Type", "application/json")

	for key, value := range headers {
		req.Header.Set(key, value)
	}

	return app.Test(req)
}

func ReadBody(resp *http.Response) string {
	body, _ := io.ReadAll(resp.Body)
	return string(body)
}

func AssertStatus(t *testing.T, expected, actual int) {
	if expected != actual {
		t.Errorf("Expected status %d, got %d", expected, actual)
	}
}

func AssertJSONHasKey(t *testing.T, jsonStr string, key string) {
	var result map[string]any
	json.Unmarshal([]byte(jsonStr), &result)

	if _, ok := result[key]; !ok {
		t.Errorf("JSON does not have key: %s", key)
	}
}
