package tests

import (
	"encoding/json"
	"net/http"
	"testing"
)

func TestCompleteUserFlow(t *testing.T) {
	router := SetupTestRouter()

	t.Run("Register user", func(t *testing.T) {
		payload := map[string]string{
			"username": "flowuser",
			"email":    "flow@example.com",
			"password": "password123",
		}

		w, _ := MakeRequest(router, "POST", "/api/v1/auth/register", payload, nil)
		AssertStatus(t, http.StatusCreated, w.StatusCode)
		AssertJSONHasKey(t, ReadBody(w), "token")
	})

	var token string
	t.Run("Login", func(t *testing.T) {
		payload := map[string]string{
			"username": "flowuser",
			"password": "password123",
		}

		w, _ := MakeRequest(router, "POST", "/api/v1/auth/login", payload, nil)
		AssertStatus(t, http.StatusOK, w.StatusCode)

		var response map[string]any
		json.Unmarshal([]byte(ReadBody(w)), &response)
		token = response["token"].(string)
	})

	headers := map[string]string{
		"Authorization": "Bearer " + token,
	}

	t.Run("Create repository", func(t *testing.T) {
		payload := map[string]any{
			"name":        "flow-repo",
			"description": "Test repository for flow",
			"is_private":  false,
		}

		w, _ := MakeRequest(router, "POST", "/api/v1/repos", payload, headers)
		AssertStatus(t, http.StatusCreated, w.StatusCode)
	})

	t.Run("Get user repositories", func(t *testing.T) {
		w, _ := MakeRequest(router, "GET", "/api/v1/users/flowuser/repos", nil, nil)
		AssertStatus(t, http.StatusOK, w.StatusCode)

		var response []any
		json.Unmarshal([]byte(ReadBody(w)), &response)

		if len(response) != 1 {
			t.Errorf("Expected 1 repository, got %d", len(response))
		}
	})

	t.Run("Create issue", func(t *testing.T) {
		payload := map[string]any{
			"title": "Flow Issue",
			"body":  "This is a test issue in the flow",
		}

		w, _ := MakeRequest(router, "POST", "/api/v1/flowuser/flow-repo/issues", payload, headers)
		AssertStatus(t, http.StatusCreated, w.StatusCode)
	})

	t.Run("List issues", func(t *testing.T) {
		w, _ := MakeRequest(router, "GET", "/api/v1/flowuser/flow-repo/issues", nil, nil)
		AssertStatus(t, http.StatusOK, w.StatusCode)

		var response []any
		json.Unmarshal([]byte(ReadBody(w)), &response)

		if len(response) != 1 {
			t.Errorf("Expected 1 issue, got %d", len(response))
		}
	})

	t.Run("Add comment", func(t *testing.T) {
		payload := map[string]any{
			"body": "This is a test comment",
		}

		w, _ := MakeRequest(router, "POST", "/api/v1/flowuser/flow-repo/issues/1/comments", payload, headers)
		AssertStatus(t, http.StatusCreated, w.StatusCode)
	})

	t.Run("Close issue", func(t *testing.T) {
		payload := map[string]any{
			"is_closed": true,
		}

		w, _ := MakeRequest(router, "PUT", "/api/v1/flowuser/flow-repo/issues/1", payload, headers)
		AssertStatus(t, http.StatusOK, w.StatusCode)
	})
}

func TestCollaborationFlow(t *testing.T) {
	router := SetupTestRouter()

	ownerPayload := map[string]string{
		"username": "owner",
		"email":    "owner@example.com",
		"password": "password123",
	}
	w, _ := MakeRequest(router, "POST", "/api/v1/auth/register", ownerPayload, nil)
	AssertStatus(t, http.StatusCreated, w.StatusCode)

	var ownerResponse map[string]any
	json.Unmarshal([]byte(ReadBody(w)), &ownerResponse)
	ownerToken := ownerResponse["token"].(string)

	ownerHeaders := map[string]string{
		"Authorization": "Bearer " + ownerToken,
	}

	repoPayload := map[string]any{
		"name":        "collab-repo",
		"description": "Collaboration test repository",
		"is_private":  false,
	}
	w, _ = MakeRequest(router, "POST", "/api/v1/repos", repoPayload, ownerHeaders)
	AssertStatus(t, http.StatusCreated, w.StatusCode)

	collaboratorPayload := map[string]string{
		"username": "collaborator",
		"email":    "collaborator@example.com",
		"password": "password123",
	}
	w, _ = MakeRequest(router, "POST", "/api/v1/auth/register", collaboratorPayload, nil)
	AssertStatus(t, http.StatusCreated, w.StatusCode)

	var collabResponse map[string]any
	json.Unmarshal([]byte(ReadBody(w)), &collabResponse)
	collabToken := collabResponse["token"].(string)

	collabHeaders := map[string]string{
		"Authorization": "Bearer " + collabToken,
	}

	t.Run("Star repository", func(t *testing.T) {
		w, _ := MakeRequest(router, "POST", "/api/v1/owner/collab-repo/star", nil, collabHeaders)
		AssertStatus(t, http.StatusOK, w.StatusCode)
	})

	t.Run("Create issue on original repo", func(t *testing.T) {
		payload := map[string]any{
			"title": "Issue on original repo",
			"body":  "Issue created by collaborator",
		}

		w, _ := MakeRequest(router, "POST", "/api/v1/owner/collab-repo/issues", payload, collabHeaders)
		AssertStatus(t, http.StatusCreated, w.StatusCode)
	})
}

func TestPrivateRepositoryFlow(t *testing.T) {
	router := SetupTestRouter()

	ownerPayload := map[string]string{
		"username": "privateowner",
		"email":    "privateowner@example.com",
		"password": "password123",
	}
	w, _ := MakeRequest(router, "POST", "/api/v1/auth/register", ownerPayload, nil)
	AssertStatus(t, http.StatusCreated, w.StatusCode)

	var ownerResponse map[string]any
	json.Unmarshal([]byte(ReadBody(w)), &ownerResponse)
	ownerToken := ownerResponse["token"].(string)

	ownerHeaders := map[string]string{
		"Authorization": "Bearer " + ownerToken,
	}

	repoPayload := map[string]any{
		"name":        "private-repo",
		"description": "Private repository",
		"is_private":  true,
	}
	w, _ = MakeRequest(router, "POST", "/api/v1/repos", repoPayload, ownerHeaders)
	AssertStatus(t, http.StatusCreated, w.StatusCode)

	otherPayload := map[string]string{
		"username": "otheruser",
		"email":    "otheruser@example.com",
		"password": "password123",
	}
	w, _ = MakeRequest(router, "POST", "/api/v1/auth/register", otherPayload, nil)
	AssertStatus(t, http.StatusCreated, w.StatusCode)

	var otherResponse map[string]any
	json.Unmarshal([]byte(ReadBody(w)), &otherResponse)
	otherToken := otherResponse["token"].(string)

	otherHeaders := map[string]string{
		"Authorization": "Bearer " + otherToken,
	}

	t.Run("Cannot access private repo without auth", func(t *testing.T) {
		w, _ := MakeRequest(router, "GET", "/api/v1/privateowner/private-repo", nil, nil)
		AssertStatus(t, http.StatusForbidden, w.StatusCode)
	})

	t.Run("Cannot access private repo as other user", func(t *testing.T) {
		w, _ := MakeRequest(router, "GET", "/api/v1/privateowner/private-repo", nil, otherHeaders)
		AssertStatus(t, http.StatusForbidden, w.StatusCode)
	})

	t.Run("Owner can access private repo", func(t *testing.T) {
		w, _ := MakeRequest(router, "GET", "/api/v1/privateowner/private-repo", nil, ownerHeaders)
		AssertStatus(t, http.StatusOK, w.StatusCode)
	})
}

func TestPagination(t *testing.T) {
	router := SetupTestRouter()

	userPayload := map[string]string{
		"username": "paginationuser",
		"email":    "pagination@example.com",
		"password": "password123",
	}
	w, _ := MakeRequest(router, "POST", "/api/v1/auth/register", userPayload, nil)
	AssertStatus(t, http.StatusCreated, w.StatusCode)

	var response map[string]any
	json.Unmarshal([]byte(ReadBody(w)), &response)
	token := response["token"].(string)

	headers := map[string]string{
		"Authorization": "Bearer " + token,
	}

	for i := 1; i <= 35; i++ {
		repoPayload := map[string]any{
			"name":        "repo" + string(rune('0'+i)),
			"description": "Repository",
		}
		MakeRequest(router, "POST", "/api/v1/repos", repoPayload, headers)
	}

	t.Run("First page", func(t *testing.T) {
		w, _ := MakeRequest(router, "GET", "/api/v1/repos?page=1&per_page=10", nil, nil)
		AssertStatus(t, http.StatusOK, w.StatusCode)

		var resp map[string]any
		json.Unmarshal([]byte(ReadBody(w)), &resp)

		data := resp["data"].([]any)
		if len(data) != 10 {
			t.Errorf("Expected 10 items on first page, got %d", len(data))
		}
	})

	t.Run("Last page", func(t *testing.T) {
		w, _ := MakeRequest(router, "GET", "/api/v1/repos?page=4&per_page=10", nil, nil)
		AssertStatus(t, http.StatusOK, w.StatusCode)

		var resp map[string]any
		json.Unmarshal([]byte(ReadBody(w)), &resp)

		data := resp["data"].([]any)
		if len(data) != 5 {
			t.Errorf("Expected 5 items on last page, got %d", len(data))
		}
	})
}

func TestHealthCheck(t *testing.T) {
	router := SetupTestRouter()

	w, _ := MakeRequest(router, "GET", "/api/v1/health", nil, nil)
	AssertStatus(t, http.StatusOK, w.StatusCode)
	AssertJSONHasKey(t, ReadBody(w), "status")
}
