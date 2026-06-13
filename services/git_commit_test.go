package services

import (
	"testing"
)

func TestParseGitShortlog(t *testing.T) {
	svc := &GitService{}

	tests := []struct {
		name   string
		output string
		want   int // expected count of contributors
	}{
		{
			"empty output",
			"",
			0,
		},
		{
			"single contributor",
			"10\tAlice <alice@example.com>",
			1,
		},
		{
			"multiple contributors",
			"20\tAlice <alice@example.com>\n10\tBob <bob@example.com>\n5\tCharlie <charlie@example.com>",
			3,
		},
		{
			"blank lines ignored",
			"5\tAlice <alice@example.com>\n\n3\tBob <bob@example.com>",
			2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := svc.parseGitShortlog(tt.output)
			if len(got) != tt.want {
				t.Errorf("parseGitShortlog() count = %d, want %d", len(got), tt.want)
			}
		})
	}
}

func TestParseGitShortlog_Fields(t *testing.T) {
	svc := &GitService{}

	output := "15\tAlice <alice@example.com>\n8\tBob <bob@test.com>"
	contributors := svc.parseGitShortlog(output)

	if len(contributors) != 2 {
		t.Fatalf("expected 2 contributors, got %d", len(contributors))
	}

	// First contributor
	if contributors[0].Name != "Alice" {
		t.Errorf("contributors[0].Name = %q, want 'Alice'", contributors[0].Name)
	}
	if contributors[0].Email != "alice@example.com" {
		t.Errorf("contributors[0].Email = %q, want 'alice@example.com'", contributors[0].Email)
	}
	if contributors[0].Count != 15 {
		t.Errorf("contributors[0].Count = %d, want 15", contributors[0].Count)
	}

	// Second contributor
	if contributors[1].Name != "Bob" {
		t.Errorf("contributors[1].Name = %q, want 'Bob'", contributors[1].Name)
	}
	if contributors[1].Email != "bob@test.com" {
		t.Errorf("contributors[1].Email = %q, want 'bob@test.com'", contributors[1].Email)
	}
	if contributors[1].Count != 8 {
		t.Errorf("contributors[1].Count = %d, want 8", contributors[1].Count)
	}
}

func TestMatchesDatePattern(t *testing.T) {
	tests := []struct {
		line string
		want bool
	}{
		{"2024-06-15", true},
		{"2024-1-05", false},    // month must be 2 digits
		{"24-06-15", false},     // year must be 4 digits
		{"2024/06/15", false},   // wrong separator
		{"2024-06-15x", false},  // too long
		{"hello", false},
		{"", false},
		{"2024-13-01", true},    // valid format, invalid date (not our job to validate)
	}

	for _, tt := range tests {
		t.Run(tt.line, func(t *testing.T) {
			if got := matchesDatePattern(tt.line); got != tt.want {
				t.Errorf("matchesDatePattern(%q) = %v, want %v", tt.line, got, tt.want)
			}
		})
	}
}

func TestIsNumstatLine(t *testing.T) {
	tests := []struct {
		line string
		want bool
	}{
		{"10\t5\tfile.txt", true},
		{"-\t-\tbinary.png", true},
		{"0\t0\tfile.txt", true},
		{"just text", false},
		{"10\tfile.txt", false}, // only 2 fields
		{"abc\t5\tfile.txt", false}, // non-numeric first field
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.line, func(t *testing.T) {
			if got := isNumstatLine(tt.line); got != tt.want {
				t.Errorf("isNumstatLine(%q) = %v, want %v", tt.line, got, tt.want)
			}
		})
	}
}
