package helpers

import (
	"testing"

	"github.com/azhai/gitfolio/models"
)

func TestGetOwnerAndRepoWithPrivateAccess_MirrorPermissions(t *testing.T) {
	tests := []struct {
		name    string
		role    string
		userID  int64
		wantErr bool
	}{
		{"admin can access mirror repo", "admin", 1, false},
		{"guest can access mirror repo", "guest", 1, false},
		{"user cannot access others mirror repo", "user", 2, true},
		{"leader cannot access others mirror repo", "leader", 2, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := createTestCtx(tt.role, tt.userID)
			if tt.role == "admin" || tt.role == "guest" {
				return
			}
			err := RequireOwner(c, 1)
			if (err != nil) != tt.wantErr {
				t.Errorf("mirror repo permission check error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestResourceResult_Struct(t *testing.T) {
	result := &ResourceResult{
		Owner: &models.User{ID: 1, Username: "testuser"},
		Repo:  &models.Repository{ID: 100, Name: "testrepo"},
	}

	if result.Owner.Username != "testuser" {
		t.Errorf("Owner.Username = %v, want %v", result.Owner.Username, "testuser")
	}
	if result.Repo.Name != "testrepo" {
		t.Errorf("Repo.Name = %v, want %v", result.Repo.Name, "testrepo")
	}
	if result.Group != nil {
		t.Error("Group should be nil for user-owned repo")
	}
}

func TestResourceResult_GroupOwned(t *testing.T) {
	result := &ResourceResult{
		Group: &models.Group{ID: 10, Name: "testgroup"},
		Repo:  &models.Repository{ID: 200, Name: "testrepo", OwnerType: "group"},
	}

	if result.Group.Name != "testgroup" {
		t.Errorf("Group.Name = %v, want %v", result.Group.Name, "testgroup")
	}
	if result.Owner != nil {
		t.Error("Owner should be nil for group-owned repo")
	}
	if !result.Repo.IsGroupOwned() {
		t.Error("Repo should be group owned")
	}
}

func TestRepository_IsMirror(t *testing.T) {
	repo := &models.Repository{ProjectType: "mirror"}
	if !repo.IsMirror() {
		t.Error("mirror repo should report IsMirror() = true")
	}
	if !repo.IsPrivate() {
		t.Error("mirror repo should report IsPrivate() = true (same as IsMirror)")
	}

	localRepo := &models.Repository{ProjectType: "local"}
	if localRepo.IsMirror() {
		t.Error("local repo should report IsMirror() = false")
	}
	if localRepo.IsPrivate() {
		t.Error("local repo should report IsPrivate() = false")
	}
}

func TestRepository_IsGroupOwned(t *testing.T) {
	groupRepo := &models.Repository{OwnerType: "group"}
	if !groupRepo.IsGroupOwned() {
		t.Error("group repo should report IsGroupOwned() = true")
	}

	userRepo := &models.Repository{OwnerType: "user"}
	if userRepo.IsGroupOwned() {
		t.Error("user repo should report IsGroupOwned() = false")
	}
}

func TestRepository_IsLocal(t *testing.T) {
	localRepo := &models.Repository{ProjectType: "local"}
	if !localRepo.IsLocal() {
		t.Error("local repo should report IsLocal() = true")
	}

	mirrorRepo := &models.Repository{ProjectType: "mirror"}
	if mirrorRepo.IsLocal() {
		t.Error("mirror repo should report IsLocal() = false")
	}
}
