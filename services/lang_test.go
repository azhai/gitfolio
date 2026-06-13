package services

import (
	"testing"
)

func TestIsCommentLine(t *testing.T) {
	tests := []struct {
		line string
		ext  string
		want bool
	}{
		// Go
		{"// comment", "go", true},
		{"func main() {", "go", false},
		// Python
		{"# comment", "py", true},
		{"x = 1", "py", false},
		// HTML
		{"<!-- comment -->", "html", true},
		{"<div>", "html", false},
		// CSS
		{"/* block */", "css", true},
		{"* continued", "css", true},
		{".class {", "css", false},
		// Shell
		{"#!/bin/bash", "sh", true},
		{"echo hello", "sh", false},
		// SQL
		{"-- select all", "sql", true},
		{"SELECT * FROM t", "sql", false},
		// YAML
		{"# config", "yaml", true},
		{"key: value", "yaml", false},
		// No comment support
		{"anything", "json", false},
		{"anything", "txt", false},
		{"anything", "md", false},
		// Unknown extension
		{"anything", "xyz", false},
		// PHP (multiple prefixes)
		{"// php comment", "php", true},
		{"# php comment", "php", true},
		{"$var = 1;", "php", false},
		// JavaScript
		{"// js comment", "js", true},
		{"/* block */", "js", true},
		{"const x = 1;", "js", false},
	}

	for _, tt := range tests {
		t.Run(tt.ext+":"+tt.line, func(t *testing.T) {
			if got := isCommentLine(tt.line, tt.ext); got != tt.want {
				t.Errorf("isCommentLine(%q, %q) = %v, want %v", tt.line, tt.ext, got, tt.want)
			}
		})
	}
}

func TestGetLanguage(t *testing.T) {
	tests := []struct {
		ext  string
		want string
	}{
		{"go", "Go"},
		{"js", "JavaScript"},
		{"ts", "TypeScript"},
		{"py", "Python"},
		{"rb", "Ruby"},
		{"java", "Java"},
		{"c", "C"},
		{"cpp", "C++"},
		{"rust", "Rust"},
		{"html", "HTML"},
		{"css", "CSS"},
		{"scss", "SCSS"},
		{"sql", "SQL"},
		{"sh", "Shell"},
		{"yaml", "YAML"},
		{"yml", "YAML"},
		{"json", "JSON"},
		{"md", "Markdown"},
		{"unknown_ext", "Other"},
		{"", "Other"},
	}

	for _, tt := range tests {
		t.Run(tt.ext, func(t *testing.T) {
			if got := getLanguage(tt.ext); got != tt.want {
				t.Errorf("getLanguage(%q) = %q, want %q", tt.ext, got, tt.want)
			}
		})
	}
}

func TestGetExtension(t *testing.T) {
	svc := &GitService{}

	tests := []struct {
		filename string
		want     string
	}{
		{"main.go", "go"},
		{"index.html", "html"},
		{"app.test.js", "js"},
		{"Makefile", ""},
		{"README", ""},
		{".gitignore", "gitignore"},
	}

	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			if got := svc.getExtension(tt.filename); got != tt.want {
				t.Errorf("getExtension(%q) = %q, want %q", tt.filename, got, tt.want)
			}
		})
	}
}
