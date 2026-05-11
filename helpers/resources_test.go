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
	if repo.IsPrivate() {
		t.Error("mirror repo should report IsPrivate() = false")
	}
	if !repo.IsRemote() {
		t.Error("mirror repo should report IsRemote() = true")
	}
	if repo.CanPushRemote() {
		t.Error("mirror repo should report CanPushRemote() = false")
	}

	localRepo := &models.Repository{ProjectType: "local"}
	if localRepo.IsMirror() {
		t.Error("local repo should report IsMirror() = false")
	}
	if localRepo.IsPrivate() {
		t.Error("local repo should report IsPrivate() = false")
	}
	if localRepo.IsRemote() {
		t.Error("local repo should report IsRemote() = false")
	}

	publicRepo := &models.Repository{ProjectType: "public"}
	if publicRepo.IsMirror() {
		t.Error("public repo should report IsMirror() = false")
	}
	if publicRepo.IsPrivate() {
		t.Error("public repo should report IsPrivate() = false")
	}
	if !publicRepo.IsRemote() {
		t.Error("public repo should report IsRemote() = true")
	}
	if !publicRepo.CanPushRemote() {
		t.Error("public repo should report CanPushRemote() = true")
	}

	privateRepo := &models.Repository{ProjectType: "private"}
	if privateRepo.IsMirror() {
		t.Error("private repo should report IsMirror() = false")
	}
	if !privateRepo.IsPrivate() {
		t.Error("private repo should report IsPrivate() = true")
	}
	if !privateRepo.IsRemote() {
		t.Error("private repo should report IsRemote() = true")
	}
	if !privateRepo.CanPushRemote() {
		t.Error("private repo should report CanPushRemote() = true")
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

func TestResourceResult_OwnerName(t *testing.T) {
	tests := []struct {
		name     string
		result   *ResourceResult
		expected string
	}{
		{
			"user owned repo returns username",
			&ResourceResult{
				Owner: &models.User{ID: 1, Username: "alice"},
				Repo:  &models.Repository{ID: 100, Name: "myrepo"},
			},
			"alice",
		},
		{
			"group owned repo returns group name",
			&ResourceResult{
				Group: &models.Group{ID: 10, Name: "myteam"},
				Repo:  &models.Repository{ID: 200, Name: "teamrepo", OwnerType: "group"},
			},
			"myteam",
		},
		{
			"local project without owner returns local",
			&ResourceResult{
				Repo: &models.Repository{ID: 300, Name: "localrepo", ProjectType: "local"},
			},
			"local",
		},
		{
			"nil owner and nil group returns local",
			&ResourceResult{
				Repo: &models.Repository{ID: 400, Name: "orphan"},
			},
			"local",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.result.OwnerName()
			if got != tt.expected {
				t.Errorf("OwnerName() = %v, want %v", got, tt.expected)
			}
		})
	}
}
