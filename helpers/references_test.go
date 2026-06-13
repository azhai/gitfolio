package helpers

import (
	"testing"
)

func TestParseCommitReferences(t *testing.T) {
	tests := []struct {
		name    string
		message string
		want    []CommitRef
	}{
		{
			"empty message",
			"",
			nil,
		},
		{
			"fixes issue",
			"fixes #123",
			[]CommitRef{{TargetType: "issue", TargetID: 123, Action: "closes"}},
		},
		{
			"closes issue",
			"Closes #456",
			[]CommitRef{{TargetType: "issue", TargetID: 456, Action: "closes"}},
		},
		{
			"resolves issue",
			"Resolves #789",
			[]CommitRef{{TargetType: "issue", TargetID: 789, Action: "closes"}},
		},
		{
			"references issue",
			"refs #10",
			[]CommitRef{{TargetType: "issue", TargetID: 10, Action: "references"}},
		},
		{
			"see issue",
			"see #20",
			[]CommitRef{{TargetType: "issue", TargetID: 20, Action: "references"}},
		},
		{
			"PR reference",
			"PR #30",
			[]CommitRef{{TargetType: "pull_request", TargetID: 30, Action: "references"}},
		},
		{
			"Task reference with dash",
			"Task- #40",
			[]CommitRef{{TargetType: "task", TargetID: 40, Action: "references"}},
		},
		{
			"Task reference with colon",
			"Task: #50",
			[]CommitRef{{TargetType: "task", TargetID: 50, Action: "references"}},
		},
		{
			"multiple references",
			"fixes #1 and refs #2",
			[]CommitRef{
				{TargetType: "issue", TargetID: 1, Action: "closes"},
				{TargetType: "issue", TargetID: 2, Action: "references"},
			},
		},
		{
			"duplicate reference deduplicated",
			"fixes #1 and fixes #1",
			[]CommitRef{{TargetType: "issue", TargetID: 1, Action: "closes"}},
		},
		{
			"no references",
			"just a normal commit message",
			nil,
		},
		{
			"reference in middle of sentence",
			"This fixes #42 by doing something",
			[]CommitRef{{TargetType: "issue", TargetID: 42, Action: "closes"}},
		},
		{
			"zero ID ignored",
			"fixes #0",
			nil,
		},
		{
			"mixed types",
			"fixes #1, PR #2, Task: #3",
			[]CommitRef{
				{TargetType: "issue", TargetID: 1, Action: "closes"},
				{TargetType: "pull_request", TargetID: 2, Action: "references"},
				{TargetType: "task", TargetID: 3, Action: "references"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ParseCommitReferences(tt.message)
			if len(got) != len(tt.want) {
				t.Errorf("ParseCommitReferences() count = %d, want %d\ngot:  %v\nwant: %v", len(got), len(tt.want), got, tt.want)
				return
			}
			for i, ref := range got {
				if ref.TargetType != tt.want[i].TargetType {
					t.Errorf("ref[%d].TargetType = %q, want %q", i, ref.TargetType, tt.want[i].TargetType)
				}
				if ref.TargetID != tt.want[i].TargetID {
					t.Errorf("ref[%d].TargetID = %d, want %d", i, ref.TargetID, tt.want[i].TargetID)
				}
				if ref.Action != tt.want[i].Action {
					t.Errorf("ref[%d].Action = %q, want %q", i, ref.Action, tt.want[i].Action)
				}
			}
		})
	}
}
