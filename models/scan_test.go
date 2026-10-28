package models

import (
	"context"
	"testing"
)

// ScanDest is maintained by hand, so it silently drifts from the struct when a
// field is added. That drift only shows up at query time ("number of field
// descriptions must equal number of destinations"), so check it directly:
// every scanned column must exist in the migrated table, and the counts match.
func TestScanDestMatchesSchema(t *testing.T) {
	db := openTestDB(t)
	defer CloseDB()

	cases := []struct {
		table string
		dest  []any
	}{
		{"user", (&User{}).ScanDest()},
		{"group", (&Group{}).ScanDest()},
		{"group_member", (&GroupMember{}).ScanDest()},
		{"repository", (&Repository{}).ScanDest()},
		{"repository_stats", (&RepositoryStats{}).ScanDest()},
		{"issue", (&Issue{}).ScanDest()},
		{"pull_request", (&PullRequest{}).ScanDest()},
		{"comment", (&Comment{}).ScanDest()},
		{"label", (&Label{}).ScanDest()},
		{"milestone", (&Milestone{}).ScanDest()},
		{"task", (&Task{}).ScanDest()},
		{"snippet", (&Snippet{}).ScanDest()},
		{"contributor", (&Contributor{}).ScanDest()},
		{"activity", (&Activity{}).ScanDest()},
		{"sync_point", (&SyncPoint{}).ScanDest()},
		{"remote_repository", (&RemoteRepository{}).ScanDest()},
		{"webhook", (&Webhook{}).ScanDest()},
	}

	for _, c := range cases {
		var cols int
		query := "SELECT count(*) FROM pragma_table_info('" + c.table + "')"
		if err := db.RawQueryRowContext(context.Background(), query).Scan(&cols); err != nil {
			t.Fatalf("%s: inspect table: %v", c.table, err)
		}
		if cols == 0 {
			t.Errorf("%s: table missing from the migrated schema", c.table)
			continue
		}
		if cols != len(c.dest) {
			t.Errorf("%s: table has %d columns but ScanDest has %d destinations", c.table, cols, len(c.dest))
		}
	}
}

// The column count can match while the order does not: sql columns follow the
// struct field order, so a misplaced destination scans the wrong column and
// fails on the first NULL. Round-trip a row with a NULL assignee to cover it.
func seedRepo(t *testing.T, db *Database) (int64, int64) {
	t.Helper()
	user := &User{Username: "scanner", Role: "admin"}
	if err := db.User.Insert().One(user); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	repo := &Repository{Name: "scan-target", OwnerID: user.ID, OwnerType: "user", ProjectType: "local"}
	if err := db.Repository.Insert().One(repo); err != nil {
		t.Fatalf("insert repository: %v", err)
	}
	return repo.ID, user.ID
}

func TestIssueScanRoundTrip(t *testing.T) {
	db := openTestDB(t)
	defer CloseDB()
	repoID, authorID := seedRepo(t, db)

	issue := &Issue{
		Title:        "scan order",
		Body:         "body",
		Number:       7,
		RepositoryID: repoID,
		AuthorID:     authorID,
		AuthorName:   "alice",
		Status:       "open",
	}
	if err := db.Issue.Insert().One(issue); err != nil {
		t.Fatalf("insert issue: %v", err)
	}

	got, err := db.Issue.Select().Where("id = ?", issue.ID).One()
	if err != nil {
		t.Fatalf("select issue: %v", err)
	}
	if got.AuthorName != "alice" {
		t.Errorf("AuthorName = %q, want alice", got.AuthorName)
	}
	if got.Status != "open" {
		t.Errorf("Status = %q, want open", got.Status)
	}
	if got.AssigneeID != nil {
		t.Errorf("AssigneeID = %v, want nil", got.AssigneeID)
	}
}

func TestPullRequestScanRoundTrip(t *testing.T) {
	db := openTestDB(t)
	defer CloseDB()
	repoID, authorID := seedRepo(t, db)

	pr := &PullRequest{
		Title:        "scan order",
		Number:       3,
		RepositoryID: repoID,
		AuthorID:     authorID,
		SourceBranch: "feature",
		TargetBranch: "master",
		Status:       "open",
	}
	if err := db.PullRequest.Insert().One(pr); err != nil {
		t.Fatalf("insert pull request: %v", err)
	}

	got, err := db.PullRequest.Select().Where("id = ?", pr.ID).One()
	if err != nil {
		t.Fatalf("select pull request: %v", err)
	}
	if got.SourceBranch != "feature" || got.TargetBranch != "master" {
		t.Errorf("branches = %q -> %q", got.SourceBranch, got.TargetBranch)
	}
	if got.Status != "open" {
		t.Errorf("Status = %q, want open", got.Status)
	}
}
