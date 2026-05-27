package models

import (
	"testing"
	"time"
)

func TestUser_SetPassword(t *testing.T) {
	u := &User{}
	password := "mySecret123"

	if err := u.SetPassword(password); err != nil {
		t.Fatalf("SetPassword() error = %v", err)
	}

	if u.Password == "" {
		t.Error("SetPassword() should set a non-empty hash")
	}

	if u.Password == password {
		t.Error("SetPassword() should store a hashed password, not plaintext")
	}
}

func TestUser_CheckPassword(t *testing.T) {
	u := &User{}
	password := "mySecret123"
	u.SetPassword(password)

	tests := []struct {
		name     string
		password string
		want     bool
	}{
		{"correct password", password, true},
		{"wrong password", "wrongPass", false},
		{"empty password", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := u.CheckPassword(tt.password); got != tt.want {
				t.Errorf("CheckPassword() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestUser_CheckPassword_EmptyHash(t *testing.T) {
	u := &User{Password: ""}
	if u.CheckPassword("") {
		t.Error("CheckPassword() with empty hash should return false")
	}
}

func TestRepository_IsMirror(t *testing.T) {
	tests := []struct {
		name        string
		projectType string
		want        bool
	}{
		{"mirror type", "mirror", true},
		{"local type", "local", false},
		{"public type", "public", false},
		{"private type", "private", false},
		{"empty type", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &Repository{ProjectType: tt.projectType}
			if got := r.IsMirror(); got != tt.want {
				t.Errorf("IsMirror() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRepository_IsPrivate(t *testing.T) {
	tests := []struct {
		name        string
		projectType string
		want        bool
	}{
		{"private type", "private", true},
		{"local type", "local", false},
		{"mirror type", "mirror", false},
		{"public type", "public", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &Repository{ProjectType: tt.projectType}
			if got := r.IsPrivate(); got != tt.want {
				t.Errorf("IsPrivate() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRepository_IsLocal(t *testing.T) {
	tests := []struct {
		name        string
		projectType string
		want        bool
	}{
		{"local type", "local", true},
		{"mirror type", "mirror", false},
		{"public type", "public", false},
		{"private type", "private", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &Repository{ProjectType: tt.projectType}
			if got := r.IsLocal(); got != tt.want {
				t.Errorf("IsLocal() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRepository_IsRemote(t *testing.T) {
	tests := []struct {
		name        string
		projectType string
		want        bool
	}{
		{"mirror is remote", "mirror", true},
		{"public is remote", "public", true},
		{"private is remote", "private", true},
		{"local is not remote", "local", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &Repository{ProjectType: tt.projectType}
			if got := r.IsRemote(); got != tt.want {
				t.Errorf("IsRemote() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRepository_CanPushRemote(t *testing.T) {
	tests := []struct {
		name        string
		projectType string
		want        bool
	}{
		{"public can push", "public", true},
		{"private can push", "private", true},
		{"mirror cannot push", "mirror", false},
		{"local cannot push", "local", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &Repository{ProjectType: tt.projectType}
			if got := r.CanPushRemote(); got != tt.want {
				t.Errorf("CanPushRemote() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRepository_IsGroupOwned(t *testing.T) {
	tests := []struct {
		name      string
		ownerType string
		want      bool
	}{
		{"group owned", "group", true},
		{"user owned", "user", false},
		{"empty owner type", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &Repository{OwnerType: tt.ownerType}
			if got := r.IsGroupOwned(); got != tt.want {
				t.Errorf("IsGroupOwned() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRepository_DefaultValues(t *testing.T) {
	r := &Repository{}

	// DefaultBranch 的默认值 "main" 由数据库 tag goe:"default:'main'" 设置
	// Go 零值为空字符串，只有从数据库读取时才有默认值
	if r.DefaultBranch != "" {
		t.Errorf("DefaultBranch zero value = %q, want empty (set by DB tag)", r.DefaultBranch)
	}
	if r.IsFork {
		t.Error("IsFork zero value should be false")
	}
}

func TestRepositoryStats_DefaultValues(t *testing.T) {
	s := &RepositoryStats{}

	if s.StarsCount != 0 {
		t.Errorf("StarsCount default = %d, want 0", s.StarsCount)
	}
	if s.CommitsCount != 0 {
		t.Errorf("CommitsCount default = %d, want 0", s.CommitsCount)
	}
	if s.OpenIssuesCount != 0 {
		t.Errorf("OpenIssuesCount default = %d, want 0", s.OpenIssuesCount)
	}
}

func TestIssue_Fields(t *testing.T) {
	assigneeID := int64(42)
	i := &Issue{
		Title:        "Bug report",
		Body:         "Something is broken",
		Number:       1,
		RepositoryID: 100,
		AuthorID:     10,
		AssigneeID:   &assigneeID,
		IsClosed:     false,
		IsLocked:     false,
	}

	if i.Title != "Bug report" {
		t.Errorf("Issue.Title = %q, want 'Bug report'", i.Title)
	}
	if i.AssigneeID == nil || *i.AssigneeID != 42 {
		t.Error("Issue.AssigneeID should be 42")
	}
	if i.IsClosed {
		t.Error("Issue.IsClosed should be false by default")
	}
}

func TestPullRequest_Fields(t *testing.T) {
	pr := &PullRequest{
		Title:        "Fix bug",
		Number:       5,
		SourceBranch: "feature/fix",
		TargetBranch: "main",
		Status:       "open",
	}

	if pr.TargetBranch != "main" {
		t.Errorf("PullRequest.TargetBranch = %q, want 'main'", pr.TargetBranch)
	}
	if pr.Status != "open" {
		t.Errorf("PullRequest.Status = %q, want 'open'", pr.Status)
	}
}

func TestTask_Fields(t *testing.T) {
	task := &Task{
		Title:        "Implement feature",
		Status:       "draft",
		Priority:     3,
		SortOrder:    0,
		RepositoryID: 1,
		InitiatorID:  10,
	}

	if task.Status != "draft" {
		t.Errorf("Task.Status = %q, want 'draft'", task.Status)
	}
	if task.Priority != 3 {
		t.Errorf("Task.Priority = %d, want 3", task.Priority)
	}
}

func TestGroup_Fields(t *testing.T) {
	g := &Group{
		Name:        "myteam",
		DisplayName: "My Team",
		OwnerID:     1,
	}

	if g.Name != "myteam" {
		t.Errorf("Group.Name = %q, want 'myteam'", g.Name)
	}
}

func TestGroupMember_Fields(t *testing.T) {
	gm := &GroupMember{
		GroupID: 1,
		UserID:  10,
		Role:    "leader",
	}

	if gm.Role != "leader" {
		t.Errorf("GroupMember.Role = %q, want 'leader'", gm.Role)
	}
}

func TestRemoteRepository_Fields(t *testing.T) {
	rr := &RemoteRepository{
		Platform:  "github",
		Owner:     "alice",
		RepoName:  "myrepo",
		Direction: "pull",
	}

	if rr.Direction != "pull" {
		t.Errorf("RemoteRepository.Direction = %q, want 'pull'", rr.Direction)
	}
	// SyncEnabled 默认值由数据库 tag 设置，Go 零值为 false
	if rr.SyncEnabled {
		t.Error("RemoteRepository.SyncEnabled zero value should be false (default set by DB tag)")
	}
}

func TestSyncPoint_Defaults(t *testing.T) {
	sp := &SyncPoint{}

	// SyncInterval 默认值由数据库 tag goe:"default:3600" 设置
	// Go 零值为 0，只有从数据库读取时才有默认值
	if sp.SyncInterval != 0 {
		t.Errorf("SyncPoint.SyncInterval zero value = %d, want 0 (default set by DB tag)", sp.SyncInterval)
	}
	if sp.IsPaused {
		t.Error("SyncPoint.IsPaused zero value should be false")
	}
}

func TestContributor_Fields(t *testing.T) {
	c := &Contributor{
		Name:         "Alice",
		Email:        "alice@example.com",
		RepositoryID: 1,
		CommitsCount: 10,
	}

	if c.CommitsCount != 10 {
		t.Errorf("Contributor.CommitsCount = %d, want 10", c.CommitsCount)
	}
}

func TestLabel_Fields(t *testing.T) {
	l := &Label{
		Name:         "bug",
		Color:        "ff0000",
		Description:  "Bug report",
		RepositoryID: 1,
	}

	if l.Color != "ff0000" {
		t.Errorf("Label.Color = %q, want 'ff0000'", l.Color)
	}
}

func TestMilestone_Fields(t *testing.T) {
	dueDate := time.Now().Add(7 * 24 * time.Hour)
	m := &Milestone{
		Title:        "v1.0",
		Description:  "First release",
		DueDate:      &dueDate,
		RepositoryID: 1,
		IsClosed:     false,
	}

	if m.IsClosed {
		t.Error("Milestone.IsClosed should be false by default")
	}
	if m.DueDate == nil {
		t.Error("Milestone.DueDate should be set")
	}
}

func TestSnippet_Fields(t *testing.T) {
	s := &Snippet{
		Title:      "Hello World",
		Language:   "go",
		Code:       `fmt.Println("Hello")`,
		Visibility: "public",
		Version:    1,
	}

	if s.Visibility != "public" {
		t.Errorf("Snippet.Visibility = %q, want 'public'", s.Visibility)
	}
}

func TestWebhook_Fields(t *testing.T) {
	w := &Webhook{
		URL:      "https://example.com/webhook",
		Secret:   "mysecret",
		IsActive: true,
		Events:   "push",
	}

	if !w.IsActive {
		t.Error("Webhook.IsActive should be true")
	}
}

func TestActivity_Fields(t *testing.T) {
	userID := int64(1)
	repoID := int64(100)
	a := &Activity{
		UserID:       &userID,
		RepositoryID: &repoID,
		ActivityType: "star",
		Title:        "Starred repo",
	}

	if a.ActivityType != "star" {
		t.Errorf("Activity.ActivityType = %q, want 'star'", a.ActivityType)
	}
}

func TestPlatformType_Constants(t *testing.T) {
	if PlatformGitHub != "github" {
		t.Errorf("PlatformGitHub = %q, want 'github'", PlatformGitHub)
	}
	if PlatformGitea != "gitea" {
		t.Errorf("PlatformGitea = %q, want 'gitea'", PlatformGitea)
	}
	if PlatformGitFolio != "gitfolio" {
		t.Errorf("PlatformGitFolio = %q, want 'gitfolio'", PlatformGitFolio)
	}
	if PlatformGitLab != "gitlab" {
		t.Errorf("PlatformGitLab = %q, want 'gitlab'", PlatformGitLab)
	}
}

func TestProjectType_Constants(t *testing.T) {
	if ProjectTypeLocal != "local" {
		t.Errorf("ProjectTypeLocal = %q, want 'local'", ProjectTypeLocal)
	}
	if ProjectTypeMirror != "mirror" {
		t.Errorf("ProjectTypeMirror = %q, want 'mirror'", ProjectTypeMirror)
	}
	if ProjectTypePublic != "public" {
		t.Errorf("ProjectTypePublic = %q, want 'public'", ProjectTypePublic)
	}
	if ProjectTypePrivate != "private" {
		t.Errorf("ProjectTypePrivate = %q, want 'private'", ProjectTypePrivate)
	}
}
