package helpers

import (
	"testing"
	"time"
)

func TestFormatTime(t *testing.T) {
	tests := []struct {
		name string
		time time.Time
		want string
	}{
		{
			"zero time returns empty",
			time.Time{},
			"",
		},
		{
			"valid time formats with CST",
			time.Date(2024, 6, 15, 10, 30, 0, 0, time.UTC),
			"2024-06-15T18:30:00+08:00",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := FormatTime(tt.time)
			if got != tt.want {
				t.Errorf("FormatTime() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestGetOffset(t *testing.T) {
	tests := []struct {
		page    int
		perPage int
		want    int
	}{
		{1, 20, 0},
		{2, 20, 20},
		{3, 10, 20},
		{5, 5, 20},
	}

	for _, tt := range tests {
		t.Run("", func(t *testing.T) {
			if got := GetOffset(tt.page, tt.perPage); got != tt.want {
				t.Errorf("GetOffset(%d, %d) = %d, want %d", tt.page, tt.perPage, got, tt.want)
			}
		})
	}
}

func TestNewResponse(t *testing.T) {
	data := map[string]string{"key": "value"}
	resp := NewResponse(data)

	if resp.Data == nil {
		t.Error("NewResponse() Data should not be nil")
	}
	if resp.Page != 0 {
		t.Errorf("NewResponse() Page = %d, want 0", resp.Page)
	}
	if resp.Total != 0 {
		t.Errorf("NewResponse() Total = %d, want 0", resp.Total)
	}
}

func TestNewPaginatedResponse(t *testing.T) {
	data := []string{"a", "b"}
	resp := NewPaginatedResponse(data, 2, 10, 50)

	if resp.Data == nil {
		t.Error("NewPaginatedResponse() Data should not be nil")
	}
	if resp.Page != 2 {
		t.Errorf("NewPaginatedResponse() Page = %d, want 2", resp.Page)
	}
	if resp.PerPage != 10 {
		t.Errorf("NewPaginatedResponse() PerPage = %d, want 10", resp.PerPage)
	}
	if resp.Total != 50 {
		t.Errorf("NewPaginatedResponse() Total = %d, want 50", resp.Total)
	}
}
