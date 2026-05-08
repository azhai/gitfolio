package tests

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
)

func TestCreateIssue(t *testing.T) {
	router := SetupTestRouter()

	user := models.User{
		Username: "issueuser",
		Email:    "issue@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&user)

	repo := models.Repository{
		Name:      "issue-repo",
		OwnerID:   user.ID,
		ProjectType: "mirror",
	}
	db.Repository.Insert().One(&repo)

	token, _ := middleware.GenerateToken(&user)
	headers := map[string]string{
		"Authorization": "Bearer " + token,
	}

	tests := []struct {
		name       string
		payload    map[string]any
		wantStatus int
	}{
		{
			name: "Valid issue",
			payload: map[string]any{
				"title": "Test Issue",
				"body":  "This is a test issue",
			},
			wantStatus: http.StatusCreated,
		},
		{
			name: "Issue with labels",
			payload: map[string]any{
				"title":  "Issue with labels",
				"body":   "Issue body",
				"labels": []string{"bug", "help-wanted"},
			},
			wantStatus: http.StatusCreated,
		},
		{
			name: "Missing title",
			payload: map[string]any{
				"body": "No title issue",
			},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w, _ := MakeRequest(router, "POST", "/api/v1/issueuser/issue-repo/issues", tt.payload, headers)
			AssertStatus(t, tt.wantStatus, w.StatusCode)

			if tt.wantStatus == http.StatusCreated {
				AssertJSONHasKey(t, ReadBody(w), "title")
				AssertJSONHasKey(t, ReadBody(w), "author")
			}
		})
	}
}

func TestListIssues(t *testing.T) {
	router := SetupTestRouter()

	user := models.User{
		Username: "listissueuser",
		Email:    "listissue@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&user)

	repo := models.Repository{
		Name:      "list-issue-repo",
		OwnerID:   user.ID,
		ProjectType: "mirror",
	}
	db.Repository.Insert().One(&repo)

	issues := []models.Issue{
		{Title: "Issue 1", Body: "Body 1", RepositoryID: repo.ID, AuthorID: user.ID, IsClosed: false},
		{Title: "Issue 2", Body: "Body 2", RepositoryID: repo.ID, AuthorID: user.ID, IsClosed: false},
		{Title: "Issue 3", Body: "Body 3", RepositoryID: repo.ID, AuthorID: user.ID, IsClosed: true},
	}
	for _, issue := range issues {
		db.Issue.Insert().One(&issue)
	}

	w, _ := MakeRequest(router, "GET", "/api/v1/listissueuser/list-issue-repo/issues?state=open", nil, nil)
	AssertStatus(t, http.StatusOK, w.StatusCode)

	var response []any
	json.Unmarshal([]byte(ReadBody(w)), &response)

	if len(response) != 2 {
		t.Errorf("Expected 2 open issues, got %d", len(response))
	}

	w, _ = MakeRequest(router, "GET", "/api/v1/listissueuser/list-issue-repo/issues?state=closed", nil, nil)
	AssertStatus(t, http.StatusOK, w.StatusCode)

	json.Unmarshal([]byte(ReadBody(w)), &response)
	if len(response) != 1 {
		t.Errorf("Expected 1 closed issue, got %d", len(response))
	}
}

func TestGetIssue(t *testing.T) {
	router := SetupTestRouter()

	user := models.User{
		Username: "getissueuser",
		Email:    "getissue@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&user)

	repo := models.Repository{
		Name:      "get-issue-repo",
		OwnerID:   user.ID,
		ProjectType: "mirror",
	}
	db.Repository.Insert().One(&repo)

	issue := models.Issue{
		Title:        "Get Issue Test",
		Body:         "Test body",
		RepositoryID: repo.ID,
		AuthorID:     user.ID,
	}
	db.Issue.Insert().One(&issue)

	w, _ := MakeRequest(router, "GET", "/api/v1/getissueuser/get-issue-repo/issues/1", nil, nil)
	AssertStatus(t, http.StatusOK, w.StatusCode)
	AssertJSONHasKey(t, ReadBody(w), "title")
	AssertJSONHasKey(t, ReadBody(w), "body")
}

func TestUpdateIssue(t *testing.T) {
	router := SetupTestRouter()

	user := models.User{
		Username: "updateissueuser",
		Email:    "updateissue@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&user)

	repo := models.Repository{
		Name:      "update-issue-repo",
		OwnerID:   user.ID,
		ProjectType: "mirror",
	}
	db.Repository.Insert().One(&repo)

	issue := models.Issue{
		Title:        "Original Title",
		Body:         "Original body",
		RepositoryID: repo.ID,
		AuthorID:     user.ID,
	}
	db.Issue.Insert().One(&issue)

	token, _ := middleware.GenerateToken(&user)
	headers := map[string]string{
		"Authorization": "Bearer " + token,
	}

	payload := map[string]any{
		"title": "Updated Title",
		"body":  "Updated body",
	}

	w, _ := MakeRequest(router, "PUT", "/api/v1/updateissueuser/update-issue-repo/issues/1", payload, headers)
	AssertStatus(t, http.StatusOK, w.StatusCode)
}

func TestCloseIssue(t *testing.T) {
	router := SetupTestRouter()

	user := models.User{
		Username: "closeissueuser",
		Email:    "closeissue@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&user)

	repo := models.Repository{
		Name:      "close-issue-repo",
		OwnerID:   user.ID,
		ProjectType: "mirror",
	}
	db.Repository.Insert().One(&repo)

	issue := models.Issue{
		Title:        "Issue to Close",
		Body:         "Body",
		RepositoryID: repo.ID,
		AuthorID:     user.ID,
		IsClosed:     false,
	}
	db.Issue.Insert().One(&issue)

	token, _ := middleware.GenerateToken(&user)
	headers := map[string]string{
		"Authorization": "Bearer " + token,
	}

	payload := map[string]any{
		"is_closed": true,
	}

	w, _ := MakeRequest(router, "PUT", "/api/v1/closeissueuser/close-issue-repo/issues/1", payload, headers)
	AssertStatus(t, http.StatusOK, w.StatusCode)
}

func TestCreateComment(t *testing.T) {
	router := SetupTestRouter()

	user := models.User{
		Username: "commentuser",
		Email:    "comment@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&user)

	repo := models.Repository{
		Name:      "comment-repo",
		OwnerID:   user.ID,
		ProjectType: "mirror",
	}
	db.Repository.Insert().One(&repo)

	issue := models.Issue{
		Title:        "Issue for Comment",
		Body:         "Body",
		RepositoryID: repo.ID,
		AuthorID:     user.ID,
	}
	db.Issue.Insert().One(&issue)

	token, _ := middleware.GenerateToken(&user)
	headers := map[string]string{
		"Authorization": "Bearer " + token,
	}

	payload := map[string]any{
		"body": "This is a test comment",
	}

	w, _ := MakeRequest(router, "POST", "/api/v1/commentuser/comment-repo/issues/1/comments", payload, headers)
	AssertStatus(t, http.StatusCreated, w.StatusCode)
	AssertJSONHasKey(t, ReadBody(w), "body")
	AssertJSONHasKey(t, ReadBody(w), "author")
}
