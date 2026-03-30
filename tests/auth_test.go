package tests

import (
	"net/http"
	"testing"

	"github.com/azhai/gitfolio/middleware"
	"github.com/azhai/gitfolio/models"
)

func TestUserRegistration(t *testing.T) {
	router := SetupTestRouter()

	tests := []struct {
		name       string
		payload    map[string]string
		wantStatus int
	}{
		{
			name: "Valid registration",
			payload: map[string]string{
				"username": "testuser",
				"email":    "test@example.com",
				"password": "password123",
			},
			wantStatus: http.StatusCreated,
		},
		{
			name: "Missing username",
			payload: map[string]string{
				"email":    "test2@example.com",
				"password": "password123",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "Missing email",
			payload: map[string]string{
				"username": "testuser2",
				"password": "password123",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "Short password",
			payload: map[string]string{
				"username": "testuser3",
				"email":    "test3@example.com",
				"password": "123",
			},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w, _ := MakeRequest(router, "POST", "/api/v1/auth/register", tt.payload, nil)
			AssertStatus(t, tt.wantStatus, w.StatusCode)

			if tt.wantStatus == http.StatusCreated {
				AssertJSONHasKey(t, ReadBody(w), "token")
				AssertJSONHasKey(t, ReadBody(w), "user")
			}
		})
	}
}

func TestDuplicateUserRegistration(t *testing.T) {
	router := SetupTestRouter()

	user := models.User{
		Username: "existinguser",
		Email:    "existing@example.com",
	}
	user.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&user)

	payload := map[string]string{
		"username": "existinguser",
		"email":    "new@example.com",
		"password": "password123",
	}

	w, _ := MakeRequest(router, "POST", "/api/v1/auth/register", payload, nil)
	AssertStatus(t, http.StatusConflict, w.StatusCode)
}

func TestUserLogin(t *testing.T) {
	router := SetupTestRouter()

	user := models.User{
		Username: "loginuser",
		Email:    "login@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&user)

	tests := []struct {
		name       string
		payload    map[string]string
		wantStatus int
	}{
		{
			name: "Valid login with username",
			payload: map[string]string{
				"username": "loginuser",
				"password": "password123",
			},
			wantStatus: http.StatusOK,
		},
		{
			name: "Valid login with email",
			payload: map[string]string{
				"username": "login@example.com",
				"password": "password123",
			},
			wantStatus: http.StatusOK,
		},
		{
			name: "Invalid password",
			payload: map[string]string{
				"username": "loginuser",
				"password": "wrongpassword",
			},
			wantStatus: http.StatusUnauthorized,
		},
		{
			name: "Non-existent user",
			payload: map[string]string{
				"username": "nonexistent",
				"password": "password123",
			},
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w, _ := MakeRequest(router, "POST", "/api/v1/auth/login", tt.payload, nil)
			AssertStatus(t, tt.wantStatus, w.StatusCode)

			if tt.wantStatus == http.StatusOK {
				AssertJSONHasKey(t, ReadBody(w), "token")
				AssertJSONHasKey(t, ReadBody(w), "user")
			}
		})
	}
}

func TestInactiveUserLogin(t *testing.T) {
	router := SetupTestRouter()

	user := models.User{
		Username: "inactiveuser",
		Email:    "inactive@example.com",
		IsActive: false,
	}
	user.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&user)

	payload := map[string]string{
		"username": "inactiveuser",
		"password": "password123",
	}

	w, _ := MakeRequest(router, "POST", "/api/v1/auth/login", payload, nil)
	AssertStatus(t, http.StatusForbidden, w.StatusCode)
}

func TestGetCurrentUser(t *testing.T) {
	router := SetupTestRouter()

	user := models.User{
		Username: "currentuser",
		Email:    "current@example.com",
		IsActive: true,
	}
	user.SetPassword("password123")
	db := models.GetDB()
	db.User.Insert().One(&user)

	token, _ := middleware.GenerateToken(&user)

	headers := map[string]string{
		"Authorization": "Bearer " + token,
	}

	w, _ := MakeRequest(router, "GET", "/api/v1/user/me", nil, headers)
	AssertStatus(t, http.StatusOK, w.StatusCode)
	AssertJSONHasKey(t, ReadBody(w), "username")
	AssertJSONHasKey(t, ReadBody(w), "email")
}
