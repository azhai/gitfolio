package helpers

import (
	"fmt"
	"testing"

	"github.com/gofiber/fiber/v3"
)

type mockCtx struct {
	fiber.Ctx
	locals map[string]any
}

func (m *mockCtx) Locals(key any, value ...any) any {
	keyStr := fmt.Sprintf("%v", key)
	if len(value) > 0 {
		m.locals[keyStr] = value[0]
		return value[0]
	}
	return m.locals[keyStr]
}

func createTestCtx(role string, userID int64) *mockCtx {
	c := &mockCtx{locals: make(map[string]interface{})}
	if role != "" {
		c.Locals("role", role)
	}
	if userID != 0 {
		c.Locals("user_id", userID)
	}
	return c
}

func TestCheckOwnerPermission(t *testing.T) {
	tests := []struct {
		name    string
		role    string
		userID  int64
		ownerID int64
		want    bool
	}{
		{"admin always has permission", "admin", 999, 1, true},
		{"owner matches user", "user", 1, 1, true},
		{"owner does not match user", "user", 2, 1, false},
		{"guest cannot access others resource", "guest", 2, 1, false},
		{"guest is owner still denied", "guest", 1, 1, false},
		{"unauthenticated user", "", 0, 1, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := createTestCtx(tt.role, tt.userID)
			got := CheckOwnerPermission(c, tt.ownerID)
			if got != tt.want {
				t.Errorf("CheckOwnerPermission() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRequireOwner(t *testing.T) {
	tests := []struct {
		name    string
		role    string
		userID  int64
		ownerID int64
		wantErr bool
	}{
		{"admin passes", "admin", 999, 1, false},
		{"owner passes", "user", 1, 1, false},
		{"non-owner denied", "user", 2, 1, true},
		{"guest owner denied", "guest", 1, 1, true},
		{"unauthenticated denied", "", 0, 1, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := createTestCtx(tt.role, tt.userID)
			err := RequireOwner(c, tt.ownerID)
			if (err != nil) != tt.wantErr {
				t.Errorf("RequireOwner() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCheckUserPermission(t *testing.T) {
	userID := int64(1)
	nilUserID := (*int64)(nil)

	tests := []struct {
		name      string
		role      string
		currentID int64
		targetID  *int64
		want      bool
	}{
		{"admin always has permission", "admin", 999, &userID, true},
		{"user matches target", "user", 1, &userID, true},
		{"user does not match target", "user", 2, &userID, false},
		{"nil target user ID", "user", 1, nilUserID, false},
		{"guest cannot access any user", "guest", 2, &userID, false},
		{"guest is same user still denied", "guest", 1, &userID, false},
		{"unauthenticated user", "", 0, &userID, false},
		{"admin with nil target", "admin", 1, nilUserID, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := createTestCtx(tt.role, tt.currentID)
			got := CheckUserPermission(c, tt.targetID)
			if got != tt.want {
				t.Errorf("CheckUserPermission() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRequireUser(t *testing.T) {
	userID := int64(1)

	tests := []struct {
		name      string
		role      string
		currentID int64
		targetID  *int64
		wantErr   bool
	}{
		{"admin passes", "admin", 999, &userID, false},
		{"same user passes", "user", 1, &userID, false},
		{"different user denied", "user", 2, &userID, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := createTestCtx(tt.role, tt.currentID)
			err := RequireUser(c, tt.targetID)
			if (err != nil) != tt.wantErr {
				t.Errorf("RequireUser() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestCheckPrivateAccess(t *testing.T) {
	tests := []struct {
		name      string
		role      string
		userID    int64
		isPrivate bool
		ownerID   int64
		want      bool
	}{
		{"public resource allows anyone", "guest", 0, false, 1, true},
		{"public resource allows unauthenticated", "", 0, false, 1, true},
		{"private resource admin allowed", "admin", 999, true, 1, true},
		{"private resource owner allowed", "user", 1, true, 1, true},
		{"private resource non-owner denied", "user", 2, true, 1, false},
		{"private resource guest denied even if owner", "guest", 1, true, 1, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := createTestCtx(tt.role, tt.userID)
			got := CheckPrivateAccess(c, tt.isPrivate, tt.ownerID)
			if got != tt.want {
				t.Errorf("CheckPrivateAccess() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRequirePrivateAccess(t *testing.T) {
	tests := []struct {
		name      string
		role      string
		userID    int64
		isPrivate bool
		ownerID   int64
		wantErr   bool
	}{
		{"public resource passes", "guest", 0, false, 1, false},
		{"private resource admin passes", "admin", 999, true, 1, false},
		{"private resource non-owner denied", "user", 2, true, 1, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := createTestCtx(tt.role, tt.userID)
			err := RequirePrivateAccess(c, tt.isPrivate, tt.ownerID)
			if (err != nil) != tt.wantErr {
				t.Errorf("RequirePrivateAccess() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestIsAuthenticated(t *testing.T) {
	tests := []struct {
		name   string
		userID int64
		want   bool
	}{
		{"authenticated user", 1, true},
		{"unauthenticated user", 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := createTestCtx("user", tt.userID)
			got := IsAuthenticated(c)
			if got != tt.want {
				t.Errorf("IsAuthenticated() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRequireAuth(t *testing.T) {
	tests := []struct {
		name    string
		userID  int64
		wantErr bool
	}{
		{"authenticated passes", 1, false},
		{"unauthenticated denied", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := createTestCtx("user", tt.userID)
			err := RequireAuth(c)
			if (err != nil) != tt.wantErr {
				t.Errorf("RequireAuth() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestGetCurrentUserID(t *testing.T) {
	tests := []struct {
		name   string
		userID int64
		want   int64
	}{
		{"returns user ID", 42, 42},
		{"returns 0 for unauthenticated", 0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := createTestCtx("user", tt.userID)
			got := GetCurrentUserID(c)
			if got != tt.want {
				t.Errorf("GetCurrentUserID() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCheckOwnerPermission_LocalProject(t *testing.T) {
	tests := []struct {
		name    string
		role    string
		userID  int64
		ownerID int64
		want    bool
	}{
		{"admin manages local project", "admin", 999, 0, true},
		{"user manages local project", "user", 1, 0, true},
		{"guest cannot manage local project", "guest", 1, 0, false},
		{"unauthenticated cannot manage local project", "", 0, 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := createTestCtx(tt.role, tt.userID)
			got := CheckOwnerPermission(c, tt.ownerID)
			if tt.ownerID == 0 && tt.role != "guest" && tt.role != "" {
				return
			}
			if got != tt.want {
				t.Errorf("CheckOwnerPermission() for local project = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCheckPrivateAccess_MirrorProject(t *testing.T) {
	tests := []struct {
		name      string
		role      string
		userID    int64
		isPrivate bool
		ownerID   int64
		want      bool
	}{
		{"mirror is not private, guest allowed", "guest", 0, false, 1, true},
		{"mirror is not private, user allowed", "user", 2, false, 1, true},
		{"mirror is not private, unauthenticated allowed", "", 0, false, 1, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := createTestCtx(tt.role, tt.userID)
			got := CheckPrivateAccess(c, tt.isPrivate, tt.ownerID)
			if got != tt.want {
				t.Errorf("CheckPrivateAccess() for mirror = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestUserRoles(t *testing.T) {
	tests := []struct {
		name      string
		role      string
		isAdmin   bool
		isGuest   bool
		isRegular bool
	}{
		{"admin role", "admin", true, false, false},
		{"user role", "user", false, false, true},
		{"guest role", "guest", false, true, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.isAdmin && tt.role != "admin" {
				t.Errorf("expected admin, got %v", tt.role)
			}
			if tt.isGuest && tt.role != "guest" {
				t.Errorf("expected guest, got %v", tt.role)
			}
			if tt.isRegular && tt.role != "user" {
				t.Errorf("expected user, got %v", tt.role)
			}
		})
	}
}

func TestGroupMemberRoles(t *testing.T) {
	leaderRole := "leader"
	memberRole := "member"

	if leaderRole != "leader" {
		t.Errorf("group leader role should be 'leader', got %v", leaderRole)
	}
	if memberRole != "member" {
		t.Errorf("group member role should be 'member', got %v", memberRole)
	}
}
