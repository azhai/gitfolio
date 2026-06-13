package services

import (
	"testing"
)

func TestParseUnifiedDiff(t *testing.T) {
	tests := []struct {
		name      string
		diffText  string
		wantLines int
		wantAdd   int
		wantDel   int
	}{
		{
			"empty diff",
			"",
			0,
			0,
			0,
		},
		{
			"simple addition",
			"diff --git a/file.txt b/file.txt\nindex abc..def 100644\n--- a/file.txt\n+++ b/file.txt\n@@ -0,0 +1 @@\n+hello world\n",
			2, // hunk + added
			1,
			0,
		},
		{
			"simple deletion",
			"diff --git a/file.txt b/file.txt\n--- a/file.txt\n+++ b/file.txt\n@@ -1 +0,0 @@\n-old line\n",
			2, // hunk + deleted
			0,
			1,
		},
		{
			"context and changes",
			"@@ -1,3 +1,3 @@\n context line\n-old line\n+new line\n",
			4, // hunk + context + deleted + added
			1,
			1,
		},
		{
			"multiple hunks",
			"@@ -1,2 +1,2 @@\n-old1\n+new1\n@@ -10,2 +10,2 @@\n-old2\n+new2\n",
			6, // 2 hunks + 2 deleted + 2 added
			2,
			2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lines, additions, deletions := parseUnifiedDiff(tt.diffText)
			if len(lines) != tt.wantLines {
				t.Errorf("parseUnifiedDiff() lines count = %d, want %d", len(lines), tt.wantLines)
			}
			if additions != tt.wantAdd {
				t.Errorf("parseUnifiedDiff() additions = %d, want %d", additions, tt.wantAdd)
			}
			if deletions != tt.wantDel {
				t.Errorf("parseUnifiedDiff() deletions = %d, want %d", deletions, tt.wantDel)
			}
		})
	}
}

func TestParseUnifiedDiff_LineTypes(t *testing.T) {
	diffText := `@@ -1,4 +1,4 @@ context
 unchanged line
-removed line
+added line
 another context
`
	lines, additions, deletions := parseUnifiedDiff(diffText)

	if len(lines) != 5 { // hunk + context + deleted + added + context
		t.Errorf("expected 5 lines, got %d", len(lines))
	}

	// First line should be hunk
	if lines[0].Type != "hunk" {
		t.Errorf("line[0] type = %q, want 'hunk'", lines[0].Type)
	}

	// Context line
	if lines[1].Type != "context" {
		t.Errorf("line[1] type = %q, want 'context'", lines[1].Type)
	}
	if lines[1].Content != "unchanged line" {
		t.Errorf("line[1] content = %q, want 'unchanged line'", lines[1].Content)
	}

	// Deleted line
	if lines[2].Type != "deleted" {
		t.Errorf("line[2] type = %q, want 'deleted'", lines[2].Type)
	}
	if lines[2].Content != "removed line" {
		t.Errorf("line[2] content = %q, want 'removed line'", lines[2].Content)
	}
	if lines[2].OldLineNo != 2 {
		t.Errorf("line[2] OldLineNo = %d, want 2", lines[2].OldLineNo)
	}

	// Added line
	if lines[3].Type != "added" {
		t.Errorf("line[3] type = %q, want 'added'", lines[3].Type)
	}
	if lines[3].Content != "added line" {
		t.Errorf("line[3] content = %q, want 'added line'", lines[3].Content)
	}
	if lines[3].NewLineNo != 2 {
		t.Errorf("line[3] NewLineNo = %d, want 2", lines[3].NewLineNo)
	}

	if additions != 1 || deletions != 1 {
		t.Errorf("additions=%d deletions=%d, want 1,1", additions, deletions)
	}
}

func TestParseUnifiedDiff_LineNumbers(t *testing.T) {
	diffText := `@@ -5,3 +5,3 @@
 line5
-old6
+new6
 line7
`
	lines, _, _ := parseUnifiedDiff(diffText)

	// Hunk header should parse starting line numbers
	if lines[0].Type != "hunk" {
		t.Fatalf("first line should be hunk")
	}

	// Context line at old=5, new=5
	if lines[1].OldLineNo != 5 || lines[1].NewLineNo != 5 {
		t.Errorf("context line numbers: old=%d new=%d, want 5,5", lines[1].OldLineNo, lines[1].NewLineNo)
	}

	// Deleted line at old=6
	if lines[2].OldLineNo != 6 {
		t.Errorf("deleted line OldLineNo = %d, want 6", lines[2].OldLineNo)
	}

	// Added line at new=6
	if lines[3].NewLineNo != 6 {
		t.Errorf("added line NewLineNo = %d, want 6", lines[3].NewLineNo)
	}
}
