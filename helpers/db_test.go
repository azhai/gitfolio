package helpers

import (
	"testing"

	"github.com/azhai/gitfolio/models"
)

func TestCollectUniqueIDs(t *testing.T) {
	tests := []struct {
		name     string
		slices   [][]int64
		expected []int64
	}{
		{
			"empty slices",
			nil,
			nil,
		},
		{
			"single slice",
			[][]int64{{1, 2, 3}},
			[]int64{1, 2, 3},
		},
		{
			"multiple slices with duplicates",
			[][]int64{{1, 2, 3}, {2, 3, 4}, {4, 5}},
			[]int64{1, 2, 3, 4, 5},
		},
		{
			"slices with zero values",
			[][]int64{{0, 1, 2}, {0, 3}},
			[]int64{1, 2, 3},
		},
		{
			"empty inner slices",
			[][]int64{{}, {1}, {}},
			[]int64{1},
		},
		{
			"all same IDs",
			[][]int64{{1, 1}, {1, 1}},
			[]int64{1},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CollectUniqueIDs(tt.slices...)
			if len(got) != len(tt.expected) {
				t.Errorf("CollectUniqueIDs() length = %d, want %d", len(got), len(tt.expected))
				return
			}
			gotSet := make(map[int64]bool)
			for _, id := range got {
				gotSet[id] = true
			}
			for _, id := range tt.expected {
				if !gotSet[id] {
					t.Errorf("CollectUniqueIDs() missing id %d", id)
				}
			}
		})
	}
}

func TestCollectContributorIDs(t *testing.T) {
	assigneeID := int64(20)

	tests := []struct {
		name     string
		issues   []*models.Issue
		expected []int64
	}{
		{
			"nil issues",
			nil,
			nil,
		},
		{
			"empty issues",
			[]*models.Issue{},
			nil,
		},
		{
			"issues with author only",
			[]*models.Issue{
				{AuthorID: 1},
				{AuthorID: 2},
			},
			[]int64{1, 2},
		},
		{
			"issues with author and assignee",
			[]*models.Issue{
				{AuthorID: 1, AssigneeID: &assigneeID},
			},
			[]int64{1, 20},
		},
		{
			"issues with nil assignee",
			[]*models.Issue{
				{AuthorID: 1, AssigneeID: nil},
			},
			[]int64{1},
		},
		{
			"issues with zero assignee",
			[]*models.Issue{
				{AuthorID: 1, AssigneeID: int64Ptr(0)},
			},
			[]int64{1},
		},
		{
			"duplicate IDs across issues",
			[]*models.Issue{
				{AuthorID: 1, AssigneeID: int64Ptr(2)},
				{AuthorID: 2, AssigneeID: int64Ptr(1)},
			},
			[]int64{1, 2},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CollectContributorIDs(tt.issues)
			if len(got) != len(tt.expected) {
				t.Errorf("CollectContributorIDs() = %v, want %v", got, tt.expected)
				return
			}
			gotSet := make(map[int64]bool)
			for _, id := range got {
				gotSet[id] = true
			}
			for _, id := range tt.expected {
				if !gotSet[id] {
					t.Errorf("CollectContributorIDs() missing id %d", id)
				}
			}
		})
	}
}

func TestCollectPRContributorIDs(t *testing.T) {
	assigneeID := int64(30)

	tests := []struct {
		name     string
		prs      []*models.PullRequest
		expected []int64
	}{
		{
			"nil prs",
			nil,
			nil,
		},
		{
			"prs with author only",
			[]*models.PullRequest{
				{AuthorID: 1},
			},
			[]int64{1},
		},
		{
			"prs with author and assignee",
			[]*models.PullRequest{
				{AuthorID: 1, AssigneeID: &assigneeID},
			},
			[]int64{1, 30},
		},
		{
			"multiple prs with overlapping IDs",
			[]*models.PullRequest{
				{AuthorID: 1},
				{AuthorID: 2, AssigneeID: int64Ptr(1)},
			},
			[]int64{1, 2},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CollectPRContributorIDs(tt.prs)
			if len(got) != len(tt.expected) {
				t.Errorf("CollectPRContributorIDs() = %v, want %v", got, tt.expected)
				return
			}
			gotSet := make(map[int64]bool)
			for _, id := range got {
				gotSet[id] = true
			}
			for _, id := range tt.expected {
				if !gotSet[id] {
					t.Errorf("CollectPRContributorIDs() missing id %d", id)
				}
			}
		})
	}
}

func TestCollectEntityIDs(t *testing.T) {
	tests := []struct {
		name     string
		getID    func(int) int64
		length   int
		expected []int64
	}{
		{
			"empty",
			func(i int) int64 { return int64(i) },
			0,
			[]int64{},
		},
		{
			"three items",
			func(i int) int64 { return int64(i+1) * 10 },
			3,
			[]int64{10, 20, 30},
		},
		{
			"single item",
			func(i int) int64 { return 42 },
			1,
			[]int64{42},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CollectEntityIDs(tt.getID, tt.length)
			if len(got) != len(tt.expected) {
				t.Errorf("CollectEntityIDs() = %v, want %v", got, tt.expected)
				return
			}
			for i := range got {
				if got[i] != tt.expected[i] {
					t.Errorf("CollectEntityIDs()[%d] = %d, want %d", i, got[i], tt.expected[i])
				}
			}
		})
	}
}

// int64Ptr 辅助函数，创建 int64 指针
func int64Ptr(v int64) *int64 {
	return &v
}
