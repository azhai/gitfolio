package tests

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
)

func TestCreateRepository(t *testing.T) {
	router := SetupTestRouter()

	user := models.User{
		Username: "repouser",
		Email:    "repo@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&user)

	token, _ := middleware.GenerateToken(&user)

	tests := []struct {
		name       string
		payload    map[string]any
		wantStatus int
	}{
		{
			name: "Valid public repository",
			payload: map[string]any{
				"name":        "test-repo",
				"description": "Test repository",
				"is_private":  false,
			},
			wantStatus: http.StatusCreated,
		},
		{
			name: "Valid private repository",
			payload: map[string]any{
				"name":        "private-repo",
				"description": "Private repository",
				"is_private":  true,
			},
			wantStatus: http.StatusCreated,
		},
		{
			name: "Missing name",
			payload: map[string]any{
				"description": "No name repository",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "Empty name",
			payload: map[string]any{
				"name":        "",
				"description": "Empty name repository",
			},
			wantStatus: http.StatusBadRequest,
		},
	}

	headers := map[string]string{
		"Authorization": "Bearer " + token,
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w, _ := MakeRequest(router, "POST", "/api/v1/repos", tt.payload, headers)
			AssertStatus(t, tt.wantStatus, w.StatusCode)

			if tt.wantStatus == http.StatusCreated {
				AssertJSONHasKey(t, ReadBody(w), "name")
				AssertJSONHasKey(t, ReadBody(w), "owner")
			}
		})
	}
}

func TestDuplicateRepositoryName(t *testing.T) {
	router := SetupTestRouter()

	user := models.User{
		Username: "repouser2",
		Email:    "repo2@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&user)

	token, _ := middleware.GenerateToken(&user)

	headers := map[string]string{
		"Authorization": "Bearer " + token,
	}

	payload := map[string]any{
		"name":        "duplicate-repo",
		"description": "First repository",
	}

	w1, _ := MakeRequest(router, "POST", "/api/v1/repos", payload, headers)
	AssertStatus(t, http.StatusCreated, w1.StatusCode)

	w2, _ := MakeRequest(router, "POST", "/api/v1/repos", payload, headers)
	AssertStatus(t, http.StatusConflict, w2.StatusCode)
}

func TestListRepositories(t *testing.T) {
	router := SetupTestRouter()

	user := models.User{
		Username: "listuser",
		Email:    "list@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&user)

	repos := []models.Repository{
		{Name: "repo1", OwnerID: user.ID, IsPrivate: false},
		{Name: "repo2", OwnerID: user.ID, IsPrivate: false},
		{Name: "repo3", OwnerID: user.ID, IsPrivate: true},
	}
	for _, repo := range repos {
		db.Repository.Insert().One(&repo)
	}

	w, _ := MakeRequest(router, "GET", "/api/v1/repos", nil, nil)
	AssertStatus(t, http.StatusOK, w.StatusCode)

	var response map[string]any
	json.Unmarshal([]byte(ReadBody(w)), &response)

	data := response["data"].([]any)
	if len(data) != 2 {
		t.Errorf("Expected 2 public repositories, got %d", len(data))
	}
}

func TestGetRepository(t *testing.T) {
	router := SetupTestRouter()

	user := models.User{
		Username: "getuser",
		Email:    "get@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&user)

	repo := models.Repository{
		Name:      "get-repo",
		OwnerID:   user.ID,
		IsPrivate: false,
	}
	db.Repository.Insert().One(&repo)

	w, _ := MakeRequest(router, "GET", "/api/v1/getuser/get-repo", nil, nil)
	AssertStatus(t, http.StatusOK, w.StatusCode)
	AssertJSONHasKey(t, ReadBody(w), "name")
	AssertJSONHasKey(t, ReadBody(w), "owner")
}

func TestGetPrivateRepository(t *testing.T) {
	router := SetupTestRouter()

	owner := models.User{
		Username: "privateowner",
		Email:    "private@example.com",
		IsActive: true,
	}
	owner.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&owner)

	otherUser := models.User{
		Username: "otheruser",
		Email:    "other@example.com",
		IsActive: true,
	}
	otherUser.SetPassword("password123")
	db.User.Insert().One(&otherUser)

	repo := models.Repository{
		Name:      "private-repo",
		OwnerID:   owner.ID,
		IsPrivate: true,
	}
	db.Repository.Insert().One(&repo)

	w, _ := MakeRequest(router, "GET", "/api/v1/privateowner/private-repo", nil, nil)
	AssertStatus(t, http.StatusForbidden, w.StatusCode)

	token, _ := middleware.GenerateToken(&owner)
	headers := map[string]string{
		"Authorization": "Bearer " + token,
	}

	w, _ = MakeRequest(router, "GET", "/api/v1/privateowner/private-repo", nil, headers)
	AssertStatus(t, http.StatusOK, w.StatusCode)
}

func TestUpdateRepository(t *testing.T) {
	router := SetupTestRouter()

	user := models.User{
		Username: "updateuser",
		Email:    "update@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&user)

	repo := models.Repository{
		Name:      "update-repo",
		OwnerID:   user.ID,
		IsPrivate: false,
	}
	db.Repository.Insert().One(&repo)

	token, _ := middleware.GenerateToken(&user)
	headers := map[string]string{
		"Authorization": "Bearer " + token,
	}

	payload := map[string]any{
		"description": "Updated description",
	}

	w, _ := MakeRequest(router, "PUT", "/api/v1/updateuser/update-repo", payload, headers)
	AssertStatus(t, http.StatusOK, w.StatusCode)
}

func TestDeleteRepository(t *testing.T) {
	router := SetupTestRouter()

	user := models.User{
		Username: "deleteuser",
		Email:    "delete@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&user)

	repo := models.Repository{
		Name:      "delete-repo",
		OwnerID:   user.ID,
		IsPrivate: false,
	}
	db.Repository.Insert().One(&repo)

	token, _ := middleware.GenerateToken(&user)
	headers := map[string]string{
		"Authorization": "Bearer " + token,
	}

	w, _ := MakeRequest(router, "DELETE", "/api/v1/deleteuser/delete-repo", nil, headers)
	AssertStatus(t, http.StatusOK, w.StatusCode)
}

func TestStarRepository(t *testing.T) {
	router := SetupTestRouter()

	owner := models.User{
		Username: "starowner",
		Email:    "star@example.com",
		IsActive: true,
	}
	owner.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&owner)

	repo := models.Repository{
		Name:      "star-repo",
		OwnerID:   owner.ID,
		IsPrivate: false,
	}
	db.Repository.Insert().One(&repo)

	user := models.User{
		Username: "staruser",
		Email:    "staruser@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db.User.Insert().One(&user)

	token, _ := middleware.GenerateToken(&user)
	headers := map[string]string{
		"Authorization": "Bearer " + token,
	}

	w, _ := MakeRequest(router, "POST", "/api/v1/starowner/star-repo/star", nil, headers)
	AssertStatus(t, http.StatusOK, w.StatusCode)

	w, _ = MakeRequest(router, "POST", "/api/v1/starowner/star-repo/star", nil, headers)
	AssertStatus(t, http.StatusConflict, w.StatusCode)
}
