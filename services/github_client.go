package services

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/google/go-github/v88/github"
)

// newGitHubClient creates a go-github client with an optional OAuth token.
func newGitHubClient(token string) (*github.Client, error) {
	opts := []github.ClientOptionsFunc{github.WithHTTPClient(NewHTTPClient(60 * time.Second))}
	if token != "" {
		opts = append(opts, github.WithAuthToken(token))
	}
	return github.NewClient(opts...)
}

// doGitHubRequest performs an ETag-aware request using the go-github client.
// It decodes a successful JSON body into v and caches the returned ETag.
func (s *SyncService) doGitHubRequest(ctx context.Context, client *github.Client, method, urlStr string, body, v any) (*github.Response, error) {
	req, err := client.NewRequest(ctx, method, urlStr, body)
	if err != nil {
		return nil, err
	}

	url := req.URL.String()
	if etag := s.getETag(url); etag != "" {
		req.Header.Set("If-None-Match", etag)
	}

	resp, err := client.Do(req, v)
	if err != nil {
		if resp != nil && resp.StatusCode == http.StatusNotModified {
			return resp, &NotModifiedError{URL: url}
		}
		if errResp, ok := err.(*github.ErrorResponse); ok && errResp.Response != nil && errResp.Response.StatusCode == http.StatusUnauthorized {
			authHeader := req.Header.Get("Authorization")
			tokenHint := "empty"
			if authHeader != "" {
				parts := strings.SplitN(authHeader, " ", 2)
				if len(parts) == 2 {
					tokenHint = fmt.Sprintf("%s(len=%d)", parts[0], len(parts[1]))
				}
			}
			log.Printf("[DEBUG-auth] GitHub 401: url=%s token=%s message=%q remaining=%s limit=%s", url, tokenHint, errResp.Message, errResp.Response.Header.Get("X-Ratelimit-Remaining"), errResp.Response.Header.Get("X-Ratelimit-Limit"))
		}
		return resp, err
	}

	if etag := resp.Header.Get("ETag"); etag != "" {
		s.setETag(url, etag)
	}
	return resp, nil
}

// isGitHubNotModified reports whether err is a 304 Not Modified response.
func isGitHubNotModified(err error) bool {
	if err == nil {
		return false
	}
	_, ok := err.(*NotModifiedError)
	return ok
}

func toGitHubUser(u *github.User) GitHubUser {
	if u == nil {
		return GitHubUser{}
	}
	return GitHubUser{
		Login:     u.GetLogin(),
		ID:        u.GetID(),
		AvatarURL: u.GetAvatarURL(),
		Email:     u.GetEmail(),
		Name:      u.GetName(),
	}
}

func toGitHubRepo(r *github.Repository) GitHubRepo {
	if r == nil {
		return GitHubRepo{}
	}
	out := GitHubRepo{
		ID:               r.GetID(),
		Name:             r.GetName(),
		FullName:         r.GetFullName(),
		Description:      r.GetDescription(),
		Homepage:         r.GetHomepage(),
		Private:          r.GetPrivate(),
		Fork:             r.GetFork(),
		CloneURL:         r.GetCloneURL(),
		SSHURL:           r.GetSSHURL(),
		HTMLURL:          r.GetHTMLURL(),
		Owner:            toGitHubUser(r.GetOwner()),
		StargazersCount:  r.GetStargazersCount(),
		ForksCount:       r.GetForksCount(),
		WatchersCount:    r.GetWatchersCount(),
		SubscribersCount: r.GetSubscribersCount(),
		DefaultBranch:    r.GetDefaultBranch(),
		CreatedAt:        r.GetCreatedAt().Time,
		UpdatedAt:        r.GetUpdatedAt().Time,
	}
	return out
}

// parseGitHubError turns a go-github error into a user-friendly message.
func parseGitHubError(err error, url string) error {
	if err == nil {
		return nil
	}
	if _, ok := err.(*NotModifiedError); ok {
		return err
	}
	if rateErr, ok := err.(*github.RateLimitError); ok {
		return &RateLimitError{ResetAt: rateErr.Rate.Reset.Time, URL: url}
	}
	if abuseErr, ok := err.(*github.AbuseRateLimitError); ok {
		return fmt.Errorf("GitHub abuse rate limit for URL %s: retry after %v", url, abuseErr.GetRetryAfter())
	}
	if errResp, ok := err.(*github.ErrorResponse); ok {
		switch errResp.Response.StatusCode {
		case http.StatusUnauthorized:
			return fmt.Errorf("GitHub API token invalid or expired (401) for URL %s: %s", url, errResp.Message)
		case http.StatusForbidden, http.StatusTooManyRequests:
			return fmt.Errorf("GitHub API rate limit or forbidden (%d) for URL %s: %s", errResp.Response.StatusCode, url, errResp.Message)
		default:
			return fmt.Errorf("GitHub API returned status %d for URL %s: %s", errResp.Response.StatusCode, url, errResp.Message)
		}
	}
	return fmt.Errorf("GitHub API request failed for URL %s: %w", url, err)
}
